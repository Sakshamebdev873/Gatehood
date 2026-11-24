import { applicationDefault, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

export interface Admin {
  db: Firestore;
  auth: Auth;
}

export const DEFAULT_PROJECT_ID = 'demo-gatehood';

/**
 * A demo-* project only exists on the emulators, so with no emulator hosts set
 * (no .env at all, say) point at the local emulators instead of failing on credentials.
 */
export function useDemoEmulators(env: NodeJS.ProcessEnv = process.env): void {
  const projectId = env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID;
  if (!projectId.startsWith('demo-')) return;
  if (env.FIRESTORE_EMULATOR_HOST || env.FIREBASE_AUTH_EMULATOR_HOST) return;
  env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
}

/**
 * Connects firebase-admin once per process.
 * - Emulators: when FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST are set. No credentials needed.
 * - Real project: otherwise, using application default credentials (GOOGLE_APPLICATION_CREDENTIALS).
 */
export function initAdmin(): Admin {
  const app = getApps()[0] ?? connect();
  return { db: getFirestore(app), auth: getAuth(app) };
}

function connect(): App {
  useDemoEmulators();
  const projectId = process.env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID;
  const firestoreEmu = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
  const authEmu = Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST);

  // Half-emulated would mean real logins against fake data (or the reverse). Refuse it.
  if (firestoreEmu !== authEmu) {
    throw new Error(
      'Set both FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST to use the emulators, or neither to use a real project.',
    );
  }
  if (firestoreEmu) return initializeApp({ projectId });
  return initializeApp({ projectId, credential: applicationDefault() });
}
