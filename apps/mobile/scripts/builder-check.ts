/**
 * Phase 12 check against the emulators (run `npm run emulators`, `npm run seed` and the API first):
 *   npx tsx apps/mobile/scripts/builder-check.ts
 * Makes the builder screens' exact calls, and the buyer side's, for the phase's two-phone run:
 * import sample/buyers.csv, join with a new code, post to Tower A only, read it, pin it.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  parseBuyersCsv,
  type BuyersResponse,
  type ImportResult,
  type NoticeStats,
  type OverviewResponse,
} from '@gatehood/shared';
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithCustomToken, signInWithEmailAndPassword } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  type Firestore,
} from 'firebase/firestore';

import { buildNoticeRequest } from '../src/features/builder/logic';
import { builderNoticesQuery } from '../src/features/builder/queries';
import { feedQuery, filterKeys, toNotice } from '../src/features/feed/queries';

const API = process.env.API_URL ?? 'http://127.0.0.1:4000';
let failures = 0;
function check(ok: boolean, what: string): void {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failures++;
}

type Res<T> = { status: number; data: T };
async function call<T>(method: string, path: string, token?: string, body?: unknown): Promise<Res<T>> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, data: (await res.json().catch(() => null)) as T };
}

let apps = 0;
function client(): { auth: ReturnType<typeof getAuth>; db: Firestore } {
  const app = initializeApp({ apiKey: 'demo-key', projectId: 'demo-gatehood' }, `c${apps++}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  return { auth, db };
}

async function buyer(code: string) {
  const { auth, db } = client();
  const r = await call<{ token: string }>('POST', '/api/invites/redeem', undefined, { code });
  if (r.status !== 200) throw new Error(`redeem ${code}: ${r.status} ${JSON.stringify(r.data)}`);
  const { user } = await signInWithCustomToken(auth, r.data.token);
  const { claims } = await user.getIdTokenResult();
  const me = { towerId: String(claims.towerId), unitId: String(claims.unitId) };
  return { uid: user.uid, me, db, token: () => user.getIdToken() };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(cond: () => boolean, ms = 8000): Promise<boolean> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (cond()) return true;
    await sleep(100);
  }
  return cond();
}

async function main() {
  // Builder signs in the way the builder screen does.
  const b = client();
  const { user } = await signInWithEmailAndPassword(b.auth, 'builder@demo.test', 'demo1234');
  const bt = () => user.getIdToken();

  // 1. Import sample/buyers.csv: the bad row shows in the preview, and the codes come back.
  const csv = readFileSync(resolve(__dirname, '../../../sample/buyers.csv'), 'utf8');
  const preview = parseBuyersCsv(csv);
  check(preview.errors.some((e) => /phone/i.test(e.reason)), `preview lists the bad row: ${JSON.stringify(preview.errors)}`);
  const before = await call<OverviewResponse>('GET', '/api/builder/overview', await bt());
  const imp = await call<ImportResult>('POST', '/api/builder/import', await bt(), { csv });
  check(imp.status === 200, `import → 200 (got ${imp.status})`);
  check(imp.data.created === preview.rows.length, `created ${imp.data.created} = ${preview.rows.length} valid rows`);
  check(imp.data.invites.length === imp.data.created && imp.data.invites.every((i) => /^[A-Z]+\d{4,6}-[A-Z2-9]{3}$/.test(i.code)), 'every new buyer has a code');
  check(imp.data.errors.some((e) => /phone/i.test(e.reason)), 'the server reports the same bad row');
  const again = await call<ImportResult>('POST', '/api/builder/import', await bt(), { csv });
  check(again.data.created === 0 && again.data.skipped === preview.rows.length, 'importing the same file again skips everyone');

  // Buyers tab: the new codes are listed as Pending, filterable by tower.
  const listA = await call<BuyersResponse>('GET', '/api/builder/buyers?tower=A', await bt());
  const codeA = imp.data.invites.find((i) => i.unitId.startsWith('A-'))!.code;
  const codeB = imp.data.invites.find((i) => i.unitId.startsWith('B-'))!.code;
  check(listA.data.buyers.every((x) => x.towerId === 'A'), 'Buyers filtered to Tower A only lists Tower A');
  check(listA.data.buyers.find((x) => x.code === codeA)?.status === 'pending', `${codeA} shows Pending`);

  // 2. Join with a new code on "the second phone": Towers shows that buyer as joined.
  const a = await buyer(codeA);
  const bb = await buyer(codeB);
  const after = await call<OverviewResponse>('GET', '/api/builder/overview', await bt());
  const joinedA = (o: OverviewResponse) => o.towers.find((t) => t.towerId === 'A')!;
  check(joinedA(after.data).joined === joinedA(before.data).joined + 1, `Tower A joined ${joinedA(before.data).joined} → ${joinedA(after.data).joined}`);
  check(joinedA(after.data).invited > joinedA(before.data).invited, 'Tower A invited count went up with the import');
  const listAfter = await call<BuyersResponse>('GET', '/api/builder/buyers?tower=A', await bt());
  check(listAfter.data.buyers.find((x) => x.code === codeA)?.status === 'joined', `${codeA} now shows Joined`);

  // Tower A buyer's live feed is open before the post.
  const liveA: string[] = [];
  const stopA = onSnapshot(feedQuery(a.db, 'all', filterKeys('all', a.me)), (s) => {
    liveA.splice(0, liveA.length, ...s.docs.map((d) => d.id));
  });
  // Builder notices list and stats screen are open too.
  const builderList: { id: string; readCount: number }[] = [];
  const stopList = onSnapshot(builderNoticesQuery(b.db, 15), (s) => {
    builderList.splice(0, builderList.length, ...s.docs.map((d) => toNotice(d.id, d.data())));
  });
  await until(() => liveA.length > 0 && builderList.length > 0);

  // 3. Post a notice to Tower A only, built the way the New notice form builds it.
  const draft = buildNoticeRequest({
    title: 'Water off Thursday, 10am to 2pm',
    body: 'Tower A tanks are being cleaned.',
    pinned: false,
    mode: 'towers',
    towers: ['A'],
    unitsText: '',
  });
  if (!draft.ok) throw new Error('draft did not validate');
  const posted = await call<{ id: string }>('POST', '/api/builder/notices', await bt(), draft.request);
  check(posted.status === 201, `post to Tower A → 201 (got ${posted.status})`);
  const id = posted.data.id;
  check(await until(() => liveA.includes(id)), 'the Tower A buyer sees it live');
  check(await until(() => builderList[0]?.id === id), 'it tops the builder notices list, live');
  const feedB = await getDocs(feedQuery(bb.db, 'all', filterKeys('all', bb.me)));
  check(!feedB.docs.some((d) => d.id === id), "the Tower B buyer's feed doesn't have it");
  const direct = await getDoc(doc(bb.db, 'notices', id)).then(() => 'read', (e: { code?: string }) => e.code);
  check(direct === 'permission-denied', `a direct read by the Tower B buyer is denied (${direct})`);

  // Bad unit targets come back as a readable message, inline on the form.
  const badUnits = buildNoticeRequest({ ...draft.request, pinned: false, mode: 'units', towers: [], unitsText: 'A-1204, 12O4' });
  check(!badUnits.ok && /12O4/.test(badUnits.errors.audience ?? ''), 'a mistyped unit is named on the form');
  const unknownUnit = await call<{ error: { message: string } }>('POST', '/api/builder/notices', await bt(), {
    ...draft.request,
    target: { type: 'units', unitIds: ['A-9999'] },
  });
  check(unknownUnit.status === 400 && /A-9999/.test(unknownUnit.data.error.message), `an unknown unit is refused: "${unknownUnit.data.error.message}"`);

  // 4. Stats: the buyer is in "Not read yet"; they open it; the count goes up and they leave the list.
  const stats = (t: string) => call<NoticeStats>('GET', `/api/builder/notices/${id}/stats`, t);
  const s0 = (await stats(await bt())).data;
  check(s0.readCount === 0 && s0.notRead.some((x) => x.uid === a.uid), `before: 0 read, ${a.me.unitId} not read yet`);
  check(s0.byTower.length === 1 && s0.byTower[0]!.towerId === 'A', 'stats split has only Tower A');
  check(s0.notJoined > 0, `${s0.notJoined} invited but not joined`);
  const watched: number[] = [];
  const stopDoc = onSnapshot(doc(b.db, 'notices', id), (s) => watched.push(Number(s.get('readCount') ?? 0)));
  await call('POST', `/api/notices/${id}/read`, await a.token(), {});
  await call('POST', `/api/notices/${id}/read`, await a.token(), {});
  check(await until(() => watched.at(-1) === 1), 'the stats screen sees readCount 1 live (opened twice, counted once)');
  check(await until(() => builderList.find((n) => n.id === id)?.readCount === 1), 'the notices list shows "1 read" live');
  const s1 = (await stats(await bt())).data;
  check(s1.readCount === 1 && !s1.notRead.some((x) => x.uid === a.uid), 'after: 1 read, the buyer left "Not read yet"');
  check(s1.byTower[0]!.read === 1, 'Tower A bar shows 1 read');

  // 5. Pin it: it moves to the top of the buyer's feed.
  const before5 = (await getDocs(feedQuery(a.db, 'all', filterKeys('all', a.me)))).docs.findIndex((d) => d.id === id);
  const pin = await call('PATCH', `/api/builder/notices/${id}`, await bt(), { pinned: true });
  check(pin.status === 200, 'pin → 200');
  check(await until(() => liveA[0] === id), `pinned, it moves to the top of the buyer's feed (was #${before5 + 1})`);
  await call('PATCH', `/api/builder/notices/${id}`, await bt(), { pinned: false });

  // A buyer can't use the builder endpoints.
  const forbidden = await call('GET', '/api/builder/overview', await a.token());
  check(forbidden.status === 403, `a buyer gets 403 from the builder overview (got ${forbidden.status})`);

  stopA();
  stopList();
  stopDoc();
  console.log(failures === 0 ? '\nAll builder checks passed.' : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
