/**
 * Phase 10 check against the emulators (run `npm run emulators`, `npm run seed` and the API first):
 *   npx tsx apps/mobile/scripts/feed-check.ts
 * Signs in as real buyers through the redeem API, then drives the app's own feed query and
 * feed model: targeting, order, paging to the end, totals, live arrival, and read receipts.
 */
import { compareNotices, FEED_PAGE_SIZE, type Notice } from '@gatehood/shared';
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithCustomToken, signInWithEmailAndPassword } from 'firebase/auth';
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  type DocumentSnapshot,
  type Firestore,
} from 'firebase/firestore';

import type { FeedFilter } from '../src/features/feed/cacheFormat';
import {
  applyFirstPage,
  applyNextPage,
  cursorForMore,
  hasMore,
  initialModel,
  itemsOf,
  type Entry,
  type FeedModel,
} from '../src/features/feed/model';
import { feedCountQuery, feedQuery, filterKeys, toNotice } from '../src/features/feed/queries';

const API = process.env.API_URL ?? 'http://127.0.0.1:4000';
let failures = 0;
function check(ok: boolean, what: string): void {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failures++;
}

async function post<T>(path: string, body: unknown, token?: string): Promise<{ status: number; data: T }> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: (await res.json()) as T };
}

function client(name: string) {
  const app = initializeApp({ apiKey: 'demo-key', projectId: 'demo-gatehood' }, name);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  return { auth, db };
}

async function buyer(name: string, code: string) {
  const c = client(name);
  const r = await post<{ token: string }>('/api/invites/redeem', { code });
  if (r.status !== 200) throw new Error(`redeem ${code}: ${r.status} ${JSON.stringify(r.data)}`);
  const { user } = await signInWithCustomToken(c.auth, r.data.token);
  const { claims } = await user.getIdTokenResult();
  return { ...c, uid: user.uid, me: { towerId: String(claims.towerId), unitId: String(claims.unitId) } };
}

const toEntry = (s: DocumentSnapshot): Entry<DocumentSnapshot> => ({ notice: toNotice(s.id, s.data() ?? {}), cursor: s });

async function pageToEnd(db: Firestore, filter: FeedFilter, keys: string[]) {
  let m: FeedModel<DocumentSnapshot> = initialModel();
  const first = await getDocs(feedQuery(db, filter, keys));
  m = applyFirstPage(m, first.docs.map(toEntry), false);
  const pageSizes = [first.size];
  while (hasMore(m)) {
    const next = await getDocs(feedQuery(db, filter, keys, cursorForMore(m)));
    pageSizes.push(next.size);
    m = applyNextPage(m, next.docs.map(toEntry));
  }
  return { items: itemsOf(m), pageSizes };
}

