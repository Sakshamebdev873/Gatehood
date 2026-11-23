# Gatehood Assignment: Build Plan

As of 2026-11-23. The app gets built in **13 phases**: 7 for the TypeScript backend, 5 for the Expo app, and 1 to package the submission. Each phase ends with something that runs and has been checked, plus a git commit.

- **What it is:** a buyer-updates app for a builder's housing project.
  - Builders import buyers, send invite codes, post targeted notices, and see exactly who has read them.
  - Buyers join with a code and read a live feed that shows only what's meant for them.
- **Stack:** Expo, expo-router and TypeScript for the app. Express and TypeScript for the server. Firestore for data. Firebase emulators so reviewers need no credentials.
- **Look:** direction A, Notice board, using gatehood.com's colours and fonts. See `docs/design-options.html`.
- **Scope rule:** build exactly what the brief asks for. An extra stays only if it makes the submission stronger (see the last section).
- **More detail:**
  - design: `docs/superpowers/specs/2026-11-23-gatehood-buyer-updates-design.md`
  - task-level steps and tests: `docs/superpowers/plans/2026-11-23-gatehood-buyer-updates.md`

```
Stage 1: Backend (TypeScript server)      Stage 2: App (Expo, TypeScript)        Stage 3: Ship
  1 Repo + shared code                       8 App setup, theme, splash             13 README, NOTE.md,
  2 Security rules                           9 Join + builder sign-in                  final check
  3 Server base                             10 My Unit + live feed
  4 Invite codes                            11 Notice detail (mark read)
  5 CSV import + overview                   12 Builder screens
  6 Notices + read counts
  7 Seed data
        └── server works and is tested ──►       └── both roles work on phones ──►
```

---

## Stage 1: Backend (phases 1 to 7)

### Phase 1: Repo and shared code
- **Builds:**
  - An npm workspaces monorepo.
  - `packages/shared`, which holds the types, the zod schemas and the audience keys (`all`, `tower:A`, `unit:A-1204`).
  - Also in `packages/shared`: the invite code format (`A1204-7KQ`), the CSV parser and the feed sorting.
- **Done when:** the unit tests pass, including messy CSVs (BOM, CRLF, blank lines, duplicates) and loosely typed codes (`a1204 7kq` becomes `A1204-7KQ`).

### Phase 2: Security rules
- **Builds:** `firestore.rules`, the indexes and the emulator config.
  - The app can only read, and only what belongs to the buyer's tower and unit.
  - Nobody can write from the app.
- **Done when:**
  - The rules tests pass.
  - A buyer can't read another tower's notice or another unit's details.
  - The query behind the "All" filter has been checked. If the rules can't verify it, the app switches to three smaller queries merged together.

### Phase 3: Server base
- **Builds:** the Express app, the Firebase admin connection (emulator or real project), a login check by role, the error format, and `/health`.
- **Done when:** tests show 401 with no login, 403 for the wrong role, and 200 for the right role.

### Phase 4: Invite codes
- **Builds:** `POST /api/invites/redeem`. It checks the code, links the buyer to their unit and signs them in. It's rate-limited.
- **Done when:**
  - Tests pass for valid, invalid (404), used (409) and expired (410) codes.
  - Two phones using the same code at once gives exactly one success.

### Phase 5: CSV import and overview
- **Builds:**
  - `POST /api/builder/import` creates towers, units and one invite code per buyer.
  - `GET /overview` shows who has joined, by tower.
  - `GET /buyers` lists codes with their status: joined, pending or expired.
- **Done when:** importing `sample/buyers.csv` creates codes and reports the bad row, and importing it a second time creates nothing new.

### Phase 6: Notices and read counts
- **Builds:**
  - Posting a notice to all, chosen towers or chosen units, and pinning or unpinning it.
  - `POST /notices/:id/read`, which records one receipt per buyer and adds 1 to the count only if the receipt is new.
  - Stats: the read count, a count per tower, and who hasn't read.
- **Done when:**
  - Opening a notice three times counts once.
  - A buyer outside the notice's audience gets 403.
  - The stats match the test data exactly.

### Phase 7: Seed data
- **Builds:** `npm run seed`. It creates:
  - 3 towers, 240 units and 240 codes
  - 55 notices, 4 of them pinned
  - 6 joined demo buyers and realistic read counts

  It then prints the builder login and four demo codes: valid, used, expired and invalid.
- **Done when:** running it twice gives the same result, and each printed code behaves as labelled.

---

## Stage 2: App (phases 8 to 12)

