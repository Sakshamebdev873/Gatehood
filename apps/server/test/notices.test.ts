import type { NoticeStats } from '@gatehood/shared';
import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initAdmin } from '../src/firebase.js';
import { markRead } from '../src/routes/notices.js';
import { clearAuth, clearFirestore, idTokenFor, makeApp } from './helpers.js';

const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-11-20T10:00:00Z');
const { db } = initAdmin();

// Joined buyers: 3 in A, 1 in B, 1 in C.
const MEMBERS = [
  { uid: 'buyer-a1', towerId: 'A', unitId: 'A-1204', name: 'Priya Sharma' },
  { uid: 'buyer-a2', towerId: 'A', unitId: 'A-1205', name: 'Ravi Kumar' },
  { uid: 'buyer-a3', towerId: 'A', unitId: 'A-1206', name: 'Meera Iyer' },
  { uid: 'buyer-b1', towerId: 'B', unitId: 'B-0301', name: 'Vikram Singh' },
  { uid: 'buyer-c1', towerId: 'C', unitId: 'C-0501', name: 'Neha Joshi' },
];
const tokens: Record<string, string> = {};
let builderToken: string;
let app: Express;

const auth = (token: string) => ({ authorization: `Bearer ${token}` });
const post = (path: string, body: object, token = builderToken) => request(app).post(path).set(auth(token)).send(body);
const read = (id: string, uid = 'buyer-a1') => request(app).post(`/api/notices/${id}/read`).set(auth(tokens[uid]!)).send();
const create = (body: object) =>
  post('/api/builder/notices', { title: 'Water supply off', body: 'From 10am to 2pm.', pinned: false, ...body });
const count = async (path: string) => (await db.collection(path).count().get()).data().count;

beforeAll(async () => {
  await clearAuth();
  builderToken = await idTokenFor('builder-1', { role: 'builder' });
  for (const m of MEMBERS) {
    tokens[m.uid] = await idTokenFor(m.uid, { role: 'buyer', towerId: m.towerId, unitId: m.unitId });
  }
});

beforeEach(async () => {
  await clearFirestore();
  const batch = db.batch();
  for (const t of ['A', 'B', 'C']) {
    batch.set(db.doc(`towers/${t}`), { name: `Tower ${t}`, floors: 20, progressPct: 50, possessionDate: null, unitCount: 0 });
  }
  for (const m of MEMBERS) {
    batch.set(db.doc(`units/${m.unitId}`), { towerId: m.towerId, number: m.unitId.slice(2), config: '3BHK', areaSqft: null });
    batch.set(db.doc(`members/${m.uid}`), { role: 'buyer', towerId: m.towerId, unitId: m.unitId, name: m.name, joinedAt: 1 });
    batch.set(db.doc(`invites/${m.unitId.replace('-', '')}-USD`), {
      unitId: m.unitId, towerId: m.towerId, name: m.name, phone: '9800000000',
      expiresAt: now.getTime() + DAY, usedBy: m.uid, usedAt: 1,
    });
  }
  // Invited but not joined: one each in A, B and C.
  for (const [unitId, towerId] of [['A-0101', 'A'], ['B-0102', 'B'], ['C-0103', 'C']] as const) {
    batch.set(db.doc(`invites/${unitId.replace('-', '')}-PND`), {
      unitId, towerId, name: 'Not Yet', phone: '9811111111', expiresAt: now.getTime() + DAY, usedBy: null, usedAt: null,
    });
  }
  batch.set(db.doc('members/builder-1'), { role: 'builder', name: 'Site Office' });
  await batch.commit();
  app = makeApp(now);
});

