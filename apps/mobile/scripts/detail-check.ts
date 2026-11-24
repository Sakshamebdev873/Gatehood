/**
 * Phase 11 check against the emulators (run `npm run emulators`, `npm run seed` and the API first):
 *   npx tsx apps/mobile/scripts/detail-check.ts
 * Drives the notice screen's data path as a real buyer: the direct read it shows, the
 * "isn't available" cases, and that opening a notice (twice, by two buyers) counts each buyer once.
 */
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithCustomToken } from 'firebase/auth';
import { connectFirestoreEmulator, doc, getDoc, getFirestore } from 'firebase/firestore';

import { isGoneError } from '../src/features/feed/noticeLoad';
import { filterKeys, toNotice } from '../src/features/feed/queries';

const API = process.env.API_URL ?? 'http://127.0.0.1:4000';
let failures = 0;
function check(ok: boolean, what: string): void {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failures++;
}

async function post(path: string, body: unknown, token?: string): Promise<{ status: number; data: unknown }> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

async function buyer(name: string, code: string) {
  const app = initializeApp({ apiKey: 'demo-key', projectId: 'demo-gatehood' }, name);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const r = await post('/api/invites/redeem', { code });
  if (r.status !== 200) throw new Error(`redeem ${code}: ${r.status} ${JSON.stringify(r.data)}`);
  const { user } = await signInWithCustomToken(auth, (r.data as { token: string }).token);
  const { claims } = await user.getIdTokenResult();
  const me = { towerId: String(claims.towerId), unitId: String(claims.unitId) };
  /** What the notice screen does on open: getDoc, then markRead → POST /read. */
  const open = async (id: string) => {
    const snap = await getDoc(doc(db, 'notices', id));
    const read = await post(`/api/notices/${encodeURIComponent(id)}/read`, {}, await user.getIdToken());
    return { snap, read };
  };
  const tryRead = (id: string) => getDoc(doc(db, 'notices', id)).then(() => null, (err: unknown) => err);
  return { uid: user.uid, me, open, tryRead, token: () => user.getIdToken() };
}

async function main() {
  const { initializeApp: initAdmin } = await import('firebase-admin/app');
  const { getFirestore: adminFirestore } = await import('firebase-admin/firestore');
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
  const adb = adminFirestore(initAdmin({ projectId: 'demo-gatehood' }, 'admin'));
  const freeCode = async (tower: string) =>
    (await adb.collection('invites').where('towerId', '==', tower).where('usedBy', '==', null).limit(1).get()).docs[0]!.id;
  const readCount = async (id: string) => ((await adb.collection('notices').doc(id).get()).data()?.readCount as number) ?? 0;

  const a = await buyer('a', await freeCode('A'));
  const b = await buyer('b', await freeCode('B'));
  console.log(`Buyer A ${a.me.unitId}, buyer B ${b.me.unitId}`);

  const all = (await adb.collection('notices').get()).docs.map((d) => toNotice(d.id, d.data()));
  const aKeys = filterKeys('all', a.me);
  const forEveryone = all.find((n) => n.target.type === 'all');
  const foreign = all.find((n) => !n.audience.some((k) => aKeys.includes(k)));
  if (!forEveryone || !foreign) throw new Error('seed has no all-towers notice or no notice outside Tower A');

  // Open it: the screen's direct read works and has the full text.
  const before = await readCount(forEveryone.id);
  const first = await a.open(forEveryone.id);
  const shown = first.snap.exists() ? toNotice(first.snap.id, first.snap.data()) : null;
  check(!!shown && shown.title === forEveryone.title && shown.body.length > 0, `opens "${forEveryone.title}" with its full text`);
  check(first.read.status < 300, `opening marks it read (${first.read.status})`);
  check((await readCount(forEveryone.id)) === before + 1, `readCount ${before} → ${before + 1} after the first open`);

  // Open it again (and a retry, as after a dropped connection): still counted once.
  await a.open(forEveryone.id);
  await a.open(forEveryone.id);
  check((await readCount(forEveryone.id)) === before + 1, `opened 3 times by one buyer: still ${before + 1}`);
  const receipt = await adb.collection('members').doc(a.uid).collection('reads').doc(forEveryone.id).get();
  check(receipt.exists, "receipt written under the buyer's members/{uid}/reads");

  // A second buyer counts once more.
  await b.open(forEveryone.id);
  check((await readCount(forEveryone.id)) === before + 2, `a second buyer adds exactly one (${before + 2})`);

  // "This update isn't available.": someone else's notice, and an id that doesn't exist.
  const denied = await a.tryRead(foreign.id);
  check(denied !== null && isGoneError(denied), `another tower's notice reads as gone (${(denied as { code?: string })?.code})`);
  const missing = await a.tryRead('no-such-notice-0000');
  check(missing === null || isGoneError(missing), `a guessed id reads as gone (${(missing as { code?: string })?.code ?? 'not found'})`);
  const foreignBefore = await readCount(foreign.id);
  const foreignRead = await post(`/api/notices/${foreign.id}/read`, {}, await a.token());
  check(foreignRead.status === 403, `marking another tower's notice read is refused (${foreignRead.status})`);
  check((await readCount(foreign.id)) === foreignBefore, 'and its readCount is unchanged');

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