### Phase 8: App setup, theme and splash
- **Builds:**
  - The Expo app with the Gatehood tokens and fonts (Cormorant Garamond, DM Sans, JetBrains Mono).
  - The splash screen.
  - The Firebase client and API client.
  - Routing by role, so a buyer can never open a builder screen.
  - Icon tab bars.
- **Done when:** it opens in Expo Go on Android and iOS, and the type check and lint are clean.

### Phase 9: Join and builder sign-in
- **Builds:**
  - The join screen, with a clear message for each of the three code errors.
  - The builder email sign-in.
- **Done when:** each demo code from the seed shows the right result on a real phone.

### Phase 10: My Unit and live feed
- **Builds:**
  - **My Unit:** unit, tower, configuration, construction %, and days to possession.
  - **Updates feed:**
    - only notices meant for this buyer, pinned first and then newest
    - All, My tower and My unit filters, loading 15 at a time
    - read and unread dots, and live updates with a "1 new update" pill
  - **Screen states:** loading, empty, error with retry, and offline (shows the last cached feed).
  - **First-launch loading screen.**
- **Done when:** on both phones, a notice posted to Tower A appears live for a Tower A buyer and never for a Tower B buyer, and airplane mode shows the cached feed.

### Phase 11: Notice detail
- **Builds:** the full notice screen. Opening it marks the notice read.
- **Done when:** the builder's count goes up by exactly 1, even after the notice is opened twice or opened while offline.

### Phase 12: Builder screens
- **Builds:**
  - **Towers:** joined vs invited.
  - **Buyers:** list of buyers, with CSV import (preview, then the codes it created).
  - **Notices:** a list with live read counts and pinning.
  - **New notice:** pick the audience (whole project, towers or units) and choose whether to pin.
  - **Notice stats:** the read count, a count per tower, and "Not read yet".
- **Done when:** a full run works on two phones: import, join, post, read, and the count updating live.

---

## Stage 3: Ship (phase 13)

### Phase 13: README, NOTE.md and final check
- **Builds:**
  - A README with setup steps a reviewer can follow exactly.
  - `NOTE.md`, 250 words or fewer, covering the data model, feed query, read counts, security rules and trade-offs.
  - A script for the video.
- **Done when:**
  - All tests pass.
  - No `.env` or service-account file is in git.
  - A fresh clone works by following the README word for word.

---

## Do extra screens help the submission?

**Yes, but only when they help a reviewer check a brief item faster or trust it more.** Reviewers judge the brief's checklist, how finished the app feels in a 90-second video, and the 250-word note. A screen that does none of those costs time, adds bugs and makes the video longer.

### Extras worth building, and why

| Extra | Not in the brief, but… | How it helps your submission |
|---|---|---|
| Splash and first-launch loading | The brief only asks for a loading *state* | The first 3 seconds of the video look like a real product, not a template. Costs very little. |
| Icon tab bars | Not mentioned | The app feels native and finished at a glance. |
| Notice detail screen | The brief only says "read and unread state" | There has to be a clear moment that counts as "read". Without it, read counts can't be accurate, and accurate read counts are the main point of the brief. |
| CSV preview with errors per row | The brief only says "import" | Shows you handle bad input, which is the first thing a reviewer tries. |
| Codes listed after import | The brief only says "each buyer gets an invite code" | The builder can actually hand codes out, and the video shows the code going from import to the buyer's phone. |
| Builder notice list with live counts | Not separately asked | The strongest moment for the video: the buyer opens a notice and the builder's count updates on screen. |
| Seed printing demo codes | Not asked | Reviewers can test the invalid, used and expired cases in seconds without reading code. |
| Server and rules tests | Not asked | They back up what you claim in the note about accurate counts and security. Reviewers trust claims they can run. |

### Extras to skip

| Extra | Why it doesn't help |
|---|---|
| Onboarding carousel or welcome slides | Burns video time and tests nothing from the brief. |
| Profile and settings screens | Not judged, and adds screens to keep consistent. |
| Dark mode | Doubles the visual QA for no checklist item. |
| Push notifications | Needs a dev build and extra setup that breaks the "runs in Expo Go" promise. |
| Editing or deleting notices | Makes read counts harder to explain (does an edited notice count as unread?). |
| Charts or analytics dashboard | The brief asks for a read count and a not-read list, and that's enough. |

**Bottom line:** every extra we're keeping either makes a brief item work properly (notice detail), makes it testable (seed codes, tests, CSV preview), or makes the 90-second video land (splash, live counts, icons). Everything else is left out on purpose.

---

## Next step

Choose how to run the build:
- **Native (recommended):** Claude builds all 13 phases in this session, with one full review at the end.
- **Subagent-driven:** a separate helper builds each phase and another reviews it. More thorough, but much more costly.
