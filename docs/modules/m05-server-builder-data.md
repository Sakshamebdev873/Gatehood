# M5 Server: builder data

**Folder:** `apps/server/src/routes/import.ts`, `apps/server/src/routes/builder.ts` · **Built in:** phase 05 · **Used by:** M11 (builder screens)

## Job
Import buyers from a CSV, create their invite codes, and report who has joined by tower.

## Endpoints (all builder only)

| Endpoint | What it does | Returns |
|---|---|---|
| `POST /api/builder/import { csv }` | Parses the CSV (M1). Creates missing towers and units and one invite per buyer, expiring in 30 days. Skips rows already imported (same unit and phone). | `ImportResult`: created, skipped, errors per row, new codes |
| `GET /api/builder/overview` | Per tower: units, invited, joined | `OverviewResponse` |
| `GET /api/builder/buyers?tower=A` | Each buyer's code and status (joined, pending or expired), sorted by unit | `BuyersResponse` |

## Data it writes
```
towers/{id}     name, floors, progressPct, possessionDate, unitCount
units/{unitId}  towerId, number, config, areaSqft
invites/{code}  unitId, towerId, name, phone, expiresAt, usedBy, usedAt
```

## Also owns
`sample/buyers.csv`: about 12 rows across A, B and C, with one bad row for the demo.

## Uses
M1 (`parseBuyersCsv`, `generateInviteCode`, `unitIdOf`) and M3.

## Tests
- Importing the sample gives the right `created` count, the bad row reported by line, and codes in the right format.
- Importing again gives 0 created, with everything skipped.
- A buyer token gives 403; a missing CSV gives 400.
- Overview and buyer statuses are correct after one code is redeemed and one invite has expired.
