# M1 Shared

**Folder:** `packages/shared` · **Built in:** phase 01 · **Used by:** every other code module

## Job
Hold the types and pure logic that the app and the server must agree on, so the two can never drift apart.

## Files
```
src/index.ts      re-exports everything
src/types.ts      domain and API types
src/schemas.ts    zod request schemas
src/audience.ts   audience keys
src/invite.ts     unit ids and invite codes
src/csv.ts        buyer CSV parser
src/feed.ts       feed merge/sort, days until possession
test/*.test.ts
```

## Features and what others use

| Export | What it does | Used by |
|---|---|---|
| `Notice`, `NoticeTarget`, `BuyerRow`, `RowError`, `Role`, `ApiErrorCode` | Shared types | all |
| `RedeemResponse`, `ImportResult`, `OverviewResponse`, `BuyersResponse`, `NoticeStats` | API response shapes | M4–M6, M9–M11 |
| `RedeemRequest`, `ImportRequest`, `CreateNoticeRequest`, `PinRequest` | Input validation (zod) | M3–M6 |
| `audienceKeysFor({towerId, unitId})` | Gives `['all','tower:A','unit:A-1204']` | M6, M10 |
| `audienceForTarget(target)` | Whole project / towers / units → keys | M6 |
| `intersects(a, b)` | Do two key lists share a key? | M6 |
| `unitIdOf('A','1204')` | Gives `A-1204` | M5, M7 |
| `generateInviteCode('A','1204')` | Gives `A1204-7KQ`, with no 0/O/1/I in the suffix | M5, M7 |
| `normalizeInviteCode(' a1204 7kq ')` | Gives `A1204-7KQ`, or null if invalid | M4, M9 |
| `parseBuyersCsv(text)` | Rows, plus errors with line numbers; duplicates skipped | M5, M11 |
| `mergeNoticePages(pages)` | Pinned first, then newest, no duplicates | M10 |
| `daysUntil(date, now)` | Days to possession; never below 0 | M10 |

## Uses
`zod` and `papaparse`. It doesn't use any other module.

## Tests (vitest)
- **Audience:** the keys for a buyer; towers and units targets; an empty list is rejected.
- **Codes:** fixed and random generation; lowercase, spaces and missing dash all clean up; garbage gives null.
- **CSV:** BOM, Windows line endings, header case and spaces, blank lines, missing phone, duplicate row, missing column.
- **Feed:** merge order and no duplicates; `daysUntil` gives 418 days to 15 Jan 2028 from 23 Nov 2026.
