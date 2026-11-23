import type { Auth } from 'firebase-admin/auth';
import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { initAdmin } from '../src/firebase.js';
import { redeemInvite } from '../src/routes/invites.js';
import { clearAuth, clearFirestore, exchangeCustomToken, makeApp } from './helpers.js';

const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-11-20T10:00:00Z');
const { db, auth } = initAdmin();

let app: Express;

function invite(overrides: Record<string, unknown> = {}) {
  return {
    unitId: 'A-1204',
    towerId: 'A',
    name: 'Priya Sharma',
    phone: '9800000000',
    expiresAt: now.getTime() + 10 * DAY,
    ...overrides,
  };
}

function claimsOf(idToken: string): Record<string, unknown> {
  const payload = idToken.split('.')[1] ?? '';
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
}

const redeem = (code: unknown) => request(app).post('/api/invites/redeem').send({ code });

beforeEach(async () => {
  await Promise.all([clearFirestore(), clearAuth()]);
  await Promise.all([
    db.doc('invites/A1204-7KQ').set(invite()),
    db.doc('invites/A0801-USD').set(
      invite({ unitId: 'A-0801', name: 'Ravi Kumar', usedBy: 'someone', usedAt: now.getTime() - DAY }),
    ),
    db.doc('invites/B0302-EXP').set(
      invite({ unitId: 'B-0302', towerId: 'B', name: 'Meera Iyer', expiresAt: now.getTime() - DAY }),
    ),
  ]);
  app = makeApp(now);
});

describe('POST /api/invites/redeem', () => {
  it('redeems a loosely typed valid code and signs the buyer in with unit claims', async () => {
    const res = await redeem(' a1204 7kq ');
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');

    const idToken = await exchangeCustomToken(res.body.token);
    const claims = claimsOf(idToken);
    expect(claims).toMatchObject({ role: 'buyer', towerId: 'A', unitId: 'A-1204' });

    const uid = claims.user_id as string;
    const member = await db.doc(`members/${uid}`).get();
    expect(member.data()).toEqual({
      role: 'buyer',
      unitId: 'A-1204',
      towerId: 'A',
      name: 'Priya Sharma',
      joinedAt: now.getTime(),
    });

    const inv = (await db.doc('invites/A1204-7KQ').get()).data();
    expect(inv?.usedBy).toBe(uid);
    expect(inv?.usedAt).toBe(now.getTime());
  });

  it('gives 404 invalid_code for an unknown code', async () => {
    const res = await redeem('Z9999-AAA');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('invalid_code');
  });

  it('gives 404 invalid_code for text that cannot be a code', async () => {
    const res = await redeem('hello');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('invalid_code');
  });

  it('gives 400 bad_request when code is missing', async () => {
    const res = await request(app).post('/api/invites/redeem').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('bad_request');
  });

  it('gives 409 code_used for a used code', async () => {
    const res = await redeem('A0801-USD');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('code_used');
  });

  it('gives 410 code_expired, judged by the server clock', async () => {
    const res = await redeem('B0302-EXP');
    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe('code_expired');

    // The same code is fine for a server whose clock is two days earlier.
    const earlier = makeApp(new Date(now.getTime() - 2 * DAY));
    const ok = await request(earlier).post('/api/invites/redeem').send({ code: 'B0302-EXP' });
    expect(ok.status).toBe(200);
  });

  it('lets exactly one of two simultaneous redeems of the same code win', async () => {
    const [a, b] = await Promise.all([redeem('A1204-7KQ'), redeem('A1204-7KQ')]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);

    const members = await db.collection('members').get();
    expect(members.size).toBe(1);
  });

  it('a code cannot be redeemed again after it succeeds', async () => {
    expect((await redeem('A1204-7KQ')).status).toBe(200);
    const again = await redeem('a1204-7kq');
    expect(again.status).toBe(409);
  });

  it('gives 429 rate_limited on the 11th try in a minute', async () => {
    const limited = makeApp(now, { rateLimit: true });
    for (let i = 0; i < 10; i++) {
      const res = await request(limited).post('/api/invites/redeem').send({ code: 'Z9999-AAA' });
      expect(res.status).toBe(404);
    }
    const res = await request(limited).post('/api/invites/redeem').send({ code: 'A1204-7KQ' });
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('rate_limited');
  });
});

describe('redeemInvite', () => {
  it('puts the code back if creating the login account fails', async () => {
    const failingAuth = {
      createUser: async () => {
        throw new Error('auth is down');
      },
    } as unknown as Auth;

    await expect(redeemInvite(db, failingAuth, 'A1204-7KQ', now)).rejects.toThrow('auth is down');

    const inv = (await db.doc('invites/A1204-7KQ').get()).data();
    expect(inv?.usedBy).toBeUndefined();
    expect(inv?.usedAt).toBeUndefined();
    expect((await db.collection('members').get()).size).toBe(0);

    // The code still works afterwards.
    const ok = await redeemInvite(db, auth, 'A1204-7KQ', now);
    expect(ok.unitId).toBe('A-1204');
  });
});
