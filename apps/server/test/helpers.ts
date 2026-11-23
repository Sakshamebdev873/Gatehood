import type { Express } from 'express';
import { createApp, type AppOptions } from '../src/app.js';
import { initAdmin } from '../src/firebase.js';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? 'demo-gatehood';
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';

/** Builds the app against the emulators. Pass `now` to pin the clock. */
export function makeApp(now?: Date, options: AppOptions = {}): Express {
  return createApp({ ...initAdmin(), ...(now ? { now: () => now } : {}) }, options);
}

/** Deletes every document in the Firestore emulator. */
export async function clearFirestore(): Promise<void> {
  const res = await fetch(
    `http://${FIRESTORE_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  if (!res.ok) throw new Error(`clearFirestore failed: ${res.status}`);
}

/** Deletes every user in the Auth emulator. */
export async function clearAuth(): Promise<void> {
  const res = await fetch(`http://${AUTH_HOST}/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`clearAuth failed: ${res.status}`);
}

/** Creates (or reuses) an emulator user with these claims and returns a real ID token for it. */
export async function idTokenFor(uid: string, claims: Record<string, unknown>): Promise<string> {
  const { auth } = initAdmin();
  try {
    await auth.createUser({ uid });
  } catch (err) {
    if ((err as { code?: string }).code !== 'auth/uid-already-exists') throw err;
  }
  await auth.setCustomUserClaims(uid, claims);
  return exchangeCustomToken(await auth.createCustomToken(uid, claims));
}

/** Swaps a custom token for an ID token at the Auth emulator, the way the app's sign-in does. */
export async function exchangeCustomToken(customToken: string): Promise<string> {
  const res = await fetch(
    `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  const json = (await res.json()) as { idToken?: string };
  if (!res.ok || !json.idToken) throw new Error(`signInWithCustomToken failed: ${res.status}`);
  return json.idToken;
}
