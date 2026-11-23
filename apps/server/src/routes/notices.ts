import {
  audienceForTarget,
  audienceKeysFor,
  CreateNoticeRequest,
  intersects,
  PinRequest,
  type NoticeStats,
  type NoticeTarget,
} from '@gatehood/shared';
import { Router } from 'express';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { depsOf } from '../deps.js';
import { HttpError } from '../errors.js';
import { requireRole } from '../middleware/auth.js';

const TOWER_ID = /^[A-Z]{1,3}$/;
const UNIT_ID = /^[A-Z]{1,3}-\d{4,6}$/;
/** Firestore's NOT_FOUND status, thrown by `update` on a missing doc. */
const GRPC_NOT_FOUND = 5;

export interface Reader {
  uid: string;
  towerId: string;
  unitId: string;
}

const noticeMissing = () => new HttpError(404, 'not_found', 'This notice no longer exists.');

function listOf(ids: string[]): string {
  const shown = ids.slice(0, 10).join(', ');
  return ids.length > 10 ? `${shown} and ${ids.length - 10} more` : shown;
}

/** Upper-cases ids and drops repeats, so `a-1204` and `A-1204` are one unit. */
function normaliseTarget(target: NoticeTarget): NoticeTarget {
  const clean = (ids: string[]) => [...new Set(ids.map((id) => id.trim().toUpperCase()))];
  switch (target.type) {
    case 'all':
      return target;
    case 'towers':
      return { type: 'towers', towers: clean(target.towers) };
    case 'units':
      return { type: 'units', unitIds: clean(target.unitIds) };
  }
}

/** Throws 400 naming every tower or unit in the target that doesn't exist, so a typo can't send a notice to nobody. */
async function assertTargetExists(db: Firestore, target: NoticeTarget): Promise<void> {
  if (target.type === 'all') return;
  const [collection, ids, pattern, label] =
    target.type === 'towers'
      ? (['towers', target.towers, TOWER_ID, 'towers'] as const)
      : (['units', target.unitIds, UNIT_ID, 'units'] as const);

  const wellFormed = ids.filter((id) => pattern.test(id));
  const snaps = wellFormed.length ? await db.getAll(...wellFormed.map((id) => db.collection(collection).doc(id))) : [];
  const found = new Set(snaps.filter((s) => s.exists).map((s) => s.id));
  const unknown = ids.filter((id) => !found.has(id));
  if (unknown.length > 0) {
    throw new HttpError(400, 'bad_request', `These ${label} don't exist: ${listOf(unknown)}. Check them and try again.`);
  }
}

/**
 * Records that a buyer read a notice, at most once. In one transaction: the notice must exist (404)
 * and be meant for the buyer (403). If their receipt is already there nothing changes; otherwise both
 * receipts are written and `readCount` goes up by one. Safe to retry after a dropped connection.
 */
export async function markRead(db: Firestore, user: Reader, noticeId: string, now: Date): Promise<{ counted: boolean }> {
  const noticeRef = db.collection('notices').doc(noticeId);
  const receiptRef = noticeRef.collection('reads').doc(user.uid);
  const mirrorRef = db.collection('members').doc(user.uid).collection('reads').doc(noticeId);
  const readAt = now.getTime();

  return db.runTransaction(async (tx) => {
    const [notice, receipt] = await Promise.all([tx.get(noticeRef), tx.get(receiptRef)]);
    if (!notice.exists) throw noticeMissing();

    const audience = notice.get('audience') as unknown;
    if (!Array.isArray(audience) || !intersects(audience as string[], audienceKeysFor(user))) {
      throw new HttpError(403, 'forbidden', "This notice isn't for your unit.");
    }
    if (receipt.exists) return { counted: false };

    tx.create(receiptRef, { unitId: user.unitId, towerId: user.towerId, readAt });
    tx.set(mirrorRef, { readAt });
    tx.update(noticeRef, { readCount: FieldValue.increment(1) });
    return { counted: true };
  });
}

