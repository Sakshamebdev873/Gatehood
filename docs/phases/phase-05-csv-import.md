# Phase 05: CSV import and overview

**Stage:** Backend · **Depends on:** 04

## Goal
The builder imports buyers from a CSV, gets an invite code for each one, and can see who has joined, by tower.

## Builds
- `POST /api/builder/import { csv }` (builder only):
  - parses the file with the shared parser
  - creates towers and units that don't exist yet, and one invite per buyer
  - codes expire 30 days after import
  - a row already imported (same unit and phone) is skipped
  - returns `created`, `skipped`, the errors per row, and the new codes
- `GET /api/builder/overview`: per tower, the number of units, invited buyers and joined buyers.
- `GET /api/builder/buyers?tower=A`: each buyer's code and status (joined, pending or expired), sorted by unit.
- `sample/buyers.csv`: about 12 rows across towers A, B and C, with one bad row for the demo.

## Files
```
apps/server/src/routes/{import,builder}.ts
apps/server/test/import.test.ts
sample/buyers.csv
```

## Steps
1. Write the tests:
   - import the sample file
   - import it again, which should create nothing
   - a buyer trying to import, which should give 403
   - an empty body, which should give 400
   - overview counts and buyer statuses
2. Watch them fail, write the routes, watch them pass. Write in batches of at most 450.
3. Commit.

## Done when
- Importing the sample creates the right number of codes and reports the bad row by line number.
- Importing it again creates 0.
- Overview shows joined counts per tower correctly after one code is redeemed.

## Hands to next phase
Towers, units and invites in the database, plus the overview and buyers endpoints the builder screens will call.
