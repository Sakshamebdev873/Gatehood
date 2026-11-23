import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  initializeAuth,
  // The react-native build of @firebase/auth exports this, but firebase/auth's types don't list it.
  // @ts-expect-error -- present at runtime via the react-native export condition
  getReactNativePersistence,
  type Auth,
  type Persistence,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  type Firestore,
} from 'firebase/firestore';

/**
 * Firebase JS SDK, configured from a "Web" app config (design doc §4.1).
 * Runs in Expo Go on Android and iOS with no native build.
 */
const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'demo-key',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'demo-gatehood',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const useEmulators = process.env.EXPO_PUBLIC_USE_EMULATORS === '1';
const emulatorHost = process.env.EXPO_PUBLIC_EMULATOR_HOST || 'localhost';

const firstInit = getApps().length === 0;

export const app: FirebaseApp = firstInit ? initializeApp(config) : getApp();

const rnPersistence = getReactNativePersistence as (storage: typeof AsyncStorage) => Persistence;

/** Auth with sign-in kept across app restarts via AsyncStorage. */
export const auth: Auth = firstInit
  ? initializeAuth(app, { persistence: rnPersistence(AsyncStorage) })
  : getAuth(app);

/** Long polling is the reliable transport on React Native. */
export const db: Firestore = firstInit
  ? initializeFirestore(app, { experimentalAutoDetectLongPolling: true })
  : getFirestore(app);

// Connect once; Fast Refresh re-runs this module with the app already initialised.
if (useEmulators && firstInit) {
  connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, emulatorHost, 8080);
}
