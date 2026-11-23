import {
  DEFAULT_INVITE_TTL_DAYS,
  generateInviteCode,
  ImportRequest,
  parseBuyersCsv,
  type BuyerRow,
  type ImportResult,
  type RowError,
} from '@gatehood/shared';
import { Router } from 'express';
import { FieldValue, type DocumentReference, type Firestore } from 'firebase-admin/firestore';
import { depsOf } from '../deps.js';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Firestore allows 500 writes per batch; stay well under it. */
const MAX_BATCH_OPS = 450;
/** Firestore `in` queries take at most 30 values. */
const MAX_IN = 30;
const CODE_TRIES = 5;

/** `INVITE_TTL_DAYS` if it's a positive whole number, otherwise 30. Read per import so it can change without a restart. */
export function inviteTtlDays(env: NodeJS.ProcessEnv = process.env): number {
  const days = Number(env.INVITE_TTL_DAYS);
  return Number.isInteger(days) && days > 0 ? days : DEFAULT_INVITE_TTL_DAYS;
}

const digitsOf = (phone: string) => phone.replace(/\D/g, '');

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

interface UnitInvites {
  /** Phone digits that already have an invite for this unit. */
  phones: Set<string>;
  /** Codes already taken for this unit. Codes start with the unit, so clashes can only happen within one unit. */
  codes: Set<string>;
}

/** Existing invites for these units, read with `in` queries rather than the whole collection. */
async function invitesByUnit(db: Firestore, unitIds: string[]): Promise<Map<string, UnitInvites>> {
  const byUnit = new Map<string, UnitInvites>(unitIds.map((id) => [id, { phones: new Set(), codes: new Set() }]));
  const snaps = await Promise.all(
    chunk(unitIds, MAX_IN).map((ids) =>
      db.collection('invites').where('unitId', 'in', ids).select('unitId', 'phone').get(),
    ),
  );
  for (const snap of snaps) {
    for (const doc of snap.docs) {
      const entry = byUnit.get(doc.get('unitId') as string);
      if (entry) {
        entry.phones.add(digitsOf(String(doc.get('phone') ?? '')));
        entry.codes.add(doc.id);
      }
    }
  }
  return byUnit;
}

type Op =
  | { kind: 'create'; ref: DocumentReference; data: Record<string, unknown> }
  | { kind: 'update'; ref: DocumentReference; data: Record<string, unknown> };

async function commitInChunks(db: Firestore, ops: Op[]): Promise<void> {
  for (const part of chunk(ops, MAX_BATCH_OPS)) {
    const batch = db.batch();
    for (const op of part) {
      if (op.kind === 'create') batch.create(op.ref, op.data);
      else batch.update(op.ref, op.data);
    }
    await batch.commit();
  }
}

/**
 * Turns a buyers CSV into invites. Creates any towers and units that don't exist yet
 * (existing ones are left as they are), and one invite per new buyer. A row whose unit
 * and phone already have an invite is skipped, so importing the same file twice is safe.
 */
export async function importBuyers(
  db: Firestore,
  csv: string,
  now: Date,
  options: { ttlDays?: number; rand?: () => number } = {},
): Promise<ImportResult> {
  const { rows, errors: parseErrors } = parseBuyersCsv(csv);
  const errors: RowError[] = [...parseErrors];
  if (rows.length === 0) return { created: 0, skipped: 0, errors, invites: [] };

  const unitIds = [...new Set(rows.map((r) => r.unitId))];
  const existing = await invitesByUnit(db, unitIds);

  // Decide which rows are new and give each a code.
  let skipped = 0;
  const fresh: { row: BuyerRow; code: string }[] = [];
  for (const row of rows) {
    const unit = existing.get(row.unitId)!;
    const phone = digitsOf(row.phone);
    if (unit.phones.has(phone)) {
      skipped++;
      continue;
    }

    let code: string | null = null;
    for (let i = 0; i < CODE_TRIES && !code; i++) {
      const candidate = generateInviteCode(row.tower, row.unit, options.rand);
      if (!unit.codes.has(candidate)) code = candidate;
    }
    if (!code) {
      errors.push({ line: row.line, reason: "Couldn't make a unique code for this unit. Import the file again." });
      continue;
    }
    unit.codes.add(code);
    unit.phones.add(phone);
    fresh.push({ row, code });
  }

  if (fresh.length === 0) {
    errors.sort((a, b) => a.line - b.line);
    return { created: 0, skipped, errors, invites: [] };
  }

  // Look up which units and towers already exist.
  const firstRowOfUnit = new Map<string, BuyerRow>();
  for (const { row } of fresh) if (!firstRowOfUnit.has(row.unitId)) firstRowOfUnit.set(row.unitId, row);
  const unitRefs = [...firstRowOfUnit.keys()].map((id) => db.collection('units').doc(id));
  const towerIds = [...new Set([...firstRowOfUnit.values()].map((r) => r.tower))];
  const towerRefs = towerIds.map((id) => db.collection('towers').doc(id));
  const [unitSnaps, towerSnaps] = await Promise.all([db.getAll(...unitRefs), db.getAll(...towerRefs)]);

  const ops: Op[] = [];
  const newUnitsPerTower = new Map<string, number>();
  for (const snap of unitSnaps) {
    if (snap.exists) continue;
    const row = firstRowOfUnit.get(snap.id)!;
    ops.push({
      kind: 'create',
      ref: snap.ref,
      data: { towerId: row.tower, number: row.unitId.split('-')[1], config: row.config ?? null, areaSqft: null },
    });
    newUnitsPerTower.set(row.tower, (newUnitsPerTower.get(row.tower) ?? 0) + 1);
  }

  for (const snap of towerSnaps) {
    const added = newUnitsPerTower.get(snap.id) ?? 0;
    if (!snap.exists) {
      ops.push({
        kind: 'create',
        ref: snap.ref,
        data: { name: `Tower ${snap.id}`, floors: 0, progressPct: 0, possessionDate: null, unitCount: added },
      });
    } else if (added > 0) {
      ops.push({ kind: 'update', ref: snap.ref, data: { unitCount: FieldValue.increment(added) } });
    }
  }

  const expiresAt = now.getTime() + (options.ttlDays ?? inviteTtlDays()) * DAY_MS;
  for (const { row, code } of fresh) {
    ops.push({
      kind: 'create',
      ref: db.collection('invites').doc(code),
      data: {
        unitId: row.unitId,
        towerId: row.tower,
        name: row.name,
        phone: row.phone,
        expiresAt,
        usedBy: null,
        usedAt: null,
      },
    });
  }

  // `create` fails rather than overwrite, so a racing import can never replace a code someone already holds.
  await commitInChunks(db, ops);

  errors.sort((a, b) => a.line - b.line);
  return {
    created: fresh.length,
    skipped,
    errors,
    invites: fresh.map(({ row, code }) => ({ code, unitId: row.unitId, name: row.name })),
  };
}

/** `POST /import`. Mount under `/api/builder`, behind `requireRole('builder')`. */
export function importRouter(): Router {
  const router = Router();
  router.post('/import', async (req, res) => {
    const { csv } = ImportRequest.parse(req.body);
    const { db, now } = depsOf(req);
    const result: ImportResult = await importBuyers(db, csv, now());
    res.json(result);
  });
  return router;
}
