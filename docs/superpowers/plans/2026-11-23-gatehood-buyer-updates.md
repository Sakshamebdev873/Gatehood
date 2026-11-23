# Gatehood Buyer Updates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Expo mobile app (builder and buyer roles) and a TypeScript Express server on Firestore. The builder imports buyers, issues invite codes, posts targeted and pinned notices, and tracks exact read counts. Buyers join with a code and read a live, filtered, paginated, offline-capable feed.

**Architecture:** npm-workspaces monorepo with three parts: `apps/mobile` (Expo + expo-router), `apps/server` (Express + firebase-admin) and `packages/shared` (types, zod schemas, pure logic).
- The app reads Firestore directly for live data.
- Every write goes through the API.
- Firestore rules deny all client writes and scope reads by auth claims.
- Development and review run on Firebase emulators, so no credentials are needed.

**Tech Stack:**
- TypeScript strict, Node 20 or newer, npm workspaces
- App: Expo (latest SDK, via `create-expo-app@latest`), expo-router, Firebase JS SDK (modular), AsyncStorage, NetInfo, expo-document-picker, lucide-react-native, `@expo-google-fonts/*`
- Server: Express, firebase-admin, zod, papaparse, express-rate-limit
- Tests: vitest, supertest, @firebase/rules-unit-testing
- Local backend: firebase-tools emulators (needs Java 11 or newer)

**Spec:** `docs/superpowers/specs/2026-11-23-gatehood-buyer-updates-design.md`. Visual reference: `docs/design-options.html`, direction A.

## Global Constraints

- TypeScript `strict: true` in every workspace. No `any` in exported signatures.
- Never commit credentials. Commit only `.env.example`. `.gitignore` covers `.env`, `*.local`, `service-account*.json`.
- Default emulator project id: `demo-gatehood`. Ports: Firestore `8080`, Auth `9099`, emulator UI `4001`, API `4000`.
- Invite code format: `<TOWER><UNIT>-<3 chars>`, for example `A1204-7KQ`. Suffix alphabet: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`.
- Invites expire `INVITE_TTL_DAYS` days after import. Default `30`.
- Audience keys: `all`, `tower:<towerId>`, `unit:<unitId>`. Unit id format: `A-1204`.
- Feed order: `pinned` desc, then `createdAt` desc. Page size `15`.
- Seed: 3 towers (A, B, C), 20 floors × 4 units = 240 units, 55 notices, 4 pinned, 6 joined demo buyers.
- API error body: `{ "error": { "code": ApiErrorCode, "message": string } }`. Redeem returns 404 `invalid_code`, 409 `code_used`, 410 `code_expired`.
- Look: direction A tokens.
  - Colours: forest `#2D6A4F`, forest-dk `#214E3A`, amber `#F4A261`, amber-dk `#C2651A`, ivory `#FBF8F2`, card `#FFFFFF`, inset `#F2F0EB`, ink `#1A1A1A`, muted `#6B6B6B`, faint `#9E9E9E`, line `#E8E4DC`, error `#BE123C`.
  - Fonts: Cormorant Garamond for display, DM Sans for body, JetBrains Mono for labels.
- Copy is plain and active. Error text says what happened and what to do, for example "This code was already used on another phone. Ask the site office for a fresh code."

## Review Focus

1. **The same invite code redeemed twice at once** (two phones, or a double tap): exactly one succeeds and the other gets 409 `code_used`. Test in Task 4.
2. **Marking read twice, or retrying after a network drop:** `readCount` goes up once. Test in Task 6.
3. **Messy CSVs** (BOM, CRLF, header case and spaces, blank lines, a missing phone, duplicate rows): valid rows import, bad rows come back with a line number and reason, duplicates are skipped. Test in Task 1 (parser) and Task 5.
4. **Codes typed loosely** (`a1204 7kq`, `A12047KQ`, extra spaces): they normalise to `A1204-7KQ` before checking. Test in Task 1 and Task 4.
5. **A buyer asks for a notice outside their audience** (a guessed id, by API or by direct Firestore read): the API returns 403 and the rules deny it. Test in Task 2 and Task 6.

---

## File Structure

```
package.json                      workspaces: apps/*, packages/*; root scripts
tsconfig.base.json
.gitignore  .nvmrc
firebase/
  firebase.json                   emulators + rules/indexes paths
  .firebaserc                     default: demo-gatehood
  firestore.rules
  firestore.indexes.json
packages/shared/
  src/index.ts                    re-exports
  src/types.ts                    domain + API types
  src/schemas.ts                  zod request schemas
  src/audience.ts                 audienceKeysFor, audienceForTarget, intersects
  src/invite.ts                   unitIdOf, generateInviteCode, normalizeInviteCode
  src/csv.ts                      parseBuyersCsv
  src/feed.ts                     mergeNoticePages, daysUntil
  test/*.test.ts
apps/server/
  src/firebase.ts                 initAdmin
  src/app.ts                      createApp
  src/errors.ts                   HttpError, errorHandler
  src/middleware/auth.ts          requireRole
  src/routes/invites.ts           POST /api/invites/redeem
  src/routes/import.ts            POST /api/builder/import
  src/routes/builder.ts           GET overview, GET buyers
  src/routes/notices.ts           POST/PATCH notices, POST read, GET stats
  src/index.ts                    listen
  src/seed.ts                     seed script
  test/helpers.ts                 clearFirestore, idTokenFor, makeApp
  test/*.test.ts
apps/mobile/
  app/_layout.tsx  app/(auth)/…  app/(buyer)/…  app/(builder)/…
  src/theme/tokens.ts  src/theme/type.tsx
  src/lib/firebase.ts  src/lib/api.ts
  src/auth/AuthProvider.tsx
  src/components/{Card,Button,Segmented,NoticeRow,StateViews,TabIcon,LaunchLoading}.tsx
  src/features/feed/{queries.ts,useFeed.ts,cache.ts,ReadState.tsx}
  src/features/unit/useMyUnit.ts
  .env.example
sample/buyers.csv
README.md  NOTE.md
```

