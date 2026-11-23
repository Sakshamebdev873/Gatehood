import { readFileSync } from 'node:fs';
import type { ImportResult } from '@gatehood/shared';
import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initAdmin } from '../src/firebase.js';
import { redeemInvite } from '../src/routes/invites.js';
import { clearAuth, clearFirestore, idTokenFor, makeApp } from './helpers.js';

const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-11-20T10:00:00Z');
const { db, auth } = initAdmin();
const SAMPLE = readFileSync(new URL('../../../sample/buyers.csv', import.meta.url), 'utf8');
// 12 rows, of which line 8 (B-1404, no phone) is bad.
const VALID_ROWS = 11;
const CODE = /^[A-C]\d{4}-[A-HJ-NP-Z2-9]{3}$/;

let app: Express;
let builderToken: string;
let buyerToken: string;

const importCsv = (body: unknown, token = builderToken) =>
  request(app).post('/api/builder/import').set('authorization', `Bearer ${token}`).send(body as object);
const get = (path: string, token = builderToken) =>
  request(app).get(path).set('authorization', `Bearer ${token}`);

beforeAll(async () => {
  await clearAuth();
  builderToken = await idTokenFor('builder-1', { role: 'builder' });
  buyerToken = await idTokenFor('buyer-1', { role: 'buyer', towerId: 'A', unitId: 'A-1204' });
});

beforeEach(async () => {
  await clearFirestore();
  app = makeApp(now);
});

describe('POST /api/builder/import', () => {
  it('imports the sample: one invite per valid row, the bad row reported by line', async () => {
    const res = await importCsv({ csv: SAMPLE });
    expect(res.status).toBe(200);
    const body = res.body as ImportResult;

    expect(body.created).toBe(VALID_ROWS);
    expect(body.skipped).toBe(0);
    expect(body.errors).toEqual([{ line: 8, reason: 'Missing phone' }]);
    expect(body.invites).toHaveLength(VALID_ROWS);
    for (const inv of body.invites) expect(inv.code).toMatch(CODE);
    expect(new Set(body.invites.map((i) => i.code)).size).toBe(VALID_ROWS);

    const sneha = body.invites.find((i) => i.unitId === 'A-0904');
    expect(sneha?.name).toBe('Sneha Patel');
    expect(sneha?.code.startsWith('A0904-')).toBe(true);

    const invite = (await db.doc(`invites/${sneha!.code}`).get()).data();
    expect(invite).toEqual({
      unitId: 'A-0904',
      towerId: 'A',
      name: 'Sneha Patel',
      phone: '9810010904',
      expiresAt: now.getTime() + 30 * DAY,
      usedBy: null,
      usedAt: null,
    });

    expect((await db.doc('units/A-0904').get()).data()).toEqual({
      towerId: 'A',
      number: '0904',
      config: '3BHK',
      areaSqft: null,
    });
    expect((await db.doc('towers/B').get()).data()).toEqual({
      name: 'Tower B',
      floors: 0,
      progressPct: 0,
      possessionDate: null,
      unitCount: 3,
    });
    expect((await db.collection('invites').count().get()).data().count).toBe(VALID_ROWS);
    expect((await db.collection('units').count().get()).data().count).toBe(VALID_ROWS);
  });

  it('creates nothing when the same file is imported again', async () => {
    await importCsv({ csv: SAMPLE }).expect(200);
    const res = await importCsv({ csv: SAMPLE });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ created: 0, skipped: VALID_ROWS, invites: [] });
    expect((await db.collection('invites').count().get()).data().count).toBe(VALID_ROWS);
  });

  it('treats a phone written differently as the same buyer, and a new phone as a co-owner', async () => {
    await importCsv({ csv: 'tower,unit,name,phone\nA,1201,Aarav Mehta,98100 11201\n' }).expect(200);
    const res = await importCsv({
      csv: 'tower,unit,name,phone\nA,1201,Aarav Mehta,9810011201\nA,1201,Riya Mehta,9810099999\n',
    });
    expect(res.body).toMatchObject({ created: 1, skipped: 1 });
    expect(res.body.invites).toEqual([{ code: expect.stringMatching(/^A1201-/), unitId: 'A-1201', name: 'Riya Mehta' }]);
  });

  it('keeps an existing tower and unit as they are, adding only new units to the count', async () => {
    await db.doc('towers/A').set({
      name: 'Tower A',
      floors: 20,
      progressPct: 62,
      possessionDate: '2028-01-15',
      unitCount: 80,
    });
    await db.doc('units/A-1201').set({ towerId: 'A', number: '1201', config: '3BHK', areaSqft: 1640 });

    await importCsv({ csv: 'tower,unit,name,phone\nA,1201,Aarav Mehta,9810011201\nA,1502,Kavya Nair,9810011502\n' })
      .expect(200);

    expect((await db.doc('towers/A').get()).data()).toMatchObject({ progressPct: 62, unitCount: 81 });
    expect((await db.doc('units/A-1201').get()).data()).toMatchObject({ areaSqft: 1640 });
  });

  it('uses INVITE_TTL_DAYS for expiry', async () => {
    process.env.INVITE_TTL_DAYS = '7';
    try {
      const res = await importCsv({ csv: 'tower,unit,name,phone\nC,502,Karan Malhotra,9810030502\n' }).expect(200);
      const invite = (await db.doc(`invites/${res.body.invites[0].code}`).get()).data();
      expect(invite?.expiresAt).toBe(now.getTime() + 7 * DAY);
    } finally {
      delete process.env.INVITE_TTL_DAYS;
    }
  });

  it('returns the row errors and creates nothing when no row is valid', async () => {
    const res = await importCsv({ csv: 'tower,unit,name\nA,1201,Aarav Mehta\n' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ created: 0, skipped: 0, errors: [{ line: 1, reason: 'Missing column: phone' }], invites: [] });
  });

  it('rejects a buyer with 403', async () => {
    const res = await importCsv({ csv: SAMPLE }, buyerToken);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('forbidden');
  });

  it('rejects no token with 401', async () => {
    const res = await request(app).post('/api/builder/import').send({ csv: SAMPLE });
    expect(res.status).toBe(401);
  });

  it('rejects a body without csv with 400', async () => {
    const res = await importCsv({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('bad_request');
  });
});

