import { describe, expect, it } from 'vitest';
import { useDemoEmulators } from '../src/firebase.js';

describe('useDemoEmulators', () => {
  it('points a demo-* project with no hosts at the local emulators', () => {
    const env: NodeJS.ProcessEnv = {};
    useDemoEmulators(env);
    expect(env.FIRESTORE_EMULATOR_HOST).toBe('127.0.0.1:8080');
    expect(env.FIREBASE_AUTH_EMULATOR_HOST).toBe('127.0.0.1:9099');
  });

  it('treats a missing project id as the demo project', () => {
    const env: NodeJS.ProcessEnv = { FIREBASE_PROJECT_ID: '' };
    useDemoEmulators(env);
    expect(env.FIRESTORE_EMULATOR_HOST).toBe('127.0.0.1:8080');
  });

  it('leaves hosts that are already set alone', () => {
    const env: NodeJS.ProcessEnv = { FIRESTORE_EMULATOR_HOST: '10.0.0.5:8080' };
    useDemoEmulators(env);
    expect(env).toEqual({ FIRESTORE_EMULATOR_HOST: '10.0.0.5:8080' });
  });

  it('never touches a real project', () => {
    const env: NodeJS.ProcessEnv = { FIREBASE_PROJECT_ID: 'gatehood-9ef1e' };
    useDemoEmulators(env);
    expect(env).toEqual({ FIREBASE_PROJECT_ID: 'gatehood-9ef1e' });
  });
});