---

### Task 1: Monorepo and shared package

**Files:**
- Create: root `package.json`, `tsconfig.base.json`, `.gitignore`, `.nvmrc` (`20`), and everything under `packages/shared/` from the File Structure.
- Test: `packages/shared/test/audience.test.ts`, `invite.test.ts`, `csv.test.ts`, `feed.test.ts`

**Interfaces:**
- Produces (`@gatehood/shared`):
  - `type Role = 'builder' | 'buyer'`
  - `type NoticeTarget = { type: 'all' } | { type: 'towers'; towers: string[] } | { type: 'units'; unitIds: string[] }`
  - `interface Notice { id: string; title: string; body: string; pinned: boolean; createdAt: number /* ms */; target: NoticeTarget; audience: string[]; readCount: number }`
  - `interface BuyerRow { line: number; tower: string; unit: string; unitId: string; name: string; phone: string; config?: string }`
  - `interface RowError { line: number; reason: string }`
  - `type ApiErrorCode = 'invalid_code' | 'code_used' | 'code_expired' | 'unauthorized' | 'forbidden' | 'not_found' | 'bad_request' | 'rate_limited'`
  - Response types:
    - `RedeemResponse { token: string }`
    - `ImportResult { created: number; skipped: number; errors: RowError[]; invites: { code: string; unitId: string; name: string }[] }`
    - `OverviewResponse { towers: { towerId: string; name: string; units: number; invited: number; joined: number }[] }`
    - `BuyersResponse { buyers: { code: string; unitId: string; towerId: string; name: string; phone: string; status: 'joined' | 'pending' | 'expired'; joinedAt?: number }[] }`
    - `NoticeStats { readCount: number; joinedInAudience: number; notJoined: number; byTower: { towerId: string; read: number; joined: number }[]; notRead: { uid: string; name: string; unitId: string }[] }`
  - zod schemas:
    - `RedeemRequest { code: string }`
    - `ImportRequest { csv: string }` (max 1,000,000 chars)
    - `CreateNoticeRequest { title: 1..120, body: 1..4000, target: NoticeTarget, pinned: boolean }` (non-empty arrays)
    - `PinRequest { pinned: boolean }`
  - Functions:
    - `audienceKeysFor(m: { towerId: string; unitId: string }): string[]`
    - `audienceForTarget(t: NoticeTarget): string[]`
    - `intersects(a: string[], b: string[]): boolean`
    - `unitIdOf(tower: string, unit: string): string`
    - `generateInviteCode(tower: string, unit: string, rand?: () => number): string`
    - `normalizeInviteCode(input: string): string | null`
    - `parseBuyersCsv(text: string): { rows: BuyerRow[]; errors: RowError[] }`
    - `mergeNoticePages(pages: Notice[][]): Notice[]`
    - `daysUntil(date: Date, now: Date): number`

- [ ] **Step 1: Initialise.** `git init`. Root `package.json` with `"private": true` and `"workspaces": ["apps/*","packages/*"]`. Root scripts: `test` (runs workspace tests), `emulators` (`firebase emulators:start --project demo-gatehood --config firebase/firebase.json`), `seed`, `server`, `mobile`. Shared builds with `tsc` to `dist/`; `main` points at `dist/index.js` and `types` at `dist/index.d.ts`. Install `zod`, `papaparse`, `@types/papaparse` and `vitest`.

- [ ] **Step 2: Write the failing tests**

```ts
// audience.test.ts
expect(audienceKeysFor({ towerId: 'A', unitId: 'A-1204' })).toEqual(['all', 'tower:A', 'unit:A-1204']);
expect(audienceForTarget({ type: 'all' })).toEqual(['all']);
expect(audienceForTarget({ type: 'towers', towers: ['A', 'B', 'A'] })).toEqual(['tower:A', 'tower:B']);
expect(audienceForTarget({ type: 'units', unitIds: ['A-1204'] })).toEqual(['unit:A-1204']);
expect(() => audienceForTarget({ type: 'towers', towers: [] })).toThrow();
expect(intersects(['tower:B'], ['all', 'tower:A', 'unit:A-1204'])).toBe(false);

// invite.test.ts
expect(unitIdOf(' a ', '1204')).toBe('A-1204');
expect(unitIdOf('B', '302')).toBe('B-0302');
expect(generateInviteCode('A', '1204', () => 0)).toBe('A1204-AAA');
expect(generateInviteCode('A', '1204')).toMatch(/^A1204-[A-HJ-NP-Z2-9]{3}$/);
expect(normalizeInviteCode(' a1204 7kq ')).toBe('A1204-7KQ');
expect(normalizeInviteCode('A12047KQ')).toBe('A1204-7KQ');
expect(normalizeInviteCode('hello')).toBeNull();

// csv.test.ts — fixture: BOM + CRLF + "Tower , Unit,NAME,phone" header, a blank line,
// one row missing phone, one exact duplicate row, one row with optional "config" column
const { rows, errors } = parseBuyersCsv(fixture);
expect(rows.map(r => r.unitId)).toEqual(['A-1204', 'B-0302', 'C-0101']);
expect(rows[2].config).toBe('2BHK');
expect(errors).toEqual([
  { line: 4, reason: 'Missing phone' },
  { line: 6, reason: 'Duplicate of line 2' },
]);
expect(parseBuyersCsv('name,phone\nRavi,99').errors[0].reason).toMatch(/Missing column: tower/);

// feed.test.ts
const p = (id: string, pinned: boolean, t: number) =>
  ({ id, pinned, createdAt: t, title: '', body: '', target: { type: 'all' }, audience: ['all'], readCount: 0 });
expect(mergeNoticePages([[p('a', false, 3), p('b', true, 1)], [p('a', false, 3), p('c', false, 5)]]).map(n => n.id))
  .toEqual(['b', 'c', 'a']);
expect(daysUntil(new Date('2028-01-15'), new Date('2026-11-23T10:00:00Z'))).toBe(418);
expect(daysUntil(new Date('2020-01-01'), new Date())).toBe(0);
```

