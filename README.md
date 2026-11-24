# Gatehood: buyer updates

A mobile app that keeps flat buyers up to date on their housing project. The **builder** imports buyers from a CSV, hands each one an invite code, posts notices to the whole project, chosen towers or chosen units (pinned or not), and sees exactly who has read each one. A **buyer** joins with their code, sees their unit, tower progress and days to possession, and reads a live feed of only the notices meant for them, with All / My tower / My unit filters, read and unread marks, and the last feed saved for offline use.

- **App:** Expo (SDK 58) + expo-router + TypeScript. Runs in Expo Go on Android and iOS.
- **Server:** Express + TypeScript + firebase-admin. Every write goes through it.
- **Data:** Firestore. The app reads it directly for live updates; security rules keep each buyer to their own notices.
- **No credentials needed:** by default everything runs on the Firebase emulators.

- **Demo video (86 s, both roles):** [`docs/gatehood-demo.mp4`](docs/gatehood-demo.mp4)
- **Design note (248 words):** [`NOTE.md`](NOTE.md): data model, feed query, read counts at scale, security rules, trade-offs

## What you need

- **Node 20 or newer** (`.nvmrc` says 20) and npm
- **Java 11 or newer**, for the Firebase emulators (`java -version` to check)
- **Expo Go** on an Android or iOS phone, on the **same Wi-Fi** as your computer
  (or an Android emulator / iOS simulator)

The Firebase CLI is installed by `npm install`; you don't need it globally.

## Quick start (emulators, no credentials)

Run each long-running command in its own terminal, from the repo root.

```bash
npm install

# Terminal 1: Firestore + Auth emulators (UI at http://127.0.0.1:4001)
npm run emulators

# Terminal 2: demo data (safe to re-run; it wipes and recreates)
npm run seed

# Terminal 2: the API on port 4000
npm run server
```

Then point the app at your computer. A phone can't use `localhost`, so it needs your computer's **LAN IP**:

| Your OS | Command | Look for |
|---|---|---|
| Windows | `ipconfig` | "IPv4 Address" of your Wi-Fi adapter, e.g. `192.168.1.20` |
| macOS | `ipconfig getifaddr en0` | the address it prints |
| Linux | `hostname -I` | the first address |

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

Edit `apps/mobile/.env` and set **both** lines to that IP:

```
EXPO_PUBLIC_API_URL=http://192.168.1.20:4000
EXPO_PUBLIC_EMULATOR_HOST=192.168.1.20
```

(Android emulator: use `10.0.2.2` in both. iOS simulator: leave `localhost`.)

```bash
# Terminal 3: the app. Scan the QR code with Expo Go (Android) or the Camera app (iOS).
npm run mobile
```

**If the phone can't connect:** check that the phone and computer are on the same Wi-Fi, and that your firewall lets in ports `4000` (Node), `8080` and `9099` (Java). On Windows, allow Node.js and Java on **private** networks when asked. After changing `.env`, restart `npm run mobile` with `npx expo start -c` (in `apps/mobile`) so the new values are picked up.

`apps/server/.env` is optional on the emulators. Copy `apps/server/.env.example` only if you want to change the port or invite expiry.

## Demo logins and codes

`npm run seed` prints these. The seed uses a fixed random seed, so every run gives the same codes. Re-run it to reset the used code and the demo data.

```
Gatehood demo data ready
────────────────────────────────────────────────────
Builder email     builder@demo.test
Builder password  demo1234
Valid code        A1203-CDB   (Tower A, unit 1203)
Used code         A1204-T9A   (Priya Sharma, A-1204)
Expired code      B0302-WJE
Invalid code      A9999-XYZ
────────────────────────────────────────────────────
Joined buyers: Priya Sharma (A-1204), Ravi Kumar (A-0803), Fatima Sheikh (A-1601), Arjun Menon (B-0502), Kavya Reddy (B-1404), Sameer Joshi (C-0904)
```

