import {
  audienceForTarget,
  audienceKeysFor,
  generateInviteCode,
  intersects,
  unitIdOf,
  type NoticeTarget,
} from '@gatehood/shared';
import type { Auth } from 'firebase-admin/auth';
import type { DocumentReference, Firestore } from 'firebase-admin/firestore';
import { pathToFileURL } from 'node:url';
import { DEFAULT_PROJECT_ID, initAdmin, useDemoEmulators } from './firebase.js';
import { inviteTtlDays } from './routes/import.js';
import { redeemInvite } from './routes/invites.js';
import { markRead, type Reader } from './routes/notices.js';

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const MAX_BATCH_OPS = 450;
const RANDOM_SEED = 42;

export interface SeedSummary {
  builder: { email: string; password: string };
  codes: { valid: string; used: string; expired: string; invalid: string };
  buyers: { name: string; unitId: string }[];
}

export interface SeedDeps {
  db: Firestore;
  auth: Auth;
  now: Date;
  /** Defaults to mulberry32(42), so every run makes the same codes, names and reads. */
  rand?: () => number;
  /** Defaults to BUILDER_EMAIL / BUILDER_PASSWORD, or the demo login on the emulator. */
  builder?: { email: string; password: string };
}

/** Small seeded PRNG. Returns [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}

// ── Fixed demo data ─────────────────────────────────────────────────────────

const TOWERS = [
  { id: 'A', progressPct: 62, possessionDate: Date.UTC(2028, 0, 15) },
  { id: 'B', progressPct: 48, possessionDate: Date.UTC(2028, 5, 30) },
  { id: 'C', progressPct: 31, possessionDate: Date.UTC(2028, 11, 31) },
];
const FLOORS = 20;
const UNITS_PER_FLOOR = 4;
/** Flat types cycle 2BHK, 3BHK, 3BHK, 4BHK; offset so xx04 is a 3BHK like the mockup's A-1204. */
const LAYOUTS = [
  { config: '2BHK', areaSqft: 1180 },
  { config: '3BHK', areaSqft: 1640 },
  { config: '3BHK', areaSqft: 1640 },
  { config: '4BHK', areaSqft: 2150 },
];
const layoutOf = (position: number) => LAYOUTS[(position + 2) % LAYOUTS.length]!;

/** Buyers who have already joined. Priya's code is reported as the "used" demo code. */
const DEMO_BUYERS = [
  { unitId: 'A-1204', name: 'Priya Sharma' },
  { unitId: 'A-0803', name: 'Ravi Kumar' },
  { unitId: 'A-1601', name: 'Fatima Sheikh' },
  { unitId: 'B-0502', name: 'Arjun Menon' },
  { unitId: 'B-1404', name: 'Kavya Reddy' },
  { unitId: 'C-0904', name: 'Sameer Joshi' },
];
const VALID_UNIT = 'A-1203';
const EXPIRED_UNIT = 'B-0302';
/** Well formed, but unit 9999 doesn't exist, so it can never be issued. */
const INVALID_CODE = 'A9999-XYZ';

const FIRST = ['Aarav', 'Aditi', 'Rahul', 'Sneha', 'Vikram', 'Ishita', 'Karan', 'Neha', 'Rohan', 'Pooja', 'Siddharth',
  'Ananya', 'Manish', 'Divya', 'Nikhil', 'Shreya', 'Amit', 'Kavita', 'Harish', 'Lakshmi', 'Deepak', 'Meera', 'Suresh', 'Tanvi'];
const LAST = ['Mehta', 'Nair', 'Gupta', 'Patel', 'Singh', 'Rao', 'Bose', 'Malhotra', 'Jain', 'Desai', 'Iyer', 'Kapoor',
  'Verma', 'Pillai', 'Chopra', 'Banerjee', 'Kulkarni', 'Agarwal', 'Shetty', 'Mishra'];

const ALL: NoticeTarget = { type: 'all' };
const towers = (...ids: string[]): NoticeTarget => ({ type: 'towers', towers: ids });
const units = (...ids: string[]): NoticeTarget => ({ type: 'units', unitIds: ids });

interface NoticeSpec {
  title: string;
  body: string;
  target: NoticeTarget;
  pinned?: boolean;
}

function weekdayName(d: Date): string {
  return d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
}

/** The first Saturday at least a week after `now`, as "Sat 5 Dec". */
function nextSiteVisitDay(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 7));
  while (d.getUTCDay() !== 6) d.setUTCDate(d.getUTCDate() + 1);
  return `${weekdayName(d)} ${d.getUTCDate()} ${d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })}`;
}