- [ ] **Step 3: Run** `npm test -w packages/shared`. Expected: FAIL (modules not found).
- [ ] **Step 4: Implement** each signature above in its file. Notes:
  - `parseBuyersCsv` uses papaparse with `header: true` and `skipEmptyLines: 'greedy'`. Headers are trimmed and lower-cased. Line numbers are 1-based file lines, with the header on line 1.
  - Rows are duplicates when the unitId and the phone with non-digits stripped are both the same.
  - Required columns are tower, unit, name and phone.
  - `daysUntil` uses `Math.ceil` on whole UTC days and never returns below 0.
- [ ] **Step 5: Run** `npm test -w packages/shared`. Expected: PASS. Run `npm run build -w packages/shared`. Expected: no errors.
- [ ] **Step 6: Commit** with `chore: monorepo + shared domain logic`.

---

### Task 2: Firestore rules, indexes and emulator config

**Files:**
- Create: `firebase/firebase.json`, `firebase/.firebaserc`, `firebase/firestore.rules`, `firebase/firestore.indexes.json`
- Test: `apps/server/test/rules.test.ts`. Scaffold `apps/server/package.json` and `tsconfig.json` here, with `vitest`, `@firebase/rules-unit-testing` and `firebase`.

**Interfaces:**
- Produces:
  - auth claims the rules depend on: `role`, `towerId`, `unitId`
  - the composite indexes the app's feed queries need

- [ ] **Step 1: Write the failing rules tests.** Use `initializeTestEnvironment({ projectId: 'demo-gatehood', firestore: { rules } })`. Seed data with `withSecurityRulesDisabled`:
  - notices `n1` (audience `['all']`), `n2` (`['tower:B']`) and `n3` (`['unit:A-1204']`)
  - unit docs `A-1204` and `A-0302`
  - an invite

  The buyer context is `authenticatedContext('u1', { role: 'buyer', towerId: 'A', unitId: 'A-1204' })`. Assertions:
  - `assertSucceeds(getDocs(query(collection(db,'notices'), where('audience','array-contains-any',['all','tower:A','unit:A-1204']), orderBy('pinned','desc'), orderBy('createdAt','desc'), limit(15))))`
  - `assertSucceeds` for the same query with `array-contains 'tower:A'`, and again with `array-contains 'unit:A-1204'`
  - `assertFails(getDoc(doc(db,'notices/n2')))`
  - `assertFails(getDocs(query(collection(db,'notices'))))`, a list with no audience filter
  - `assertSucceeds(getDoc(doc(db,'units/A-1204')))` and `assertFails(getDoc(doc(db,'units/A-0302')))`
  - `assertFails(getDoc(doc(db,'invites/A1204-7KQ')))`
  - `assertFails(setDoc(doc(db,'notices/x'),{}))` and `assertFails(setDoc(doc(db,'members/u1/reads/n1'),{}))`
  - `assertSucceeds(getDoc(doc(db,'members/u1/reads/n1')))` and `assertFails(getDoc(doc(db,'members/u2/reads/n1')))`
  - builder context `{ role: 'builder' }`: `assertSucceeds` on reading `notices/n2`, `invites/*` and `notices/n1/reads/u1`. Every builder write fails.
- [ ] **Step 2: Run** `npx firebase emulators:exec --only firestore --project demo-gatehood --config firebase/firebase.json "npm test -w apps/server -- rules"`. Expected: FAIL (rules are empty or deny everything).
- [ ] **Step 3: Write `firestore.rules`** as in spec section 5.6:
  - helpers `isBuilder()` and `isBuyer()`, and `myKeys()` returning `['all', 'tower:' + request.auth.token.towerId, 'unit:' + request.auth.token.unitId]`
  - for notices: `allow read: if isBuilder() || (isBuyer() && resource.data.audience.hasAny(myKeys()))`
  - `allow write: if false` everywhere
- [ ] **Step 4: Write `firestore.indexes.json`.** Composite index on `notices`: `audience` CONTAINS, `pinned` DESCENDING, `createdAt` DESCENDING. Add a single-field `createdAt` desc index for the builder list.
- [ ] **Step 5: Run the Step 2 command.** Expected: PASS.

  **Spike gate:** if the `array-contains-any` assertion fails while the two `array-contains` ones pass:
  - switch the app's "All" filter to three `array-contains` queries merged with `mergeNoticePages` (Task 10 reads this note)
  - delete that one assertion
  - write the outcome in `NOTE.md` trade-offs
- [ ] **Step 6: Commit** with `feat: firestore rules, indexes, emulator config + rules tests`.

---

### Task 3: Server foundation

**Files:**
- Create: `apps/server/src/firebase.ts`, `app.ts`, `errors.ts`, `middleware/auth.ts`, `index.ts`, `test/helpers.ts`, `apps/server/.env.example`
- Test: `apps/server/test/auth.test.ts`

**Interfaces:**
- Consumes: `@gatehood/shared` types.
- Produces:
  - `initAdmin(): { db: Firestore; auth: Auth }`. It reads `FIREBASE_PROJECT_ID` (default `demo-gatehood`). When the emulator host variables are set, it uses the emulators. Otherwise it uses application default credentials from `GOOGLE_APPLICATION_CREDENTIALS`.
  - `createApp(deps: { db: Firestore; auth: Auth; now?: () => Date }): Express`. It mounts JSON with a 2mb limit, `cors()`, `GET /health → { ok: true }`, the routers, and the error handler last.
  - `class HttpError extends Error { constructor(status: number, code: ApiErrorCode, message: string) }` and `errorHandler`. zod errors map to 400 `bad_request`.
  - `requireRole(role: Role): RequestHandler`. It verifies the bearer ID token and sets `req.user: { uid: string; role: Role; towerId?: string; unitId?: string }`. A missing or invalid token gives 401 `unauthorized`; the wrong role gives 403 `forbidden`.
  - Test helpers:
    - `clearFirestore()`: DELETE `http://127.0.0.1:8080/emulator/v1/projects/demo-gatehood/databases/(default)/documents`
    - `idTokenFor(uid: string, claims: object): Promise<string>`: creates the user in the Auth emulator, mints a custom token, then exchanges it at `http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake` with `returnSecureToken: true`
    - `makeApp(now?: Date)`

