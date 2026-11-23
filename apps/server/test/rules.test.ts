import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  type Firestore,
} from 'firebase/firestore';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const rulesPath = fileURLToPath(new URL('../../../firebase/firestore.rules', import.meta.url));

let env: RulesTestEnvironment;

// rules-unit-testing hands back the compat Firestore type; the modular API works on it at runtime.
function modular(ctx: RulesTestContext): Firestore {
  return ctx.firestore() as unknown as Firestore;
}

const buyerClaims = { role: 'buyer', towerId: 'A', unitId: 'A-1204' };
const buyerKeys = ['all', 'tower:A', 'unit:A-1204'];

function feed(db: Firestore, filter: ReturnType<typeof where>) {
  return query(collection(db, 'notices'), filter, orderBy('pinned', 'desc'), orderBy('createdAt', 'desc'), limit(15));
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-gatehood',
    firestore: { rules: readFileSync(rulesPath, 'utf8'), host: '127.0.0.1', port: 8080 },
  });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = modular(ctx);
    const notice = (audience: string[], createdAt: number) => ({
      title: 't',
      body: 'b',
      pinned: false,
      createdAt,
      target: { type: 'all' },
      audience,
      readCount: 0,
    });
    await setDoc(doc(db, 'notices/n1'), notice(['all'], 1));
    await setDoc(doc(db, 'notices/n2'), notice(['tower:B'], 2));
    await setDoc(doc(db, 'notices/n3'), notice(['unit:A-1204'], 3));
    await setDoc(doc(db, 'notices/n1/reads/u1'), { unitId: 'A-1204', towerId: 'A', readAt: 1 });
    await setDoc(doc(db, 'units/A-1204'), { towerId: 'A', number: '1204', config: '3BHK' });
    await setDoc(doc(db, 'units/A-0302'), { towerId: 'A', number: '0302', config: '2BHK' });
    await setDoc(doc(db, 'towers/A'), { name: 'Tower A', progressPct: 60 });
    await setDoc(doc(db, 'invites/A1204-7KQ'), { unitId: 'A-1204', towerId: 'A', name: 'Ravi', phone: '9876543210' });
    await setDoc(doc(db, 'members/u1'), { role: 'buyer', unitId: 'A-1204', towerId: 'A', name: 'Ravi' });
    await setDoc(doc(db, 'members/u2'), { role: 'buyer', unitId: 'B-0302', towerId: 'B', name: 'Arjun' });
    await setDoc(doc(db, 'members/u1/reads/n1'), { readAt: 1 });
    await setDoc(doc(db, 'members/u2/reads/n1'), { readAt: 1 });
  });
});

afterAll(async () => {
  await env?.cleanup();
});

