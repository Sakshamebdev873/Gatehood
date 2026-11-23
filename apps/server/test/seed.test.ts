import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { initAdmin } from '../src/firebase.js';
import { runSeed, type SeedSummary } from '../src/seed.js';
import { clearAuth, clearFirestore, makeApp } from './helpers.js';

const now = new Date('2026-11-24T09:30:00Z');
const { db, auth } = initAdmin();
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
const SEED_TIMEOUT = 120_000;

let summary: SeedSummary;
let app: Express;

const count = async (path: string) => (await db.collection(path).count().get()).data().count;
const redeem = (code: string) => request(app).post('/api/invites/redeem').send({ code });

async function snapshotCounts() {
  return {
    towers: await count('towers'),
    units: await count('units'),
    invites: await count('invites'),
    notices: await count('notices'),
    pinned: (await db.collection('notices').where('pinned', '==', true).count().get()).data().count,
    members: await count('members'),
    users: (await auth.listUsers()).users.length,
  };
}

beforeAll(async () => {
  await Promise.all([clearFirestore(), clearAuth()]);
  summary = await runSeed({ db, auth, now });
  app = makeApp(now);
}, SEED_TIMEOUT);

describe('runSeed', () => {
  it('creates 3 towers, 240 units and invites, 55 notices with 4 pinned, 6 buyers', async () => {
    expect(await snapshotCounts()).toEqual({
      towers: 3,
      units: 240,
      invites: 240,
      notices: 55,
      pinned: 4,
      members: 6,
      users: 7, // 6 buyers + the builder
    });

    const members = await db.collection('members').get();
    expect(members.docs.every((m) => m.get('role') === 'buyer')).toBe(true);
    expect(summary.buyers).toHaveLength(6);
    expect(summary.buyers).toContainEqual({ name: 'Priya Sharma', unitId: 'A-1204' });
  });

  it('seeds towers and units with progress, possession, config and area', async () => {
    expect((await db.doc('towers/A').get()).data()).toEqual({
      name: 'Tower A',
      floors: 20,
      progressPct: 62,
      possessionDate: Date.UTC(2028, 0, 15),
      unitCount: 80,
    });
    expect((await db.doc('units/A-1204').get()).data()).toEqual({
      towerId: 'A',
      number: '1204',
      config: '3BHK',
      areaSqft: 1640,
    });
    const configs = (await db.collection('units').where('towerId', '==', 'C').get()).docs.map((u) => u.get('config'));
    expect(new Set(configs)).toEqual(new Set(['2BHK', '3BHK', '4BHK']));
  });

  it('has exactly one expired invite', async () => {
    const expired = await db.collection('invites').where('expiresAt', '<=', now.getTime()).get();
    expect(expired.size).toBe(1);
    expect(expired.docs[0]!.id).toBe(summary.codes.expired);
  });

  it('spreads notices over the last 60 days across all, tower and unit audiences', async () => {
    const notices = (await db.collection('notices').get()).docs.map((d) => d.data());
    const day = 24 * 60 * 60 * 1000;
    for (const n of notices) {
      expect(n.createdAt).toBeLessThan(now.getTime());
      expect(n.createdAt).toBeGreaterThanOrEqual(now.getTime() - 61 * day);
    }
    const byType = (t: string) => notices.filter((n) => n.target.type === t).length;
    expect(byType('all')).toBeGreaterThanOrEqual(22);
    expect(byType('towers')).toBeGreaterThanOrEqual(15);
    expect(byType('units')).toBeGreaterThanOrEqual(5);
    expect(notices.some((n) => n.audience.includes('unit:A-1204'))).toBe(true);
  });

  it('keeps every readCount equal to its receipts, and each receipt mirrored', async () => {
    const notices = await db.collection('notices').get();
    let total = 0;
    for (const n of notices.docs) {
      const reads = await n.ref.collection('reads').get();
      expect(n.get('readCount')).toBe(reads.size);
      total += reads.size;
      for (const r of reads.docs) {
        expect((await db.doc(`members/${r.id}/reads/${n.id}`).get()).exists).toBe(true);
        expect(r.get('readAt')).toBeGreaterThanOrEqual(n.get('createdAt'));
      }
    }
    expect(total).toBeGreaterThan(50);
  });

  it('gives the builder a working password login with the builder claim', async () => {
    expect(summary.builder).toEqual({ email: 'builder@demo.test', password: 'demo1234' });
    const user = await auth.getUserByEmail(summary.builder.email);
    expect(user.customClaims).toEqual({ role: 'builder' });

    const res = await fetch(
      `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...summary.builder, returnSecureToken: true }),
      },
    );
    expect(res.status).toBe(200);
  });

  it('gives demo codes that behave as labelled', async () => {
    expect((await redeem(summary.codes.used)).status).toBe(409);
    expect((await redeem(summary.codes.expired)).status).toBe(410);
    expect((await redeem(summary.codes.invalid)).status).toBe(404);
    expect((await redeem(summary.codes.valid)).status).toBe(200);
  });

  it('wipes and gives the same result when run again', async () => {
    // The previous test redeemed the valid code, so there are 7 buyers right now.
    expect(await count('members')).toBe(7);

    const again = await runSeed({ db, auth, now });
    expect(again).toEqual(summary);
    expect(await snapshotCounts()).toEqual({
      towers: 3,
      units: 240,
      invites: 240,
      notices: 55,
      pinned: 4,
      members: 6,
      users: 7,
    });
    expect((await redeem(summary.codes.valid)).status).toBe(200);
  }, SEED_TIMEOUT);
});