/** Read count, joined buyers in the audience, per-tower split, who hasn't read, and invited-but-not-joined. */
export async function noticeStats(db: Firestore, noticeId: string): Promise<NoticeStats> {
  const noticeRef = db.collection('notices').doc(noticeId);
  const [notice, reads, members, invites] = await Promise.all([
    noticeRef.get(),
    noticeRef.collection('reads').select('towerId').get(),
    db.collection('members').where('role', '==', 'buyer').get(),
    db.collection('invites').select('unitId', 'towerId', 'usedBy').get(),
  ]);
  if (!notice.exists) throw noticeMissing();

  const audience = (notice.get('audience') as string[] | undefined) ?? [];
  const inAudience = (m: { towerId?: unknown; unitId?: unknown }) =>
    typeof m.towerId === 'string' &&
    typeof m.unitId === 'string' &&
    intersects(audience, audienceKeysFor({ towerId: m.towerId, unitId: m.unitId }));

  const readers = new Set(reads.docs.map((r) => r.id));
  const byTower = new Map<string, { read: number; joined: number }>();
  const tower = (id: string) => {
    let t = byTower.get(id);
    if (!t) byTower.set(id, (t = { read: 0, joined: 0 }));
    return t;
  };
  const target = notice.get('target') as NoticeTarget | undefined;
  if (target?.type === 'towers') for (const id of target.towers) tower(id);

  const notRead: NoticeStats['notRead'] = [];
  let joinedInAudience = 0;
  for (const doc of members.docs) {
    const m = doc.data();
    if (!inAudience(m)) continue;
    joinedInAudience++;
    const t = tower(m.towerId as string);
    t.joined++;
    if (readers.has(doc.id)) t.read++;
    else notRead.push({ uid: doc.id, name: String(m.name ?? ''), unitId: m.unitId as string });
  }
  notRead.sort((a, b) => a.unitId.localeCompare(b.unitId) || a.name.localeCompare(b.name));

  // A redeem that was undone deletes usedBy rather than nulling it, so treat any falsy value as not joined.
  const notJoined = invites.docs.filter((i) => !i.get('usedBy') && inAudience(i.data())).length;

  return {
    readCount: Number(notice.get('readCount') ?? 0),
    joinedInAudience,
    notJoined,
    byTower: [...byTower.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([towerId, t]) => ({ towerId, ...t })),
    notRead,
  };
}

/** `POST /notices`, `PATCH /notices/:id`, `GET /notices/:id/stats`. Mount under `/api/builder`, behind `requireRole('builder')`. */
export function builderNoticesRouter(): Router {
  const router = Router();

  router.post('/notices', async (req, res) => {
    const input = CreateNoticeRequest.parse(req.body);
    const { db, now } = depsOf(req);
    const target = normaliseTarget(input.target);
    await assertTargetExists(db, target);

    const ref = db.collection('notices').doc();
    await ref.create({
      title: input.title,
      body: input.body,
      pinned: input.pinned,
      // Milliseconds from the server's clock, like every other time in the database, so the seed can backdate notices.
      createdAt: now().getTime(),
      createdBy: req.user!.uid,
      target,
      audience: audienceForTarget(target),
      readCount: 0,
    });
    res.status(201).json({ id: ref.id });
  });

  router.patch('/notices/:id', async (req, res) => {
    const { pinned } = PinRequest.parse(req.body);
    const { db } = depsOf(req);
    try {
      await db.collection('notices').doc(String(req.params.id)).update({ pinned });
    } catch (err) {
      if ((err as { code?: number }).code === GRPC_NOT_FOUND) throw noticeMissing();
      throw err;
    }
    res.json({ ok: true });
  });

  router.get('/notices/:id/stats', async (req, res) => {
    const stats: NoticeStats = await noticeStats(depsOf(req).db, String(req.params.id));
    res.json(stats);
  });

  return router;
}

/** `POST /:id/read` for buyers. Mount under `/api/notices`. */
export function noticesRouter(): Router {
  const router = Router();

  router.post('/:id/read', requireRole('buyer'), async (req, res) => {
    const { uid, towerId, unitId } = req.user!;
    if (!towerId || !unitId) throw new HttpError(403, 'forbidden', 'Your account is not linked to a unit.');
    const { db, now } = depsOf(req);
    res.json(await markRead(db, { uid, towerId, unitId }, String(req.params.id), now()));
  });

  return router;
}
