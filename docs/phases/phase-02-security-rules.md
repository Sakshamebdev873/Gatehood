# Phase 02: Security rules

**Stage:** Backend · **Depends on:** 01

## Goal
Lock down Firestore. The app can only read, and only what belongs to the signed-in buyer. All writes come from the server.

## Builds
- Firebase emulator config: project `demo-gatehood`, Firestore on 8080, Auth on 9099, emulator UI on 4001.
- `firestore.rules`:
  - **Notices:** the builder reads all of them. A buyer reads one only if its audience includes `all`, their tower or their unit.
  - **Units:** a buyer reads only their own unit.
  - **Towers:** any signed-in user can read.
  - **A buyer's own read receipts:** only that buyer, or the builder.
  - **Invites and the full read lists:** the builder only.
  - **Writes:** nobody can write from the app.
- `firestore.indexes.json`: an index on audience + pinned + newest, for the feed.

## Files
```
firebase/firebase.json  firebase/.firebaserc
firebase/firestore.rules  firebase/firestore.indexes.json
apps/server/test/rules.test.ts
```

## Steps
1. Write the rules tests first, for a buyer in A-1204 and for a builder.
2. Run them on the emulator and watch them fail.
3. Write the rules and indexes until the tests pass.
4. **Risk check:** confirm that the "All" filter query (`array-contains-any` on 3 keys) passes the rules.
   - If it doesn't, switch "All" to three smaller queries merged in the app, and note it in `NOTE.md`.
5. Commit.

## Done when
- A buyer can run the feed query for all three filters.
- A buyer cannot:
  - read a Tower B notice
  - list notices without a filter
  - read another unit
  - read invites
  - write anything
- The builder can read everything and write nothing.

## Hands to next phase
- The rules depend on three login claims: `role`, `towerId` and `unitId`. Phase 04 must set exactly these.
- The answer to the risk check: does the app use one query for "All", or three?
