# Gatehood Buyer Updates: Design

Date: 2026-11-23
Status: approved 2026-11-23. Scope rule from the user: build exactly what the brief asks for. Anything beyond it stays only if it makes the submission stronger (see section 8).
Visual reference: `docs/design-options.html` (published at https://claude.ai/artifact/Wf3GqvjytfiMYj5ii8tENz), direction **A, Notice board**

## 1. Intent

This is the Gatehood Full Stack Developer (Intern) assignment. A builder's residential project has several towers and hundreds of units. Today buyers get updates in WhatsApp groups, miss what matters, and the builder can't tell who has read what. The app replaces that with targeted notices and read tracking.

Reviewers at Gatehood will clone the repo, set it up from the README, watch a video of up to 90 seconds, and read a note of up to 250 words. Success means:

- every item in the brief works on Android and iOS
- setup from the README works on the first try
- the app looks like it belongs to Gatehood's product
- the note shows clear thinking on the data model, the feed query, read counts at scale, security and trade-offs

## 2. Goals, non-goals, anti-goals

**Goals (the brief, item by item)**

Builder:
- import buyers from a CSV with columns tower, unit, name and phone
- give each buyer an invite code
- see who has joined, grouped by tower
- post notices to the whole project, to chosen towers or to chosen units
- pin important notices
- see each notice's read count and the list of buyers who haven't read it

Buyer:
- join with an invite code like `A1204-7KQ`, with clear messages for invalid, already-used and expired codes
- a My Unit home showing the unit, tower, configuration, construction progress % and days to possession
- an updates feed showing only notices meant for this buyer:
  - pinned first, then newest
  - All, My tower and My unit filters
  - read and unread state
  - live updates
  - 15 notices per page

Every screen handles loading, empty, error with retry, and offline (showing the last cached feed).

Engineering:
- seed script with at least 50 notices
- no committed credentials
- TypeScript everywhere: the React Native app **and** a TypeScript backend server

Added at the user's request:
- splash screen and loading screen
- icon tab bars

**Non-goals**
- push notifications
- phone OTP login
- editing or deleting notices (pin and unpin is the only change)
- builder editing construction progress in the app (it's seeded)
- several projects per builder
- reissuing or revoking invite codes
- attachments or images on notices
- a web build

**Anti-goals** (failure even if it technically works)
- reviewers can't get it running from the README
- read counts that can be doubled or faked by a client
- credentials in git
- a generic look that ignores Gatehood's brand

## 3. Constraints

- The brief fixes the stack: Expo, TypeScript, expo-router, Firestore, and Android plus iOS.
- The user wants a separate backend server, written in TypeScript.
- The Firebase JS SDK only caches in memory on React Native, so the offline feed needs its own disk cache.
- Expo Go has to work. That means no native Firebase modules.

## 4. Approaches considered

| Approach | Trade-off | Decision |
|---|---|---|
| Firestore only: rules plus TypeScript scripts, no server | Simplest setup, but security logic lives in complex rules, and the user wants a backend server | Rejected by the user |
| **Hybrid: the app reads Firestore directly for the live feed, and all writes go through a TypeScript Express API using firebase-admin** | Live updates and offline come from Firestore; validation, invite redemption and read counting run on a trusted server. Reviewers run two processes. | **Chosen** |
| Server does everything: the app never touches Firestore, and live updates come over WebSockets or polling | Loses Firestore's live queries, which the brief asks for, and is far more code | Rejected |

Look: direction A (Notice board) was chosen over B (Forest night) and C (Site ledger).

## 5. Architecture

```
gatehood-updates/                 npm workspaces, TypeScript strict everywhere
  apps/mobile/                    Expo + expo-router app
  apps/server/                    Express API + seed script (firebase-admin)
  packages/shared/                zod schemas, API types, audience-key helpers
  firebase/                       firestore.rules, firestore.indexes.json, firebase.json (emulators)
  sample/buyers.csv               CSV for the import demo
  README.md
```

**Split of responsibility**

- **Mobile reads Firestore directly:**
  - the buyer's feed, with live `onSnapshot`
  - the buyer's unit and tower
  - the buyer's own read receipts
  - the builder's notice list, so read counts tick up live
- **Mobile calls the API for every write and for the builder views that need a server:** joining, CSV import, posting and pinning, marking read, joined-by-tower overview, and who-hasn't-read.
- **Security rules** make Firestore read-only for clients, scoped by auth claims. Every write comes from the server through the Admin SDK.

### 5.1 Auth

- **Builder:**
  - signs in with Firebase email and password
  - the seed script creates the builder account and sets the custom claim `role: "builder"`
- **Buyer:**
  - `POST /api/invites/redeem { code }` needs no auth and is rate-limited
  - the server runs a transaction that:
    - returns 404 `invalid` if the code doesn't exist
    - returns 409 `used` if the code is already used
    - returns 410 `expired` if the code has expired
    - otherwise creates an Auth user with claims `{ role: "buyer", unitId, tower }`, writes `members/{uid}`, marks the invite used, and returns a custom token
  - the app calls `signInWithCustomToken`
  - auth persists with `initializeAuth` and `getReactNativePersistence(AsyncStorage)`
- **API auth:**
  - every route except redeem and health needs `Authorization: Bearer <Firebase ID token>`
  - middleware verifies the token and checks the role

### 5.2 Data model (Firestore)

```
towers/{towerId}            name, floors, progressPct, possessionDate, unitCount
units/{unitId}              towerId, number, config ("3BHK"), areaSqft      unitId = "A-1204"
invites/{code}              unitId, towerId, name, phone, expiresAt, usedBy?, usedAt?
members/{uid}               role, unitId, towerId, name, joinedAt
members/{uid}/reads/{nid}   readAt                       mirror, for the buyer's read state
notices/{nid}               title, body, pinned, createdAt, createdBy,
                            target { type: "all" } | { type: "towers", towers } | { type: "units", unitIds },
                            audience: string[]           e.g. ["tower:A","tower:B"]
                            readCount: number
notices/{nid}/reads/{uid}   unitId, towerId, readAt      the receipt; one per buyer
```

**Audience keys:**
- `all`, `tower:<towerId>` and `unit:<unitId>`
- a buyer's keys are `["all", "tower:A", "unit:A-1204"]`
- the helper lives in `packages/shared`

**Invite codes:**
- format `<tower><unit>-<3 chars>`, for example `A1204-7KQ`
- the 3 random characters come from an alphabet without 0, O, 1 or I
- codes expire 30 days after import (configurable)

### 5.3 API (Express, zod-validated, JSON)

| Method and path | Who | What |
|---|---|---|
| `GET /health` | anyone | liveness check |
| `POST /api/invites/redeem` | anyone | join with a code (see 5.1) |
| `POST /api/builder/import` | builder | body is the CSV text. The server parses it (csv-parse), validates rows, creates missing towers and units, and creates one invite per row. Returns created count, skipped duplicates (same tower, unit and phone) and errors per row. Optional column `config`. |
| `GET /api/builder/overview` | builder | per tower: units, invites, joined count |
| `GET /api/builder/buyers?tower=A` | builder | buyers with code, status (joined, pending, expired) and joinedAt |
| `POST /api/builder/notices` | builder | `{ title, body, target, pinned }`. The server builds the audience and writes the notice. |
| `PATCH /api/builder/notices/:id` | builder | `{ pinned }` |
| `GET /api/builder/notices/:id/stats` | builder | readCount, joined members in the audience, count by tower, list of not-read buyers (name and unit), not-joined count |
| `POST /api/notices/:id/read` | buyer | transaction. Checks that the notice's audience includes the buyer. Then, only if no receipt exists, creates `notices/{id}/reads/{uid}` and `members/{uid}/reads/{id}` and increments readCount. Safe to repeat. |

### 5.4 Feed query

- **All:**
  - `where("audience", "array-contains-any", myKeys)`
  - `orderBy("pinned", "desc")`, then `orderBy("createdAt", "desc")`
  - `limit(15)`
- **My tower:** `array-contains "tower:A"`, same ordering.
- **My unit:** `array-contains "unit:A-1204"`, same ordering.
- **Indexes:** composite indexes in `firestore.indexes.json` cover `audience` (array) + `pinned` desc + `createdAt` desc.
- **Live updates:** page 1 is an `onSnapshot` listener, so new and pinned notices appear live with a "1 new update" pill. Later pages load with `getDocs` and `startAfter(lastDoc)` as the list scrolls.
- **Read state:**
  - the app listens to `members/{uid}/reads`
  - opening a notice marks it read on screen immediately, then calls the API
  - the unread badge counts unread notices among the loaded pages

### 5.5 Read counts at scale

**Why the count is exact:**
- one receipt per buyer per notice, keyed by uid
- the server increments `readCount` in the same transaction, and only when it creates the receipt
- clients can't write anything

**Who hasn't read:**
- joined members whose keys meet the notice's audience, minus those with receipts
- the server computes this on request
- buyers who haven't joined are reported as a separate count

**Limit:** a single counter document handles about one write per second when sustained. That's fine for hundreds of units. At a larger scale, the note says it would be split across N counter documents and summed when read, or the counting moved to a queue.

### 5.6 Security rules

- `notices/{id}`:
  - the builder can read
  - a buyer can read when `resource.data.audience.hasAny(["all", "tower:" + token.towerId, "unit:" + token.unitId])`
- `units/{id}`: the builder can read, or the buyer whose `token.unitId == id`.
- `towers/*`: any signed-in user can read.
- `members/{uid}` and `members/{uid}/reads/*`: the owner or the builder can read.
- `invites/*` and `notices/*/reads/*`: the builder can read; buyers have no access.
- **Writes:** denied for every client.
- **Risk:** Firestore has to be able to prove the `hasAny` rule from the `array-contains-any` query. This gets a spike in step 1 using the rules emulator. Fallback: run the three feed queries with `array-contains` and merge them on the client.

### 5.7 Mobile app

Routes, using expo-router groups:

```
app/_layout.tsx                 fonts, splash hold, auth gate → (auth) | (buyer) | (builder)
app/loading.tsx                 first-launch loading steps
app/(auth)/index.tsx            join with code (default)
app/(auth)/builder.tsx          builder email sign-in
app/(buyer)/_layout.tsx         tabs: Home, Updates (icons)
app/(buyer)/index.tsx           My Unit
app/(buyer)/updates/index.tsx   feed + filters + pagination
app/(buyer)/updates/[id].tsx    notice detail, marks read
app/(builder)/_layout.tsx       tabs: Towers, Notices, Buyers (icons)
app/(builder)/index.tsx         joined by tower
app/(builder)/buyers.tsx        buyer list + codes, CSV import entry
app/(builder)/import.tsx        pick CSV (expo-document-picker), preview, import
app/(builder)/notices/index.tsx notice list with live read counts, pin toggle
app/(builder)/notices/new.tsx   compose: all / towers / units, pin
app/(builder)/notices/[id].tsx  stats + who hasn't read
```

**Look (direction A):**
- tokens from gatehood.com: forest `#2D6A4F`, amber `#F4A261` / `#C2651A`, ivory, ink
- fonts: Cormorant Garamond for headlines with an italic forest second line, DM Sans for body text, JetBrains Mono for small capitals labels
- fonts load with `@expo-google-fonts/*`
- icons from `lucide-react-native` (with `react-native-svg`)
- tokens live in `src/theme`

**Splash and loading:**
- `expo-splash-screen` stays up until fonts load and auth state is known
- a first launch with no cache shows `loading.tsx` with real steps: signed in, unit found, loading updates, saving for offline
- returning users go straight to their cached feed

**Screen states:**
- shared `<Loading/>` (skeleton cards), `<Empty/>`, `<ErrorRetry/>` and `<OfflineBanner/>` components
- `@react-native-community/netinfo` detects when the phone is offline
- each successful snapshot of the All feed's first page is saved to AsyncStorage with a timestamp
- when the phone is offline, or the query fails and a cache exists, the app shows the cached feed under the banner "Offline · showing updates from 9:12 am"

### 5.8 Seed and setup

`npm run seed` (server workspace, tsx + firebase-admin) is idempotent and wipes demo data first. It creates:
- the builder account
- 3 towers (A, B, C) with progress and possession dates
- about 240 units with configurations
- invites for all units
- 6 joined demo buyers
- 55 notices over the last 60 days: a mix of all, tower and unit targets, 4 of them pinned
- random receipts, so the read counts look realistic

It then prints demo logins and codes: one valid, one used, one expired, and one invalid example.

Two ways to run:
1. **Firebase emulators (default, no credentials at all):** `firebase emulators:start`, then `npm run seed`, `npm run server` and `npm run mobile`.
2. **A real Firebase project:**
   - the server reads `GOOGLE_APPLICATION_CREDENTIALS` from `apps/server/.env` (gitignored)
   - the mobile app reads `EXPO_PUBLIC_FIREBASE_*` from `apps/mobile/.env` (gitignored)
   - committed `.env.example` files list every variable

`EXPO_PUBLIC_API_URL` and the emulator host point at the computer's LAN IP, so a phone running Expo Go can reach them. The README explains how to find it.

### 5.9 Testing

- **Server:**
  - vitest + supertest against the emulators
  - covers redeem (valid, invalid, used, expired), concurrent redeem of one code, read idempotency (two calls give one count), audience checks on read, CSV row errors and notice audience building
- **Rules:** `@firebase/rules-unit-testing`. Buyers see only their notices, clients can't write anything, and buyers can't read other units.
- **Shared:** unit tests for the audience keys and invite code format.
- **Mobile:** type-check and lint. The feed and offline flows are checked by hand on Android and iOS.

### 5.10 Deliverables

- GitHub repo with the README
- a video of up to 90 seconds:
  1. builder imports a CSV
  2. builder posts a notice to a tower
  3. buyer joins with a code (after showing the used-code error)
  4. buyer sees the notice arrive live and opens it
  5. builder's read count ticks up
  6. offline cached feed
- a note of up to 250 words, saved as `NOTE.md`

## 6. Calls made by Claude (please check)

1. **Read counts are per buyer, not per unit.** A unit with two co-owners counts as two readers. The stats screen says "buyers read".
2. **The read-count denominator is buyers who have joined and are in the audience.** Buyers who haven't joined are shown as their own number.
3. **Unit configuration and area come from the seed**, or from an optional `config` CSV column. Tower progress and possession dates are seeded, with no editing screen.
4. **Invite codes expire 30 days after import.**
5. **The server runs locally by default.** The README mentions deploying to Render or Railway, but the video is recorded locally.
6. **The buyer's unread badge counts unread notices among the pages already loaded**, not across the whole history.
7. **Express is the server framework**, chosen as the most familiar to reviewers.

## 8. Brief coverage and extras

Every line of the brief, and where it's built:

| Brief item | Where |
|---|---|
| Import buyers from CSV (tower, unit, name, phone) | `import.tsx` → `POST /api/builder/import` |
| Each buyer gets an invite code | created in the import transaction, listed in `buyers.tsx` |
| See who has joined, by tower | `(builder)/index.tsx` ← `GET /api/builder/overview` |
| Post to whole project / towers / units, pin | `notices/new.tsx` → `POST /api/builder/notices`; pin via `PATCH` |
| Read count and who hasn't read | `notices/[id].tsx` ← `GET .../stats`; live `readCount` in the list |
| Join with code; invalid, used and expired | `(auth)/index.tsx` → `POST /api/invites/redeem` (404, 409, 410) |
| My Unit: unit, tower, config, progress %, days to possession | `(buyer)/index.tsx` from `units` + `towers` |
| Feed: only their notices, pinned first then newest | audience query, section 5.4 |
| All, My tower and My unit filters | segmented control, three queries |
| Read and unread state | `members/{uid}/reads` listener + unread dot |
| Live updates | `onSnapshot` on page 1 |
| Seed 50+ notices; 15 per page | seed makes 55; `limit(15)` + `startAfter` |
| Loading, empty, error with retry, offline cached feed | shared state components + AsyncStorage cache |
| Android and iOS | Expo Go on both, checked by hand |
| README, seed script, no committed credentials | emulators by default, `.env.example` only |
| Repo, video of up to 90 seconds, note of up to 250 words | section 5.10, `NOTE.md` |
| (user) TypeScript backend server | `apps/server`, Express |

Extras kept because they strengthen the submission:

- **Server and security-rule tests:** they prove the "accurate read counts" and "security rules" claims in the note.
- **Emulator setup that needs no credentials:** reviewers can run the app in minutes.
- **Seed prints demo codes** (valid, used, expired): makes the video and reviewer testing quick.
- **CSV preview with per-row errors:** shows careful input handling.
- **Read counts tick up live on the builder side:** the clearest moment for the video.
- **Splash, loading screen and icon tab bars:** asked for by the user, and they make the app feel finished.

Anything else stays out (see Non-goals).

## 7. Left to the builder

- The exact copy for error and empty states, keeping the tone of the mockups.
- How the skeleton loading looks.
- How to split components inside `src/`.
- The rate-limit values on the redeem endpoint.