/** 55 notices, oldest first. About half to everyone, a third to towers, the rest to units. */
function noticeSpecs(now: Date): NoticeSpec[] {
  const visit = nextSiteVisitDay(now);
  return [
    { target: ALL, title: 'Welcome to Gatehood updates', body: 'From now on the site office will post construction progress, payment reminders and visit days here. Turn on notifications so nothing gets missed.' },
    { target: towers('A'), title: 'Tower A: 9th floor slab cast', body: 'The 9th floor slab in Tower A was cast on schedule. Curing will run for the next 14 days.' },
    { target: ALL, title: 'Monthly progress report is out', body: 'This month: structure work on track in all three towers, external plumbing started in Tower A. The full report is at the site office.' },
    { target: towers('C'), title: 'Tower C: lift pit excavation complete', body: 'Excavation for both lift pits in Tower C is finished. Waterproofing starts next week.' },
    { target: ALL, title: 'Home loan disbursement: documents needed', body: 'If your bank disbursement is pending, bring the latest demand letter and your allotment letter to the site office. We will sign and stamp it the same day.' },
    { target: towers('B'), title: 'Tower B: shuttering on floors 7 to 9', body: 'Shuttering work has started on floors 7 to 9. Expect crane movement on the east side between 8am and 6pm.' },
    { target: units('A-1204', 'A-1203', 'A-1202'), title: 'Your tile selection window is open', body: 'Floor tile samples for your unit are ready at the experience centre. Please make your choice within 3 weeks so we can place the order.' },
    { target: ALL, title: 'Site office hours this month', body: 'The site office is open Monday to Saturday, 10am to 6pm. On Sundays it is open by appointment only.' },
    { target: towers('A', 'B'), title: 'Water tank cleaning on Sunday', body: 'The temporary overhead tanks for Towers A and B will be cleaned this Sunday. Site washrooms will be closed from 9am to 1pm.' },
    { target: ALL, title: 'Safety drill on site', body: 'A fire safety drill will run on site this week. If you visit, follow the marshals in orange vests.' },
    { target: towers('C'), title: 'Tower C: 3rd floor columns done', body: 'Columns up to the 3rd floor in Tower C are complete. The 4th floor slab is planned for next week.' },
    { target: ALL, title: 'GST on instalments explained', body: 'Several buyers asked about GST on construction-linked instalments. A one-page explainer is now at the site office and on the welcome kit pen drive.' },
    { target: units('B-1404'), title: 'Your modification request was approved', body: 'Your request to move the kitchen utility door has been approved by our architect. The revised drawing is ready for you to sign.' },
    { target: towers('A'), title: 'Tower A: brickwork starts on lower floors', body: 'Internal brickwork has begun on floors 1 to 4 in Tower A. You will start seeing room layouts on your next visit.' },
    { target: ALL, title: 'Approach road resurfacing', body: 'The approach road from the main gate will be resurfaced this week. Please use the side gate on Lake Road for site visits.' },
    { target: towers('B'), title: 'Tower B: 10th floor slab cast', body: 'The 10th floor slab in Tower B was cast overnight to avoid the afternoon heat. Thanks for bearing with the noise.' },
    { target: ALL, title: 'Clubhouse design preview', body: 'The final clubhouse design, with the pool, gym and party hall, is on display at the experience centre. Comments are welcome until the end of the month.' },
    { target: units('C-0904', 'C-0903'), title: 'Bathroom fittings: choose your finish', body: 'Pick chrome or matte black fittings for your bathrooms. Samples are at the experience centre; tell the site office your choice.' },
    { target: ALL, title: 'Electrical conduit inspection', body: 'An independent inspector will check concealed conduits in all three towers over the next two weeks, before plastering starts.' },
    { target: ALL, title: 'New CCTV at the site gate', body: 'CCTV now covers the main and side gates. Visitors must sign in at security and wear a helmet beyond the barricade.' },
    { target: towers('B'), title: 'Tower B: tower crane maintenance', body: 'The Tower B crane is down for its monthly service on Wednesday. Lifting work will pause for the day.' },
    { target: ALL, title: 'Monthly progress report is out', body: 'This month: Tower A crossed 60%, Tower B reached the 11th floor and Tower C is on the 5th floor slab. Photos are in the site office album.' },
    { target: towers('A'), title: 'Tower A: lift installation begins', body: 'The lift company has started installing guide rails in Tower A. Both lifts are due for testing in about four months.' },
    { target: ALL, title: 'Rainwater harvesting pits dug', body: 'All six rainwater harvesting pits around the podium are dug and lined. They will feed the recharge wells near Tower C.' },
    { target: units('A-0803'), title: 'Your payment receipt is ready', body: 'The receipt for your latest instalment is ready. Collect it from the site office or ask for a scanned copy.' },
    { target: towers('C'), title: 'Tower C: 5th floor slab cast', body: 'The 5th floor slab in Tower C was cast today. Next up is block work on floors 1 and 2.' },
    { target: ALL, title: 'Landscaping plan shared', body: 'The landscape architect has finalised the central lawn, jogging track and kids play area. The plan is pinned on the board at the site office.' },
    { target: ALL, title: 'Plumbing risers going up', body: 'Vertical plumbing risers are being installed in the service shafts of every tower. Shaft areas are closed to visitors.' },
    { target: ALL, title: 'Buyer meet at the experience centre', body: 'Join us for tea and a short project update on Saturday at 11am. The project manager will take questions.' },
    { target: towers('B'), title: 'Tower B: brickwork starts', body: 'Internal brickwork has started on floors 1 to 3 in Tower B.' },
    { target: units('A-1601', 'A-1602'), title: 'Balcony railing sample ready', body: 'The glass railing sample for your balcony is installed on the 3rd floor mock-up flat. Have a look on your next visit.' },
    { target: ALL, title: 'Power cut on site Tuesday', body: 'The electricity board has a scheduled shutdown on Tuesday from 10am to 4pm. The site will run on generators; the experience centre will be closed.' },
    { target: towers('C'), title: 'Tower C: crane height raised', body: 'The Tower C crane has been raised by another 6 metres to reach the upper floors.' },
    { target: ALL, title: 'Car park allotment process', body: 'Covered car park slots will be allotted by draw closer to possession. Watch this space for the date.' },
    { target: towers('A'), title: 'Tower A: 14th floor slab cast', body: 'The 14th floor slab in Tower A is done. Six floors to go before the terrace.' },
    { target: ALL, title: 'Dust control measures', body: 'We have added sprinklers and green netting along the boundary to keep dust down for our neighbours. Thanks to everyone who raised this.' },
    { target: units('B-0502', 'B-0501'), title: 'Your kitchen platform choice is due', body: 'Please choose between granite and quartz for your kitchen platform by the end of next week.' },
    { target: ALL, title: 'Facade colour mock-up', body: 'A facade colour mock-up is painted on the east wall of each tower. Tell the site office which shade you prefer.' },
    { target: ALL, title: 'Monthly progress report is out', body: 'This month: Tower A at the 15th floor, Tower B at the 12th and Tower C at the 6th. Overall progress is on plan.' },
    { target: towers('B'), title: 'Tower B: 12th floor slab cast', body: 'The 12th floor slab in Tower B is complete.' },
    { target: ALL, title: 'Society formation: early sign-up', body: 'We will help buyers form the residents association before possession. Leave your name at the site office if you want to be on the first committee.' },
    { target: units('A-1204'), title: 'Site visit slot confirmed for your unit', body: 'Your requested visit to see your unit is confirmed for Saturday at 11:30am. A site engineer will meet you at the main gate.' },
    { target: towers('C'), title: 'Tower C: waterproofing of basement done', body: 'Basement waterproofing for Tower C is finished and has passed the 48-hour ponding test.' },
    { target: ALL, title: 'Payment schedule for Q1', body: 'The next construction-linked instalment falls due in Q1, on completion of the Tower slab milestones. Demand letters will be emailed two weeks before each due date.', pinned: true },
    { target: towers('A'), title: 'Tower A: lift testing next month', body: 'The first lift in Tower A will be load-tested next month. Visitors will be able to ride it up to the 10th floor after the test.' },
    { target: ALL, title: 'Revised possession timeline', body: 'Possession dates are confirmed: Tower A in January 2028, Tower B in June 2028 and Tower C in December 2028. Your unit page shows the countdown.', pinned: true },
    { target: ALL, title: 'Gas pipeline routing approved', body: 'The city gas company approved the piped gas routing for all three towers. Work starts in each tower after plastering.' },
    { target: units('C-0904'), title: 'Your agreement registration date', body: 'Your agreement registration is booked at the sub-registrar office. The site office will call you to confirm the time and documents.' },
    { target: ALL, title: 'Water supply off Thursday', body: 'Municipal water to the site will be off on Thursday from 9am to 5pm for a main line repair. Site washrooms will use tanker water.', pinned: true },
    { target: towers('B', 'C'), title: 'Night concreting this week', body: 'Slab concreting in Towers B and C will run overnight this week to beat the heat. Expect noise until about 2am.' },
    { target: ALL, title: `Site visit day on ${visit}`, body: `Open house for all buyers on ${visit}, 10am to 1pm. Helmets are provided at the gate, and engineers will walk you through your tower.`, pinned: true },
    { target: towers('C'), title: 'Tower C: 7th floor slab cast', body: 'The 7th floor slab in Tower C is complete. Brickwork on lower floors starts next week.' },
    { target: ALL, title: 'Monthly progress report is out', body: 'This month: Tower A topped out its 16th floor, lifts are going in, and Towers B and C are on plan. The report is at the site office.' },
    { target: units('A-1204', 'A-1203'), title: 'Your wardrobe layout is ready to review', body: 'The carpenter has drawn the wardrobe layout for your bedrooms. Review it at the site office and sign off by next Friday.' },
    { target: towers('A'), title: 'Tower A: plastering starts on floor 1', body: 'Internal plastering has started on the 1st floor of Tower A. Rooms are taking their final shape.' },
  ];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function builderLogin(env: NodeJS.ProcessEnv): { email: string; password: string } {
  const email = env.BUILDER_EMAIL?.trim();
  const password = env.BUILDER_PASSWORD;
  if (email && password) return { email, password };
  if (env.FIRESTORE_EMULATOR_HOST) return { email: 'builder@demo.test', password: 'demo1234' };
  throw new Error('Set BUILDER_EMAIL and BUILDER_PASSWORD to seed a real Firebase project.');
}

async function writeAll(db: Firestore, docs: [DocumentReference, Record<string, unknown>][]): Promise<void> {
  for (let i = 0; i < docs.length; i += MAX_BATCH_OPS) {
    const batch = db.batch();
    for (const [ref, data] of docs.slice(i, i + MAX_BATCH_OPS)) batch.create(ref, data);
    await batch.commit();
  }
}

/** Removes the seeded collections and the logins of the buyers in them. The builder login is kept and reset. */
async function wipe(db: Firestore, auth: Auth): Promise<void> {
  const members = await db.collection('members').where('role', '==', 'buyer').select().get();
  const uids = members.docs.map((m) => m.id);
  for (let i = 0; i < uids.length; i += 1000) await auth.deleteUsers(uids.slice(i, i + 1000));
  for (const name of ['notices', 'members', 'invites', 'units', 'towers']) {
    await db.recursiveDelete(db.collection(name));
  }
}

async function upsertBuilder(auth: Auth, login: { email: string; password: string }): Promise<void> {
  let uid: string;
  try {
    const user = await auth.getUserByEmail(login.email);
    await auth.updateUser(user.uid, { password: login.password, disabled: false });
    uid = user.uid;
  } catch (err) {
    if ((err as { code?: string }).code !== 'auth/user-not-found') throw err;
    uid = (await auth.createUser({ email: login.email, password: login.password, displayName: 'Site office' })).uid;
  }
  await auth.setCustomUserClaims(uid, { role: 'builder' });
}

// ── Seed ────────────────────────────────────────────────────────────────────

/**
 * Wipes the demo data, then creates towers, units, invites, joined buyers, notices and read
 * receipts. Buyers join through the real `redeemInvite` and reads go through the real `markRead`,
 * so every count is exactly what the app would produce. Same `rand`, same result.
 */
export async function runSeed(deps: SeedDeps): Promise<SeedSummary> {
  const { db, auth, now } = deps;
  const rand = deps.rand ?? mulberry32(RANDOM_SEED);
  const builder = deps.builder ?? builderLogin(process.env);
  const at = now.getTime();
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)]!;

  await wipe(db, auth);
  await upsertBuilder(auth, builder);

  // Towers, units and one invite per unit.
  const docs: [DocumentReference, Record<string, unknown>][] = [];
  const codeOf = new Map<string, string>();
  const demoName = new Map(DEMO_BUYERS.map((b) => [b.unitId, b.name]));
  const expiresAt = at + inviteTtlDays() * DAY;

  for (const tower of TOWERS) {
    docs.push([
      db.collection('towers').doc(tower.id),
      {
        name: `Tower ${tower.id}`,
        floors: FLOORS,
        progressPct: tower.progressPct,
        possessionDate: tower.possessionDate,
        unitCount: FLOORS * UNITS_PER_FLOOR,
      },
    ]);
    for (let floor = 1; floor <= FLOORS; floor++) {
      for (let n = 1; n <= UNITS_PER_FLOOR; n++) {
        const number = String(floor * 100 + n);
        const unitId = unitIdOf(tower.id, number);
        const layout = layoutOf(n - 1);
        docs.push([db.collection('units').doc(unitId), { towerId: tower.id, number: unitId.slice(tower.id.length + 1), ...layout }]);

        const code = generateInviteCode(tower.id, number, rand);
        codeOf.set(unitId, code);
        const phone = `98${String(Math.floor(rand() * 1e8)).padStart(8, '0')}`;
        docs.push([
          db.collection('invites').doc(code),
          {
            unitId,
            towerId: tower.id,
            name: demoName.get(unitId) ?? `${pick(FIRST)} ${pick(LAST)}`,
            phone,
            expiresAt: unitId === EXPIRED_UNIT ? at - 2 * DAY : expiresAt,
            usedBy: null,
            usedAt: null,
          },
        ]);
      }
    }
  }
  await writeAll(db, docs);

  // Demo buyers join through the real redeem flow, a couple of months back.
  const readers: Reader[] = [];
  for (const [i, b] of DEMO_BUYERS.entries()) {
    const joined = await redeemInvite(db, auth, codeOf.get(b.unitId)!, new Date(at - (65 - i) * DAY));
    readers.push({ uid: joined.uid, towerId: joined.towerId, unitId: joined.unitId });
  }

  // Notices, oldest first, spread over the last 60 days in office hours.
  const specs = noticeSpecs(now);
  const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const notices = specs.map((spec, i) => {
    const daysAgo = Math.round(60 - (i * 59) / (specs.length - 1));
    const createdAt = startOfToday - daysAgo * DAY + (3 + Math.floor(rand() * 9)) * HOUR + Math.floor(rand() * 60) * 60_000;
    return { ref: db.collection('notices').doc(), spec, createdAt, audience: audienceForTarget(spec.target) };
  });
  await writeAll(
    db,
    notices.map(({ ref, spec, createdAt, audience }) => [
      ref,
      {
        title: spec.title,
        body: spec.body,
        pinned: spec.pinned ?? false,
        createdAt,
        createdBy: 'seed',
        target: spec.target,
        audience,
        readCount: 0,
      },
    ]),
  );

  // About 60% of the buyers each notice is for have read it. Decide first, so `rand` is used in a fixed order.
  const reads = notices.flatMap(({ ref, createdAt, audience }) =>
    readers
      .filter((r) => intersects(audience, audienceKeysFor(r)))
      .filter(() => rand() < 0.6)
      .map((r) => ({ reader: r, noticeId: ref.id, readAt: new Date(createdAt + HOUR + rand() * (at - createdAt - HOUR)) })),
  );
  // One notice per task, its readers in turn, so receipts for one notice never race on readCount.
  const perNotice = new Map<string, typeof reads>();
  for (const r of reads) perNotice.set(r.noticeId, [...(perNotice.get(r.noticeId) ?? []), r]);
  await Promise.all(
    [...perNotice.values()].map(async (list) => {
      for (const r of list) await markRead(db, r.reader, r.noticeId, r.readAt);
    }),
  );

  return {
    builder,
    codes: {
      valid: codeOf.get(VALID_UNIT)!,
      used: codeOf.get('A-1204')!,
      expired: codeOf.get(EXPIRED_UNIT)!,
      invalid: INVALID_CODE,
    },
    buyers: DEMO_BUYERS.map((b) => ({ name: b.name, unitId: b.unitId })),
  };
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function printSummary(s: SeedSummary): void {
  const rows: [string, string][] = [
    ['Builder email', s.builder.email],
    ['Builder password', s.builder.password],
    ['Valid code', `${s.codes.valid}   (Tower A, unit 1203)`],
    ['Used code', `${s.codes.used}   (Priya Sharma, A-1204)`],
    ['Expired code', s.codes.expired],
    ['Invalid code', s.codes.invalid],
  ];
  const width = Math.max(...rows.map(([k]) => k.length));
  const line = '─'.repeat(width + 2 + Math.max(...rows.map(([, v]) => v.length)));
  console.log(`\nGatehood demo data ready\n${line}`);
  for (const [k, v] of rows) console.log(`${k.padEnd(width)}  ${v}`);
  console.log(`${line}\nJoined buyers: ${s.buyers.map((b) => `${b.name} (${b.unitId})`).join(', ')}\n`);
}

async function main(): Promise<void> {
  await import('dotenv/config');
  const projectId = process.env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID;
  useDemoEmulators();
  const target = process.env.FIRESTORE_EMULATOR_HOST ? `emulators (${projectId})` : `real project ${projectId}`;
  console.log(`Seeding ${target}. This wipes towers, units, invites, members and notices first.`);

  const started = Date.now();
  const summary = await runSeed({ ...initAdmin(), now: new Date() });
  printSummary(summary);
  console.log(`Done in ${((Date.now() - started) / 1000).toFixed(1)}s.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(
    () => process.exit(0),
    (err: unknown) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    },
  );
}
