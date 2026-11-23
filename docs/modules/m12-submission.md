# M12 Submission

**Files:** `README.md`, `NOTE.md` · **Built in:** phase 13 · **Used by:** the Gatehood reviewers

## Job
Make the project easy to set up and judge: a README that works on the first try, a sharp note, and a video script.

## README.md sections
1. **What it is:** a paragraph and screenshots.
2. **What you need:** Node 20+, Java 11+, Expo Go.
3. **Quick start on the emulators, with no credentials:** `npm install` → `npm run emulators` → `npm run seed` → `npm run server` → set the LAN IP in `apps/mobile/.env` → `npm run mobile`.
4. **Demo logins and codes** (from M7).
5. **Using a real Firebase project:** env variables, and deploying the rules and indexes.
6. **Running the tests.**
7. **Project structure:** links to these module docs.
8. **Optional:** deploying the server online.

## NOTE.md (250 words or fewer)

| Topic | Source module |
|---|---|
| Data model: collections and audience keys | M1, M5, M6 |
| Feed query: audience filter, pinned then newest, 15 per page, live first page | M2, M10 |
| Read counts: one receipt per buyer, counted once in a transaction; split counters at scale | M6 |
| Security rules: the app only reads what's meant for it; writes go through the server | M2, M3 |
| Trade-offs: two processes, the unread badge counts loaded pages only, first-page offline cache, the M2 risk check result | all |

## Video script (under 90 seconds)
1. The builder imports a CSV (M11).
2. The builder posts a notice to Tower A (M11).
3. The buyer tries a used code and sees the error, then joins with a valid one (M9).
4. The notice arrives live, and the buyer opens it (M10).
5. The builder's read count goes up (M11).
6. Airplane mode shows the saved feed (M10).

## Final checks
- All tests pass.
- No `.env` or service-account file is in git.
- A fresh clone works by following the README alone.
- Every brief item has been checked against the coverage table in the design document.