describe('POST /api/builder/notices', () => {
  it('stores tower keys as the audience and starts readCount at 0', async () => {
    const res = await create({ target: { type: 'towers', towers: ['A', 'B'] }, pinned: true });
    expect(res.status).toBe(201);
    expect(typeof res.body.id).toBe('string');

    const notice = (await db.doc(`notices/${res.body.id}`).get()).data();
    expect(notice).toEqual({
      title: 'Water supply off',
      body: 'From 10am to 2pm.',
      pinned: true,
      createdAt: now.getTime(),
      createdBy: 'builder-1',
      target: { type: 'towers', towers: ['A', 'B'] },
      audience: ['tower:A', 'tower:B'],
      readCount: 0,
    });
  });

  it('stores all and unit audiences', async () => {
    const all = await create({ target: { type: 'all' } });
    expect((await db.doc(`notices/${all.body.id}`).get()).get('audience')).toEqual(['all']);

    const units = await create({ target: { type: 'units', unitIds: ['a-1204', 'B-0301'] } });
    expect(units.status).toBe(201);
    expect((await db.doc(`notices/${units.body.id}`).get()).get('audience')).toEqual(['unit:A-1204', 'unit:B-0301']);
  });

  it('rejects unknown units with 400, naming them', async () => {
    const res = await create({ target: { type: 'units', unitIds: ['A-1204', 'A-9999'] } });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('bad_request');
    expect(res.body.error.message).toContain('A-9999');
    expect(res.body.error.message).not.toContain('A-1204');
    expect(await count('notices')).toBe(0);
  });

  it('rejects unknown towers with 400, naming them', async () => {
    const res = await create({ target: { type: 'towers', towers: ['A', 'Z'] } });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Z');
  });

  it('rejects a missing title with 400 and a buyer with 403', async () => {
    expect((await create({ title: '', target: { type: 'all' } })).status).toBe(400);
    const res = await post('/api/builder/notices', { title: 'x', body: 'y', pinned: false, target: { type: 'all' } }, tokens['buyer-a1']);
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/builder/notices/:id', () => {
  it('pins and unpins', async () => {
    const { body } = await create({ target: { type: 'all' } });
    const pin = (pinned: boolean) =>
      request(app).patch(`/api/builder/notices/${body.id}`).set(auth(builderToken)).send({ pinned });

    expect((await pin(true)).body).toEqual({ ok: true });
    expect((await db.doc(`notices/${body.id}`).get()).get('pinned')).toBe(true);
    await pin(false).expect(200);
    expect((await db.doc(`notices/${body.id}`).get()).get('pinned')).toBe(false);
  });

  it('gives 404 for a missing notice', async () => {
    const res = await request(app).patch('/api/builder/notices/nope').set(auth(builderToken)).send({ pinned: true });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
  });
});

describe('POST /api/notices/:id/read', () => {
  it('counts a buyer once, however many times they read', async () => {
    const { body } = await create({ target: { type: 'towers', towers: ['A'] } });

    expect((await read(body.id)).body).toEqual({ counted: true });
    const again = await Promise.all([read(body.id), read(body.id)]);
    expect(again.map((r) => r.body)).toEqual([{ counted: false }, { counted: false }]);

    expect((await db.doc(`notices/${body.id}`).get()).get('readCount')).toBe(1);
    expect((await db.doc(`notices/${body.id}/reads/buyer-a1`).get()).data()).toEqual({
      unitId: 'A-1204',
      towerId: 'A',
      readAt: now.getTime(),
    });
    expect((await db.doc(`members/buyer-a1/reads/${body.id}`).get()).data()).toEqual({ readAt: now.getTime() });
  });

  it('counts exactly one of two first reads at the same moment', async () => {
    const { body } = await create({ target: { type: 'all' } });
    const results = await Promise.all([read(body.id), read(body.id)]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(results.map((r) => r.body.counted).sort()).toEqual([false, true]);
    expect((await db.doc(`notices/${body.id}`).get()).get('readCount')).toBe(1);
  });

  it('lets a buyer read a notice sent to their unit', async () => {
    const { body } = await create({ target: { type: 'units', unitIds: ['A-1204'] } });
    expect((await read(body.id)).body).toEqual({ counted: true });
  });

  it('gives 403 to a buyer outside the audience, with no receipt and no count', async () => {
    const { body } = await create({ target: { type: 'towers', towers: ['B'] } });
    const res = await read(body.id);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('forbidden');
    expect((await db.doc(`notices/${body.id}`).get()).get('readCount')).toBe(0);
    expect(await count(`notices/${body.id}/reads`)).toBe(0);
    expect(await count('members/buyer-a1/reads')).toBe(0);
  });

  it('gives 404 for a missing notice', async () => {
    const res = await read('does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
  });

  it('rejects the builder with 403', async () => {
    const { body } = await create({ target: { type: 'all' } });
    const res = await request(app).post(`/api/notices/${body.id}/read`).set(auth(builderToken)).send();
    expect(res.status).toBe(403);
  });
});

describe('GET /api/builder/notices/:id/stats', () => {
  it('matches a known setup: towers A and B, 2 reads in A', async () => {
    const { body } = await create({ target: { type: 'towers', towers: ['A', 'B'] } });
    await read(body.id, 'buyer-a1').expect(200);
    await markRead(db, MEMBERS[1]!, body.id, now);

    const res = await request(app).get(`/api/builder/notices/${body.id}/stats`).set(auth(builderToken));
    expect(res.status).toBe(200);
    const stats = res.body as NoticeStats;

    expect(stats.readCount).toBe(2);
    expect(stats.joinedInAudience).toBe(4);
    expect(stats.byTower).toEqual([
      { towerId: 'A', read: 2, joined: 3 },
      { towerId: 'B', read: 0, joined: 1 },
    ]);
    expect(stats.notRead).toEqual([
      { uid: 'buyer-a3', name: 'Meera Iyer', unitId: 'A-1206' },
      { uid: 'buyer-b1', name: 'Vikram Singh', unitId: 'B-0301' },
    ]);
    // Pending invites in A and B; C's is outside the audience, and joined buyers' invites don't count.
    expect(stats.notJoined).toBe(2);
  });

  it('covers every joined buyer for a whole-project notice', async () => {
    const { body } = await create({ target: { type: 'all' } });
    const stats = (await request(app).get(`/api/builder/notices/${body.id}/stats`).set(auth(builderToken))).body as NoticeStats;
    expect(stats).toMatchObject({ readCount: 0, joinedInAudience: 5, notJoined: 3 });
    expect(stats.notRead).toHaveLength(5);
    expect(stats.byTower.map((t) => t.towerId)).toEqual(['A', 'B', 'C']);
  });

  it('gives 404 for a missing notice and 403 to a buyer', async () => {
    expect((await request(app).get('/api/builder/notices/nope/stats').set(auth(builderToken))).status).toBe(404);
    const { body } = await create({ target: { type: 'all' } });
    expect((await request(app).get(`/api/builder/notices/${body.id}/stats`).set(auth(tokens['buyer-a1']!))).status).toBe(403);
  });
});