- [ ] **Step 1: Write failing tests** with supertest:
  - `GET /health` gives 200 `{ ok: true }`
  - a test-only route `GET /api/builder/ping` behind `requireRole('builder')` gives 401 with no token, 403 with a buyer token, and 200 with a builder token
- [ ] **Step 2: Run** `npx firebase emulators:exec --only firestore,auth --project demo-gatehood --config firebase/firebase.json "npm test -w apps/server"`. Expected: FAIL. Add this command as the server's `test:emu` script and use it from here on.
- [ ] **Step 3: Implement** the interfaces above. `index.ts` listens on `PORT` (default 4000) on host `0.0.0.0`. `.env.example` lists `PORT`, `FIREBASE_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS`, `FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`, `INVITE_TTL_DAYS`, `BUILDER_EMAIL` and `BUILDER_PASSWORD`. Use `dotenv` and `tsx` for `dev`.
- [ ] **Step 4: Run** `npm run test:emu -w apps/server`. Expected: PASS.
- [ ] **Step 5: Commit** with `feat(server): app factory, admin init, auth middleware`.

---

### Task 4: Invite redemption

**Files:**
- Create: `apps/server/src/routes/invites.ts`
- Test: `apps/server/test/redeem.test.ts`

**Interfaces:**
- Consumes: `normalizeInviteCode` and `RedeemRequest` from shared, and `createApp`.
- Produces:
  - `POST /api/invites/redeem` returns `RedeemResponse`
  - creates `members/{uid}`: `{ role: 'buyer', unitId, towerId, name, joinedAt }`
  - sets the invite's `usedBy` and `usedAt`
  - auth claims `{ role: 'buyer', towerId, unitId }`

- [ ] **Step 1: Write failing tests.** Before each test, clear Firestore and seed `invites/A1204-7KQ` (`{ unitId: 'A-1204', towerId: 'A', name: 'Priya Sharma', phone: '9800000000', expiresAt: now + 10 days }`), plus one used invite and one invite that expired yesterday.
  - Valid code typed as `' a1204 7kq '` gives 200. The `token` exchanges to an ID token whose claims include `unitId: 'A-1204'` and `towerId: 'A'`. `members/{uid}` exists, and the invite has `usedBy === uid`.
  - Unknown code `Z9999-AAA` gives 404 `invalid_code`. Garbage text `'hello'` also gives 404 `invalid_code`.
  - Used code gives 409 `code_used`. Expired code gives 410 `code_expired`, judged by the `now` injected into `makeApp`.
  - **Concurrent:** `Promise.all` of two redeems of the same fresh code gives status codes that sort to `[200, 409]`.
  - Rate limit: the 11th request within a minute from the same IP gives 429 `rate_limited`. Use a limit of 10 per minute and skip this check when `NODE_ENV==='test'`, except in this one test, which builds the app with the limiter on.
- [ ] **Step 2: Run** `npm run test:emu -w apps/server -- redeem`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  1. Normalise the code. If it's null, return 404.
  2. Reserve a uid with `db.collection('members').doc().id`.
  3. Run a transaction: read the invite, check it exists, is unused and hasn't expired, then set `usedBy`, `usedAt` and the member doc.
  4. After the transaction, call `auth.createUser({ uid })`, then `setCustomUserClaims`, then `createCustomToken(uid, claims)`.
  5. If any auth step throws, roll back in a new transaction: clear `usedBy` and delete the member doc. Then rethrow.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** with `feat(server): invite redemption with invalid/used/expired handling`.

---

### Task 5: CSV import, overview and buyers list

**Files:**
- Create: `apps/server/src/routes/import.ts`, `apps/server/src/routes/builder.ts`, `sample/buyers.csv` (about 12 rows across A, B and C, including one bad row)
- Test: `apps/server/test/import.test.ts`

**Interfaces:**
- Consumes: `parseBuyersCsv`, `generateInviteCode`, `ImportRequest`, `ImportResult`, `OverviewResponse`, `BuyersResponse`.
- Produces:
  - `POST /api/builder/import`
  - `GET /api/builder/overview`
  - `GET /api/builder/buyers?tower=A` (tower is optional)
  - writes `towers/{id}` when missing: `{ name: 'Tower ' + id, floors: 0, progressPct: 0, possessionDate: null, unitCount }`
  - writes `units/{unitId}` when missing: `{ towerId, number, config: row.config ?? null, areaSqft: null }`
  - writes `invites/{code}`: `{ unitId, towerId, name, phone, expiresAt: now + INVITE_TTL_DAYS days, usedBy: null, usedAt: null }`

- [ ] **Step 1: Write failing tests** (builder token):
  - Importing `sample/buyers.csv` gives 200. `created` equals the number of valid rows, `errors` holds the bad row's line and reason, every returned `invites[i].code` matches `/^[A-C]\d{4}-[A-HJ-NP-Z2-9]{3}$/`, and the docs exist.
  - Importing the same file again gives `created: 0`, with `skipped` equal to the valid row count. A row counts as already imported when an invite with the same unitId and phone exists.
  - A buyer token gives 403. A body with no `csv` gives 400.
  - After import, with one invite redeemed: `GET /api/builder/overview` shows tower A with matching `invited` and `joined: 1`.
  - `GET /api/builder/buyers?tower=A` lists tower A only, sorted by unitId. The redeemed buyer has `status: 'joined'`. An invite with a past `expiresAt` has `status: 'expired'`.
