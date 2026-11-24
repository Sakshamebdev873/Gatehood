# M7 Server: seed

**Folder:** `apps/server/src/seed.ts` · **Built in:** phase 07 · **Used by:** reviewers, the video, manual testing of M9–M11

## Job
Fill the database with realistic demo data in one command, the same result every time.

## Command
`npm run seed`. It wipes the demo data first.

## What it creates

| Item | Detail |
|---|---|
| Towers | A at 62% (possession 15 Jan 2028), B at 48% (30 Jun 2028), C at 31% (31 Dec 2028) |
| Units | 240: 20 floors × 4 units per tower. Types cycle 2BHK, 3BHK, 3BHK and 4BHK; areas 1,180 to 2,150 sq ft. |
| Invites | 240, one of them already expired |
| Buyers | 6 joined, including Priya Sharma in A-1204, created with `redeemInvite` (M4) |
| Notices | 55 over the last 60 days: about 50% to everyone, 35% to towers, 15% to units. 4 pinned. Realistic site topics. |
| Reads | About 60% of eligible buyers, created with `markRead` (M6), so counts are exact |
| Builder | `builder@demo.test` / `demo1234` on the emulator; from env variables on a real project |

## Output
A table with the builder login and four demo codes: **valid, used, expired, invalid**.

## Interface
`runSeed({ db, auth, now, rand? }): Promise<SeedSummary>`. It uses a fixed random seed, so the data is the same every run.

## Uses
M1, M3 (`initAdmin`), M4 (`redeemInvite`), M6 (`markRead`).

## Tests
- The counts are right: 3 towers, 240 units, 240 invites, 55 notices, 4 pinned, 6 buyers.
- The builder has the builder claim.
- The valid code redeems and the used code gives 409.
- Every `readCount` equals its number of receipts.
- A second run gives the same result.