describe('buyer in A-1204', () => {
  const db = () => modular(env.authenticatedContext('u1', buyerClaims));

  it('can run the All feed query (array-contains-any) and gets only their notices', async () => {
    const snap = await assertSucceeds(getDocs(feed(db(), where('audience', 'array-contains-any', buyerKeys))));
    expect(snap.docs.map((d) => d.id)).toEqual(['n3', 'n1']);
  });
  it('can run the My tower feed query', async () => {
    await assertSucceeds(getDocs(feed(db(), where('audience', 'array-contains', 'tower:A'))));
  });
  it('can run the My unit feed query', async () => {
    await assertSucceeds(getDocs(feed(db(), where('audience', 'array-contains', 'unit:A-1204'))));
  });
  it('can read notices meant for them', async () => {
    await assertSucceeds(getDoc(doc(db(), 'notices/n1')));
    await assertSucceeds(getDoc(doc(db(), 'notices/n3')));
  });
  it('cannot read a Tower B notice', async () => {
    await assertFails(getDoc(doc(db(), 'notices/n2')));
  });
  it('cannot query another tower', async () => {
    await assertFails(getDocs(feed(db(), where('audience', 'array-contains', 'tower:B'))));
  });
  it('cannot list notices without an audience filter', async () => {
    await assertFails(getDocs(query(collection(db(), 'notices'))));
  });
  it('cannot read notice read lists', async () => {
    await assertFails(getDoc(doc(db(), 'notices/n1/reads/u1')));
    await assertFails(getDocs(collection(db(), 'notices/n1/reads')));
  });
  it('can read their own unit but not another', async () => {
    await assertSucceeds(getDoc(doc(db(), 'units/A-1204')));
    await assertFails(getDoc(doc(db(), 'units/A-0302')));
  });
  it('can read towers', async () => {
    await assertSucceeds(getDoc(doc(db(), 'towers/A')));
  });
  it('cannot read invites', async () => {
    await assertFails(getDoc(doc(db(), 'invites/A1204-7KQ')));
    await assertFails(getDocs(collection(db(), 'invites')));
  });
  it('can read their own member doc and receipts, not anyone else’s', async () => {
    await assertSucceeds(getDoc(doc(db(), 'members/u1')));
    await assertSucceeds(getDoc(doc(db(), 'members/u1/reads/n1')));
    await assertSucceeds(getDocs(collection(db(), 'members/u1/reads')));
    await assertFails(getDoc(doc(db(), 'members/u2')));
    await assertFails(getDoc(doc(db(), 'members/u2/reads/n1')));
  });
  it('cannot write anything', async () => {
    await assertFails(setDoc(doc(db(), 'notices/x'), {}));
    await assertFails(updateDoc(doc(db(), 'notices/n1'), { readCount: 99 }));
    await assertFails(setDoc(doc(db(), 'members/u1/reads/n1'), {}));
    await assertFails(setDoc(doc(db(), 'notices/n1/reads/u1'), {}));
    await assertFails(setDoc(doc(db(), 'members/u1'), { role: 'builder' }));
    await assertFails(deleteDoc(doc(db(), 'units/A-1204')));
  });
});

describe('builder', () => {
  const db = () => modular(env.authenticatedContext('b1', { role: 'builder' }));

  it('can read everything', async () => {
    await assertSucceeds(getDoc(doc(db(), 'notices/n2')));
    await assertSucceeds(getDocs(query(collection(db(), 'notices'), orderBy('createdAt', 'desc'))));
    await assertSucceeds(getDoc(doc(db(), 'invites/A1204-7KQ')));
    await assertSucceeds(getDocs(collection(db(), 'invites')));
    await assertSucceeds(getDoc(doc(db(), 'notices/n1/reads/u1')));
    await assertSucceeds(getDoc(doc(db(), 'units/A-0302')));
    await assertSucceeds(getDoc(doc(db(), 'members/u2')));
    await assertSucceeds(getDoc(doc(db(), 'members/u2/reads/n1')));
  });
  it('cannot write anything', async () => {
    await assertFails(setDoc(doc(db(), 'notices/x'), {}));
    await assertFails(updateDoc(doc(db(), 'notices/n1'), { pinned: true }));
    await assertFails(setDoc(doc(db(), 'invites/X'), {}));
    await assertFails(setDoc(doc(db(), 'towers/Z'), {}));
    await assertFails(deleteDoc(doc(db(), 'notices/n1')));
  });
});

describe('signed out', () => {
  const db = () => modular(env.unauthenticatedContext());

  it('cannot read anything', async () => {
    await assertFails(getDoc(doc(db(), 'towers/A')));
    await assertFails(getDoc(doc(db(), 'notices/n1')));
    await assertFails(getDoc(doc(db(), 'units/A-1204')));
  });
});

describe('a signed-in user with no role', () => {
  const db = () => modular(env.authenticatedContext('x', {}));

  it('cannot read notices or units', async () => {
    await assertFails(getDoc(doc(db(), 'notices/n1')));
    await assertFails(getDoc(doc(db(), 'units/A-1204')));
  });
});