- [ ] **Step 2: Run** `npm run test:emu -w apps/server -- import`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Write in chunks of at most 450 operations per batch.
  - If a generated code already exists, regenerate it, up to 5 tries.
  - Overview counts come from `units`, `invites` and `members` grouped by `towerId`. Counting in memory is fine at this scale.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(server): CSV import, joined-by-tower overview, buyers list`.

---

### Task 6: Notices, read receipts and stats

**Files:**
- Create: `apps/server/src/routes/notices.ts`
- Test: `apps/server/test/notices.test.ts`

**Interfaces:**
- Consumes: `CreateNoticeRequest`, `PinRequest`, `audienceForTarget`, `audienceKeysFor`, `intersects`, `NoticeStats`.
- Produces:
  - `POST /api/builder/notices` returns `{ id }` and writes `notices/{id}`: `{ title, body, pinned, createdAt: serverTimestamp, createdBy, target, audience, readCount: 0 }`
  - `PATCH /api/builder/notices/:id` (pin) returns `{ ok: true }`
  - `POST /api/notices/:id/read` (buyer) returns `{ counted: boolean }`
  - `GET /api/builder/notices/:id/stats` returns `NoticeStats`

- [ ] **Step 1: Write failing tests.**
  - Creating with `target: { type: 'towers', towers: ['A', 'B'] }` stores `audience ['tower:A', 'tower:B']` and `readCount 0`.
  - Creating with `target: { type: 'units', unitIds: ['A-9999'] }` gives 400 `bad_request`, with a message naming `A-9999`.
  - PATCH `{ pinned: true }` makes the doc's `pinned` true.
  - A buyer in A-1204 reads a notice for `tower:A`: the first call gives `{ counted: true }`, and two more calls in parallel both give `{ counted: false }`. `readCount === 1`, and both `notices/{id}/reads/{uid}` and `members/{uid}/reads/{id}` exist.
  - The same buyer reads a `tower:B` notice: 403 `forbidden`, with no receipt and no count change.
  - Reading a missing notice gives 404 `not_found`.
  - Stats for a `towers: ['A', 'B']` notice, with 3 joined buyers in A, 1 in B, 1 in C, and 2 reads in A:

    ```
    joinedInAudience === 4
    readCount === 2
    byTower ⊇ [{ towerId: 'A', read: 2, joined: 3 }, { towerId: 'B', read: 0, joined: 1 }]
    notRead.length === 2
    notJoined === (pending invites in A or B)
    ```
- [ ] **Step 2: Run** `npm run test:emu -w apps/server -- notices`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Read: in one transaction, get the notice (404 if missing). If `intersects(notice.audience, audienceKeysFor(user))` is false, return 403. Get the receipt; if it exists, return `{ counted: false }`. Otherwise set both receipts and `readCount: FieldValue.increment(1)`.
  - Stats: load members with role buyer and keep those whose `audienceKeysFor` intersects the notice's audience. Load `notices/{id}/reads`. `notJoined` counts invites with `usedBy == null` whose unit or tower is in the audience.
- [ ] **Step 4: Run** `npm run test:emu -w apps/server`, the full server suite. Expected: PASS.
- [ ] **Step 5: Commit** with `feat(server): notices, idempotent read receipts, read stats`.

---

### Task 7: Seed script

**Files:**
- Create: `apps/server/src/seed.ts`. Add the root script `"seed": "npm run seed -w apps/server"`.
- Test: `apps/server/test/seed.test.ts`

**Interfaces:**
- Consumes: `initAdmin`, shared helpers.
- Produces:
  - `runSeed(deps: { db; auth; now: Date; rand?: () => number }): Promise<SeedSummary>`
  - `SeedSummary { builder: { email: string; password: string }; codes: { valid: string; used: string; expired: string; invalid: string }; buyers: { name: string; unitId: string }[] }`
  - the CLI prints the summary as a table

- [ ] **Step 1: Write the failing test.** After `runSeed` on an empty emulator:
  - 3 towers, 240 units, 240 invites
  - 55 notices, 4 of them pinned
  - 6 members, all with role buyer
  - a builder auth user with claim `role: 'builder'`
  - `codes.valid` redeems with 200, and `codes.used` gives 409
  - every notice's `readCount` equals the size of its `reads` subcollection
  - running `runSeed` again gives the same counts, because it wipes first
- [ ] **Step 2: Run** `npm run test:emu -w apps/server -- seed`. Expected: FAIL.
- [ ] **Step 3: Implement.** Use a seeded PRNG (mulberry32, seed 42) so runs repeat.
  - **Towers:** A at 62% with possession 2028-01-15, B at 48% with 2028-06-30, C at 31% with 2028-12-31.
  - **Units:** configs cycle 2BHK, 3BHK, 3BHK, 4BHK. Areas are 1,180, 1,640, 1,640 and 2,150 sq ft.
  - **Notices:** 55 realistic construction-site notices (water, lift, slab casting, payment due, site visit, tile selection…) spread over 60 days.
    - Targets: about 50% all, 35% towers, 15% units.
    - Pinned: "Site visit day on Sat 7 Dec", "Payment schedule for Q1", "Water supply off Thursday" and one more.
  - **Demo buyers:** the 6 buyers include A-1204 Priya Sharma, whose code is reported as `used`. Create them through the same redeem logic, refactored into an exported `redeemInvite(db, auth, code, now)`.
  - **Reads:** about 60% of eligible demo buyers read each notice, using the same transaction as the read route, refactored into an exported `markRead(db, user, noticeId)`.
  - **Expired code:** one invite with `expiresAt` 2 days ago.
  - **Builder account:** email and password from `BUILDER_EMAIL` and `BUILDER_PASSWORD`. On the emulator they default to `builder@demo.test` / `demo1234`. On a real project, exit with an error if they're unset.
- [ ] **Step 4: Run.** Expected: PASS. Then start the emulators and run `npm run seed`. Expected: a printed table with the 4 demo codes and the builder login.
- [ ] **Step 5: Commit** with `feat(server): seed script with 240 units, 55 notices, demo codes`.

---

### Task 8: Mobile scaffold (theme, fonts, splash, Firebase, auth gate)

**Files:**
- Create:
  - `apps/mobile`, from `npx create-expo-app@latest apps/mobile` followed by `npm run reset-project` to clear the example. Then add `@gatehood/shared` as a workspace dependency.
  - `src/theme/tokens.ts`, `src/theme/type.tsx`, `src/lib/firebase.ts`, `src/lib/api.ts`, `src/auth/AuthProvider.tsx`
  - `src/components/{Card,Button,Segmented,StateViews,TabIcon,LaunchLoading}.tsx`
  - `app/_layout.tsx`, `app/(auth)/_layout.tsx`, `app/(buyer)/_layout.tsx`, `app/(builder)/_layout.tsx`
  - `apps/mobile/.env.example`
- Modify: `apps/mobile/app.json`. Name "Gatehood Updates", slug `gatehood-updates`. Splash: `backgroundColor #FBF8F2`, image `assets/splash-icon.png` (the three-towers mark from the design page, exported as PNG), `resizeMode: contain`.