- **Buyer:** on the first screen, type a code. Valid joins you to Tower A, unit 1203. Used, expired and invalid each show their own message. Codes are forgiving about case and spaces (`a1203 cdb` works).
- **Builder:** tap "Builder team? Sign in with email" and sign in with the email and password above.
- **Seeded data:** 3 towers (A, B, C), 240 units with a code each, 55 notices (4 pinned), and realistic read counts.
- **Try an import:** in Buyers → Import, pick `sample/buyers.csv` (copy it to the phone first). It has 11 good rows and one with no phone, which comes back as an error with its line number. Importing it a second time creates nothing new.

To try both roles at once, use two phones (or a phone and an emulator).

## Using a real Firebase project

Follow [`docs/firebase-setup.md`](docs/firebase-setup.md). In short:

1. Register a **Web** app (not Android/iOS): the app uses the Firebase JS SDK so it runs in Expo Go, and the JS SDK takes the Web config.
2. Put its config in `apps/mobile/.env` (`EXPO_PUBLIC_FIREBASE_*`) and set `EXPO_PUBLIC_USE_EMULATORS=0`.
3. Download a service-account key to `apps/server/service-account.json` (gitignored) and set `FIREBASE_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS`, `BUILDER_EMAIL` and `BUILDER_PASSWORD` in `apps/server/.env`. Leave both `*_EMULATOR_HOST` lines out.
4. Deploy the rules and indexes:
   ```bash
   npx firebase deploy --only firestore:rules,firestore:indexes --project <project-id> --config firebase/firebase.json
   ```
5. `npm run seed`, `npm run server`, `npm run mobile` as above.

Every variable is listed, with comments, in `apps/server/.env.example` and `apps/mobile/.env.example`.

## Running the tests

```bash
npm test
```

This runs all three workspaces. The server suite starts its own emulators, so stop `npm run emulators` first (they share ports).

| Workspace | What it covers |
|---|---|
| `packages/shared` | audience keys, invite code format and loose typing, messy CSVs (BOM, CRLF, blank lines, duplicates), feed sorting |
| `apps/server` | redeem (valid / 404 / 409 / 410, two phones at once), CSV import, overview and buyers, notices and audiences, read counts counted once, stats, seed; plus the Firestore **security rules** (buyers see only their notices, nobody writes from the app) |
| `apps/mobile` | feed model, offline cache format, labels, query building, builder screen logic |

One workspace at a time: `npm test -w packages/shared`, `npm test -w apps/server` (or `npm run test:rules -w apps/server` for the rules only), `npm test -w apps/mobile`. The app also type-checks and lints: `npm run typecheck -w apps/mobile` and `npm run lint -w apps/mobile`.

## Project structure

```
apps/mobile/        Expo app (expo-router routes in src/app: (auth), (buyer), (builder))
apps/server/        Express API, seed script, server and rules tests
packages/shared/    types, zod schemas, audience keys, invite codes, CSV parser, feed sorting
firebase/           firestore.rules, firestore.indexes.json, emulator config
sample/buyers.csv   a CSV to try the import with
docs/               design, plan, per-module and per-phase docs, Firebase setup
```

More detail:
- design: [`docs/superpowers/specs/2026-11-23-gatehood-buyer-updates-design.md`](docs/superpowers/specs/2026-11-23-gatehood-buyer-updates-design.md)
- each module (shared, rules, server routes, seed, app screens): [`docs/modules/`](docs/modules/README.md)
- the database and why Firestore: [`docs/database.md`](docs/database.md)

## Optional: deploying the server online

The video and the quick start run the server locally. To put it online (for example on Render or Railway):

- **Root directory:** the repo root. **Build:** `npm install`. **Start:** `npm start -w apps/server`.
- **Environment:** `FIREBASE_PROJECT_ID`, `INVITE_TTL_DAYS`, and the service-account key as a secret file, with `GOOGLE_APPLICATION_CREDENTIALS` pointing at it. The host sets `PORT`.
- It needs a real Firebase project (see above); the emulators only run locally.
- Then set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` to the server's `https://` address.