describe('builder overview and buyers list', () => {
  let imported: ImportResult;

  beforeEach(async () => {
    imported = (await importCsv({ csv: SAMPLE }).expect(200)).body as ImportResult;
  });

  const codeOf = (unitId: string) => imported.invites.find((i) => i.unitId === unitId)!.code;

  it('counts units, invited and joined buyers per tower', async () => {
    await redeemInvite(db, auth, codeOf('A-1201'), now);

    const res = await get('/api/builder/overview');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      towers: [
        { towerId: 'A', name: 'Tower A', units: 4, invited: 4, joined: 1 },
        { towerId: 'B', name: 'Tower B', units: 3, invited: 3, joined: 0 },
        { towerId: 'C', name: 'Tower C', units: 4, invited: 4, joined: 0 },
      ],
    });
  });

  it('lists one tower sorted by unit, with joined, pending and expired statuses', async () => {
    await redeemInvite(db, auth, codeOf('A-1201'), now);
    await db.doc(`invites/${codeOf('A-1803')}`).update({ expiresAt: now.getTime() - DAY });

    const res = await get('/api/builder/buyers?tower=a');
    expect(res.status).toBe(200);
    const buyers = res.body.buyers as { unitId: string; towerId: string; status: string; joinedAt?: number }[];

    expect(buyers.map((b) => b.unitId)).toEqual(['A-0904', 'A-1201', 'A-1502', 'A-1803']);
    expect(buyers.every((b) => b.towerId === 'A')).toBe(true);
    expect(buyers.map((b) => b.status)).toEqual(['pending', 'joined', 'pending', 'expired']);
    expect(buyers[1]).toEqual({
      code: codeOf('A-1201'),
      unitId: 'A-1201',
      towerId: 'A',
      name: 'Aarav Mehta',
      phone: '98100 11201',
      status: 'joined',
      joinedAt: now.getTime(),
    });
    expect(buyers[0]).not.toHaveProperty('joinedAt');
  });

  it('lists every tower when no tower is given', async () => {
    const res = await get('/api/builder/buyers');
    expect(res.status).toBe(200);
    expect(res.body.buyers).toHaveLength(VALID_ROWS);
    expect(res.body.buyers[0].unitId).toBe('A-0904');
    expect(res.body.buyers.at(-1).unitId).toBe('C-1904');
  });

  it('rejects a bad tower filter with 400, and buyers with 403', async () => {
    expect((await get('/api/builder/buyers?tower=A-1')).status).toBe(400);
    expect((await get('/api/builder/overview', buyerToken)).status).toBe(403);
    expect((await get('/api/builder/buyers', buyerToken)).status).toBe(403);
  });
});