**Interfaces:**
- Consumes: shared types.
- Produces:
  - `tokens.ts`: `colors` (the Global Constraints values), `fonts` (`display`, `displayItalic`, `body`, `bodyMedium`, `bodySemibold`, `mono`), `space` (4, 6, 8, 10, 14, 18, 22, 28) and `radius` (`card: 14`, `pill: 999`).
  - `type.tsx`:
    - `<Display em?: string>` renders the serif headline, with `em` as an italic forest second line
    - `<Eyebrow>` renders mono uppercase text, letter-spacing 1.6, amber-dk
    - `<Body muted?>`
  - `firebase.ts`: `app`, `auth` (created with `initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })`; add `// @ts-expect-error` if the RN export is missing from types) and `db`. When `EXPO_PUBLIC_USE_EMULATORS==='1'`, connect both to `EXPO_PUBLIC_EMULATOR_HOST`.
  - `api.ts`: `api<T>(path: string, opts?: { method?: 'GET' | 'POST' | 'PATCH'; body?: unknown; auth?: boolean /* default true */ }): Promise<T>`. Base URL is `EXPO_PUBLIC_API_URL`. It attaches `await auth.currentUser?.getIdToken()`. A non-2xx response throws `ApiError { status: number; code: ApiErrorCode; message: string }`. A network failure throws `ApiError` with status 0 and code `'bad_request'` and the message "Can't reach the server. Check your connection and try again."
  - `AuthProvider` and `useAuth(): { status: 'loading' | 'signedOut' | 'buyer' | 'builder'; uid?: string; towerId?: string; unitId?: string; signOut(): Promise<void> }`. It is driven by `onIdTokenChanged` and `getIdTokenResult()` claims.
  - `StateViews`: `<LoadingCards count={3}/>`, `<Empty title em body/>`, `<ErrorRetry title body onRetry/>`, `<OfflineBanner since: Date/>` (text "Offline · showing updates from 9:12 am").
  - `TabIcon`: lucide `Home`, `Bell`, `Building2`, `Megaphone` and `Users`, with an optional `badge` count.
  - `LaunchLoading` steps: "Signed in", "Tower A, 1204 found", "Loading latest updates", "Saving them for offline". Each step is `done`, `now` (spinner) or `todo`.
- [ ] **Step 1: Implement the root layout.**
  - Call `SplashScreen.preventAutoHideAsync()` at module scope.
  - Load fonts with `useFonts` from `@expo-google-fonts/cormorant-garamond` (500, 500 italic), `@expo-google-fonts/dm-sans` (300, 400, 500, 600) and `@expo-google-fonts/jetbrains-mono` (400, 500).
  - Hide the splash once fonts have loaded and `status !== 'loading'`.
  - Route through group layouts, each redirecting with `<Redirect>`: `signedOut` goes to `/(auth)`, `buyer` to `/(buyer)` and `builder` to `/(builder)`.
  - Tab layouts use `TabIcon` with tint `colors.forest` and inactive `colors.faint`.
- [ ] **Step 2: Verify.** `npx tsc --noEmit -p apps/mobile` and `npx expo lint` in apps/mobile: no errors. Run `npx expo start`, open in Expo Go on Android and iOS, and check that the splash is ivory with the mark and then the (auth) group shows.
- [ ] **Step 3: Commit** with `feat(mobile): scaffold, gatehood theme, splash, firebase + auth gate`.

---

### Task 9: Join and builder sign-in screens

**Files:**
- Create: `apps/mobile/app/(auth)/index.tsx`, `apps/mobile/app/(auth)/builder.tsx`

**Interfaces:**
- Consumes: `api`, `normalizeInviteCode`, `RedeemResponse`, `signInWithCustomToken`, `signInWithEmailAndPassword`.

- [ ] **Step 1: Implement the join screen,** matching the mockup.
  - Eyebrow "Buyer access". `<Display em="home's updates.">Join your</Display>`.
  - A mono input with `autoCapitalize="characters"` and placeholder `A1204-7KQ`. The Join button is disabled while `normalizeInviteCode(input)` is null.
  - Error copy by code, shown under the input with a red border:
    - `invalid_code`: "We couldn't find that code. Check it against your allotment letter."
    - `code_used`: "This code was already used on another phone. Ask the site office for a fresh code."
    - `code_expired`: "This code has expired. Ask the site office for a new one."
    - network: the `ApiError` message
  - On success, call `signInWithCustomToken(auth, token)`. The gate then routes to the buyer screens.
  - The footer link "Builder team? Sign in with email" goes to `/builder`.
- [ ] **Step 2: Implement the builder sign-in screen.** Email and password fields. A wrong password shows "Email or password is wrong."
- [ ] **Step 3: Verify by hand on the emulator seed.**
  - The `invalid`, `used` and `expired` codes from the seed output each show their message.
  - The valid code lands on the buyer tabs.
  - The builder login lands on the builder tabs.
  - Run `tsc` and lint: clean.
