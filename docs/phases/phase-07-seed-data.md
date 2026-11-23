# Phase 07: Seed data

**Stage:** Backend · **Depends on:** 04, 06

## Goal
One command fills the database with realistic demo data, so reviewers and the video have something real to show.

## Builds
`npm run seed` wipes the demo data, then creates:
- **3 towers:**
  - A: 62% built, possession 15 Jan 2028
  - B: 48% built, possession 30 Jun 2028
  - C: 31% built, possession 31 Dec 2028
- **240 units:** 20 floors × 4 units per tower. Types cycle 2BHK, 3BHK, 3BHK and 4BHK, with areas of 1,180 to 2,150 sq ft.
- **240 invite codes**, one of them already expired.
- **6 joined demo buyers**, including Priya Sharma in A-1204. They're created with the real `redeemInvite()`.
- **55 notices over the last 60 days:**
  - about half go to everyone, a third to towers and the rest to units
  - 4 are pinned, such as "Site visit day on Sat 7 Dec"
  - topics are realistic: water, lifts, slab casting, payments, tile selection
- **Read receipts** for about 60% of eligible buyers, created with the real `markRead()` so the counts are exact.
- A builder account. On the emulator the login is `builder@demo.test` / `demo1234`; on a real project it comes from env variables.

At the end it prints a table: the builder login, plus four demo codes (valid, used, expired, invalid).

## Files
```
apps/server/src/seed.ts
apps/server/test/seed.test.ts
```

## Steps
1. Write the test for the counts (3 towers, 240 units, 55 notices, 4 pinned, 6 buyers), the demo codes behaving as labelled, every `readCount` matching its receipts, and a re-run giving the same result.
2. Watch it fail, write the seed with a fixed random seed so every run is the same, watch it pass.
3. Run it for real on the emulator and check the printed table.
4. Commit.

## Done when
`npm run seed` finishes, prints the logins and codes, and gives the same result every time it runs.

## Hands to next phase
A full demo database, and the logins and codes for testing the app.