function sortedOk(items: Notice[]): boolean {
  return items.every((n, i) => i === 0 || compareNotices(items[i - 1]!, n) <= 0);
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const { initializeApp: initAdmin } = await import('firebase-admin/app');
  const { getFirestore: adminFirestore } = await import('firebase-admin/firestore');
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
  const adminApp = initAdmin({ projectId: 'demo-gatehood' }, 'admin');
  const adb = adminFirestore(adminApp);
  const freeCode = async (tower: string) =>
    (await adb.collection('invites').where('towerId', '==', tower).where('usedBy', '==', null).limit(1).get()).docs[0]!.id;

  const a = await buyer('a', await freeCode('A'));
  const b = await buyer('b', await freeCode('B'));
  console.log(`Buyer A ${a.me.unitId}, buyer B ${b.me.unitId}`);

  // Every notice, from the server's side, to know what each buyer should see.
  const all = (await adb.collection('notices').get()).docs.map((d) => toNotice(d.id, d.data()));

  for (const filter of ['all', 'tower', 'unit'] as const) {
    const keys = filterKeys(filter, a.me);
    const expected = all.filter((n) => n.audience.some((k) => keys.includes(k)));
    const { items, pageSizes } = await pageToEnd(a.db, filter, keys);
    const count = (await getCountFromServer(feedCountQuery(a.db, filter, keys))).data().count;
    check(items.every((n) => n.audience.some((k) => keys.includes(k))), `${filter}: only notices meant for ${a.me.unitId}`);
    check(items.length === expected.length && count === expected.length, `${filter}: all ${expected.length} reached by paging; count says ${count}`);
    check(new Set(items.map((n) => n.id)).size === items.length, `${filter}: no duplicates`);
    check(sortedOk(items), `${filter}: pinned first, then newest`);
    check(pageSizes.slice(0, -1).every((s) => s === FEED_PAGE_SIZE), `${filter}: pages ${pageSizes.join('+')}`);
  }
  const allKeys = filterKeys('all', a.me);
  const firstAll = (await pageToEnd(a.db, 'all', allKeys)).items;
  check(firstAll.filter((n) => n.pinned).length > 0 && firstAll[0]!.pinned, 'all: pinned notices on top');

  // A guessed notice outside the buyer's audience is denied by the rules.
  const foreign = all.find((n) => !n.audience.some((k) => allKeys.includes(k)));
  if (foreign) {
    const denied = await getDoc(doc(a.db, 'notices', foreign.id)).then(() => false, () => true);
    check(denied, `direct read of another tower's notice is denied (${foreign.target.type})`);
  }

  // Live: watch both buyers' first pages, then post a Tower A notice as the builder.
  const watch = (db: Firestore, me: { towerId: string; unitId: string }) => {
    const state = { m: initialModel<DocumentSnapshot>() };
    const stop = onSnapshot(feedQuery(db, 'all', filterKeys('all', me)), { includeMetadataChanges: true }, (s) => {
      state.m = applyFirstPage(state.m, s.docs.map(toEntry), s.metadata.fromCache);
    });
    return { state, stop };
  };
  const wa = watch(a.db, a.me);
  const wb = watch(b.db, b.me);
  await wait(1500);
  check(wa.state.m.serverSeen && wa.state.m.newCount === 0, 'live: first server snapshot is the baseline (0 new)');

  const builder = client('builder');
  const bu = await signInWithEmailAndPassword(builder.auth, 'builder@demo.test', 'demo1234');
  const title = `Tower A water tank cleaning ${Date.now()}`;
  const posted = await post<{ id?: string }>(
    '/api/builder/notices',
    { title, body: 'No water 10am to 1pm.', target: { type: 'towers', towers: ['A'] }, pinned: false },
    await bu.user.getIdToken(),
  );
  check(posted.status === 200 || posted.status === 201, `builder posted a Tower A notice (${posted.status})`);
  await wait(2000);
  const aItems = itemsOf(wa.state.m);
  const newOne = aItems.find((n) => n.title === title);
  check(!!newOne && wa.state.m.newCount === 1, `live: Tower A buyer sees it with "1 new update" (newCount ${wa.state.m.newCount})`);
  check(!itemsOf(wb.state.m).some((n) => n.title === title) && wb.state.m.newCount === 0, 'live: Tower B buyer never sees it');
  wa.stop();
  wb.stop();

  // Read receipts: mark read through the API, twice, and watch the buyer's own reads list.
  if (newOne) {
    let readIds = new Set<string>();
    const stopReads = onSnapshot(collection(a.db, 'members', a.uid, 'reads'), (s) => {
      readIds = new Set(s.docs.map((d) => d.id));
    });
    const token = await a.auth.currentUser!.getIdToken();
    const r1 = await post(`/api/notices/${newOne.id}/read`, {}, token);
    const r2 = await post(`/api/notices/${newOne.id}/read`, {}, token);
    await wait(1500);
    const after = (await adb.collection('notices').doc(newOne.id).get()).data()!;
    check(r1.status < 300 && r2.status < 300, `mark read twice is accepted (${r1.status}, ${r2.status})`);
    check(readIds.has(newOne.id), "read shows up in the buyer's members/{uid}/reads listener");
    check(after.readCount === 1, `readCount went up once (${after.readCount})`);
    stopReads();
  }

  // My Unit reads: own unit and tower allowed, someone else's unit denied.
  const own = await getDoc(doc(a.db, 'units', a.me.unitId));
  const tower = await getDoc(doc(a.db, 'towers', a.me.towerId));
  check(own.exists() && tower.exists() && typeof tower.data()!.progressPct === 'number', 'My Unit: own unit and tower readable');
  const other = await getDoc(doc(a.db, 'units', b.me.unitId)).then(() => false, () => true);
  check(other, "My Unit: another buyer's unit is denied");

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
