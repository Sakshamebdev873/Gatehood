import { normalizeInviteCode, RedeemRequest, type RedeemResponse } from '@gatehood/shared';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Auth } from 'firebase-admin/auth';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { depsOf } from '../deps.js';
import { HttpError } from '../errors.js';

/** `invites/{code}` as written by the CSV import. Times are milliseconds since epoch. */
interface InviteDoc {
  unitId: string;
  towerId: string;
  name: string;
  phone: string;
  expiresAt: number;
  usedBy?: string;
  usedAt?: number;
}

export interface Redeemed {
  uid: string;
  /** Custom token; the app passes it to `signInWithCustomToken`. */
  token: string;
  unitId: string;
  towerId: string;
  name: string;
}

const invalid = () =>
  new HttpError(404, 'invalid_code', "We couldn't find that code. Check it against your welcome letter and try again.");
const used = () =>
  new HttpError(409, 'code_used', 'This code was already used on another phone. Ask the site office for a fresh code.');
const expired = () =>
  new HttpError(410, 'code_expired', 'This code has expired. Ask the site office for a fresh code.');

/**
 * Turns an invite code into a buyer login linked to their unit.
 * The invite is claimed in a transaction, so two phones racing for one code get one winner.
 * If the login can't be created afterwards, the claim is undone so the code isn't wasted.
 */
export async function redeemInvite(db: Firestore, auth: Auth, rawCode: string, now: Date): Promise<Redeemed> {
  const code = normalizeInviteCode(rawCode);
  if (!code) throw invalid();

  const inviteRef = db.collection('invites').doc(code);
  const memberRef = db.collection('members').doc();
  const uid = memberRef.id;
  const at = now.getTime();

  const invite = await db.runTransaction(async (tx) => {
    const snap = await tx.get(inviteRef);
    if (!snap.exists) throw invalid();
    const data = snap.data() as InviteDoc;
    if (data.usedBy) throw used();
    if (typeof data.expiresAt === 'number' && data.expiresAt <= at) throw expired();

    tx.update(inviteRef, { usedBy: uid, usedAt: at });
    tx.create(memberRef, { role: 'buyer', unitId: data.unitId, towerId: data.towerId, name: data.name, joinedAt: at });
    return data;
  });

  const claims = { role: 'buyer', towerId: invite.towerId, unitId: invite.unitId };
  try {
    await auth.createUser({ uid, displayName: invite.name });
    await auth.setCustomUserClaims(uid, claims);
    const token = await auth.createCustomToken(uid, claims);
    return { uid, token, unitId: invite.unitId, towerId: invite.towerId, name: invite.name };
  } catch (err) {
    await undoRedeem(db, auth, code, uid).catch((undoErr: unknown) => {
      console.error(`Could not undo redeem of ${code} for ${uid}`, undoErr);
    });
    throw err;
  }
}

async function undoRedeem(db: Firestore, auth: Auth, code: string, uid: string): Promise<void> {
  // The account may exist if a later step failed. Whatever happens here, still free the code below.
  try {
    await auth.deleteUser(uid);
  } catch {
    // Not found, or auth is down: an orphan account with no member doc can't read anything.
  }

  const inviteRef = db.collection('invites').doc(code);
  const memberRef = db.collection('members').doc(uid);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(inviteRef);
    if (snap.get('usedBy') === uid) {
      tx.update(inviteRef, { usedBy: FieldValue.delete(), usedAt: FieldValue.delete() });
    }
    tx.delete(memberRef);
  });
}

export function invitesRouter(options: { rateLimit: boolean }): Router {
  const router = Router();

  if (options.rateLimit) {
    router.use(
      '/redeem',
      rateLimit({
        windowMs: 60_000,
        limit: 10,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        handler: (_req, _res, next) => {
          next(new HttpError(429, 'rate_limited', 'Too many tries. Wait a minute and try again.'));
        },
      }),
    );
  }

  router.post('/redeem', async (req, res) => {
    const { code } = RedeemRequest.parse(req.body);
    const { db, auth, now } = depsOf(req);
    const { token } = await redeemInvite(db, auth, code, now());
    const body: RedeemResponse = { token };
    res.json(body);
  });

  return router;
}