- [ ] **Step 4: Commit** with `feat(mobile): join with invite code + builder sign-in`.

---

### Task 10: Buyer My Unit and updates feed

**Files:**
- Create:
  - `apps/mobile/src/features/unit/useMyUnit.ts`
  - `apps/mobile/src/features/feed/{queries.ts,cache.ts,useFeed.ts,ReadState.tsx}`
  - `apps/mobile/src/components/NoticeRow.tsx`
  - `apps/mobile/app/(buyer)/index.tsx`, `apps/mobile/app/(buyer)/updates/index.tsx`
- Modify: `apps/mobile/app/(buyer)/_layout.tsx`, to wrap in `ReadStateProvider` and show `LaunchLoading` on first launch.

**Interfaces:**
- Consumes: `Notice`, `audienceKeysFor`, `mergeNoticePages`, `daysUntil`, `db`, `useAuth`.
- Produces:
  - `useMyUnit(): { status: 'loading' | 'ready' | 'error'; unit?: { unitId; number; config; areaSqft }; tower?: { name; progressPct; possessionDate: Date | null }; retry() }`, using `onSnapshot` on `units/{unitId}` and `towers/{towerId}`
  - `type FeedFilter = 'all' | 'tower' | 'unit'`
  - `feedQuery(filter: FeedFilter, keys: string[], after?: QueryDocumentSnapshot): Query`
  - `toNotice(snap): Notice`, converting the Timestamp to ms
  - `cache.ts`: `saveFeed(uid: string, filter: FeedFilter, items: Notice[]): Promise<void>` and `loadFeed(uid, filter): Promise<{ items: Notice[]; savedAt: number } | null>`, under the AsyncStorage key `feed:v1:${uid}:${filter}`
  - `useFeed(filter: FeedFilter)` returns:

    ```ts
    {
      items: Notice[];
      status: 'loading' | 'ready' | 'empty' | 'error' | 'offline';
      offlineSince?: Date;
      loadMore(): void;
      hasMore: boolean;
      loadingMore: boolean;
      retry(): void;
      newCount: number;
      ackNew(): void;
    }
    ```
  - `ReadStateProvider` and `useReadState(): { isRead(id: string): boolean; markRead(id: string): void; unreadCount(items: Notice[]): number }`. It listens to `members/{uid}/reads`. `markRead` adds the id to a local Set at once, then calls `api('/api/notices/'+id+'/read', { method: 'POST' })`. On failure it keeps the id locally and retries the next time the app comes to the foreground.

- [ ] **Step 1: Implement `useFeed`.**
  - Page 1 is an `onSnapshot` listener on `feedQuery(filter, keys)`. Further pages use `getDocs(feedQuery(filter, keys, lastSnap))`.
  - Combine all pages with `mergeNoticePages`, so ids arriving live are de-duplicated.
  - `hasMore` is `page.length === 15`.
  - `newCount` counts ids that arrive on page 1 after its first snapshot. `ackNew` resets it.
  - Every page-1 snapshot that isn't `metadata.fromCache` is saved with `saveFeed`.
  - On mount, load the cache first and show it right away.
  - With NetInfo offline and items cached: `status = 'offline'`, with `offlineSince` set to `savedAt`.
  - On a snapshot error: `'offline'` if a cache exists, else `'error'`.
  - **Spike fallback** (Task 2): when the "All" filter can't use `array-contains-any`, run three listeners and merge their results.
- [ ] **Step 2: Implement My Unit,** matching the mockup.
  - Top bar with the project name and a unit chip. Eyebrow "My unit". `<Display em="3BHK · 1,640 sq ft">Tower A, 1204</Display>`.
  - A Construction card with the % and a progress bar.
  - Two cards: `daysUntil(possessionDate, new Date())` with "days to possession", and the month and year with "handover target". If there's no possession date, show "Not announced yet".
  - The newest pinned notice for this buyer, from `useFeed('all').items.find(n => n.pinned)`.
  - States: `LoadingCards`, and `ErrorRetry` that calls `retry`.
- [ ] **Step 3: Implement the updates screen.**
  - Header "Updates" with a "N unread" chip. `Segmented` with All, My tower and My unit.
  - The "↑ N new updates" pill appears when `newCount > 0`. Tapping it scrolls to the top and calls `ackNew`.
  - A `FlatList` of `NoticeRow` items: eyebrow audience label ("Pinned · all towers", "Tower A", "Your unit · A-1204"), relative time, bold and dotted when unread, muted when read, forest left edge when pinned.
  - `onEndReached` calls `loadMore`. The footer shows "15 of 52 · loading more".
  - States:
    - `loading`: `LoadingCards`
    - `empty`: `Empty`, with "No updates for your unit yet." / "your tower" / "the project", per filter
    - `error`: `ErrorRetry`
    - `offline`: `OfflineBanner` above the cached list
  - The Updates tab badge shows `unreadCount(items)`.
- [ ] **Step 4: Implement `LaunchLoading`** in the buyer layout. Show it only when there is no cache for `'all'` and the first snapshot hasn't arrived. Mark each step done as its condition is met: auth is ready, the unit has loaded, the first snapshot has arrived, and the cache has been saved.
- [ ] **Step 5: Verify by hand** against the seed, on Android and iOS:
  - only targeted notices show
  - pinned notices come first
  - scrolling loads 15 more at a time up to the end
  - each filter changes the list
  - posting a notice from the API (curl, using the builder ID token from the emulator) appears live with the pill
  - airplane mode, then restarting the app, shows the offline banner with the cached feed
  - stopping the emulator with no cache shows the error screen, and Retry recovers once it's back
  - `tsc` and lint are clean
- [ ] **Step 6: Commit** with `feat(mobile): my unit home + live paginated feed with filters, read state, offline cache`.

---

### Task 11: Notice detail and mark read

**Files:**
- Create: `apps/mobile/app/(buyer)/updates/[id].tsx`

**Interfaces:**
- Consumes: `useReadState().markRead`, `toNotice`, `getDoc`.

- [ ] **Step 1: Implement.**
  - Get the notice from the feed cache first, then `getDoc(doc(db, 'notices', id))`.
  - Show the eyebrow audience label, a pin tag when pinned, the serif title, the date in mono, and the body in DM Sans 15/1.6.
  - Call `markRead(id)` on mount.
  - States: loading; a not-found or permission error shows "This update isn't available." with a Back button.
- [ ] **Step 2: Verify.**
  - Opening an unread notice turns it to read in the list.
  - The builder's `readCount` for it goes up by exactly 1, even after opening it twice. Check in the emulator UI at `localhost:4001`.
  - Opening it in airplane mode marks it read on screen, and it counts once the phone is back online.
- [ ] **Step 3: Commit** with `feat(mobile): notice detail marks read`.

---

### Task 12: Builder screens

**Files:**
- Create:
  - `apps/mobile/app/(builder)/index.tsx` (Towers)
  - `apps/mobile/app/(builder)/buyers.tsx`, `apps/mobile/app/(builder)/import.tsx`
  - `apps/mobile/app/(builder)/notices/index.tsx`, `notices/new.tsx`, `notices/[id].tsx`

**Interfaces:**
- Consumes: `api` with `OverviewResponse`, `BuyersResponse`, `ImportResult` and `NoticeStats`; `parseBuyersCsv` for the preview; `CreateNoticeRequest`; and Firestore `onSnapshot` on `notices` ordered by `createdAt` desc, `limit(15)` plus load-more.

- [ ] **Step 1: Towers.** Per tower: "Tower A", joined/invited with a progress bar and a units count. Pull to refresh. Loading, empty ("No buyers yet. Import a CSV to send invite codes.") and error states.
- [ ] **Step 2: Buyers and import.**
  - Buyers: a tower filter (All, A, B, C), and rows showing name, mono unitId, code, and a status chip (Joined forest, Pending amber, Expired grey). A header button "Import CSV".
  - Import:
    1. `DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'text/plain'] })`, then read the file with `fetch(uri).then(r => r.text())`.
    2. Show a preview from `parseBuyersCsv`: the valid row count and each error line with its reason.
    3. "Import N buyers" posts to the API.
    4. The result screen lists the new codes, each with a Copy button using `expo-clipboard`.
- [ ] **Step 3: Notices list.**
  - Live list with title, audience label, "184 read" (live from `readCount`) and a pin toggle that calls PATCH.
  - A floating "New notice" button.
  - Loading, empty and error states.
- [ ] **Step 4: New notice.**
  - Title and body.
  - Audience segmented control: Whole project, Towers, Units. Towers shows A/B/C chips from the overview. Units is a text field taking comma-separated `A-1204` values, validated against the `unitId` format.
  - A pin switch, and a Post button. Show API errors inline.
  - On success, go back to the list.
- [ ] **Step 5: Notice stats.**
  - Matches the mockup: big `readCount` / `joinedInAudience` with a bar, a bar per tower, "Not read yet · N" listing name and unitId, and "N invited but not joined" as muted text.
  - Fetch stats on focus. Keep an `onSnapshot` on the notice doc and refetch stats whenever `readCount` changes, so the screen updates live during the video.
- [ ] **Step 6: Verify by hand.**
  - Import `sample/buyers.csv`: the bad row shows in the preview and codes are listed.
  - Redeem one new code on a second phone: Towers shows it joined.
  - Post to Tower A only: a tower B buyer doesn't see it, and a tower A buyer sees it live.
  - The buyer opens it: the builder's stats count goes up and the buyer drops off "Not read yet".
  - Pin it: it moves to the top of the buyer's feed.
  - `tsc` and lint are clean.
- [ ] **Step 7: Commit** with `feat(mobile): builder towers, buyers + CSV import, notices, read stats`.

---

### Task 13: README, NOTE.md and final check

**Files:**
- Create: `README.md`, `NOTE.md`
- Modify: `.gitignore` (confirm it covers `.env`), the `.env.example` files

- [ ] **Step 1: README.** Sections:
  1. What it is (one paragraph, plus a screenshot row)
  2. Prerequisites: Node 20, Java 11+, `npm i -g firebase-tools`, Expo Go
  3. Quick start on emulators:
     - `npm install`
     - `npm run emulators`
     - `npm run seed`
     - `npm run server`
     - copy `apps/mobile/.env.example` to `.env` and set `EXPO_PUBLIC_API_URL=http://<LAN-IP>:4000` and `EXPO_PUBLIC_EMULATOR_HOST=<LAN-IP>`
     - `npm run mobile`
  4. Demo logins and codes, as printed by seed
  5. Using a real Firebase project: the env vars, and `firebase deploy --only firestore:rules,firestore:indexes`
  6. Tests: `npm test` (shared) and `npm run test:emu -w apps/server`
  7. Project structure
  8. Optional: deploying the server to Render
- [ ] **Step 2: NOTE.md,** 250 words or fewer, covering:
  - the data model (collections and audience keys)
  - the feed query (array-contains-any on audience, pinned then createdAt, limit 15, startAfter, page-1 listener)
  - read counts (a server transaction adds the receipt and increments only when the receipt is new; at scale, split the counter across N documents or use a queue)
  - security rules (clients are read-only, reads are scoped by claims, all writes go through the Admin SDK)
  - trade-offs (two processes; the unread badge covers loaded pages only; the offline cache is the first page per filter; the Task 2 spike outcome)

  Check the word count with `wc -w NOTE.md`. It must be 250 or fewer.
- [ ] **Step 3: Final check.**
  - `npm test` and `npm run test:emu -w apps/server` pass.
  - `git ls-files | grep -Ei '\.env$|service-account'` prints nothing.
  - On a fresh clone, follow the README word for word on both phones. Every brief item from spec section 8 works.
- [ ] **Step 4: Commit** with `docs: README and submission note`.
- [ ] **Step 5: Video checklist, for the user to record.** Under 90 seconds, following the order in spec section 5.10.
