# M6 Server: notices

**Folder:** `apps/server/src/routes/notices.ts` · **Built in:** phase 06 · **Used by:** M10 (mark read), M11 (post, pin, stats), M7 (seed)

## Job
Post targeted notices, pin them, count reads exactly, and say who hasn't read.

## Endpoints

| Endpoint | Who | What it does |
|---|---|---|
| `POST /api/builder/notices { title, body, target, pinned }` | builder | Turns the target into audience keys. Unknown units give 400, naming them. Returns `{ id }`. |
| `PATCH /api/builder/notices/:id { pinned }` | builder | Pin or unpin |
| `POST /api/notices/:id/read` | buyer | Records one receipt per buyer and adds 1 to the count only if the receipt is new. Returns `{ counted }`. |
| `GET /api/builder/notices/:id/stats` | builder | Returns `NoticeStats` |

## Mark read, step by step (one transaction)
1. If the notice is missing: 404.
2. If the buyer's keys don't meet the notice's audience: 403.
3. If the receipt already exists: `{ counted: false }`.
4. Otherwise write `notices/{id}/reads/{uid}` and `members/{uid}/reads/{id}`, and increment `readCount` by 1.

## Stats
- `readCount`
- `joinedInAudience`
- `byTower`: read and joined for each tower
- `notRead`: name and unit of each buyer who hasn't read
- `notJoined`: invited buyers in the audience who haven't joined yet

## Data it writes
```
notices/{id}   title, body, pinned, createdAt, createdBy, target, audience[], readCount
notices/{id}/reads/{uid}    unitId, towerId, readAt
members/{uid}/reads/{id}    readAt
```

## What others use
`markRead(db, user, noticeId)`, which M7 uses to create realistic read counts.

## Uses
M1 (`audienceForTarget`, `audienceKeysFor`, `intersects`) and M3.

## Tests
- Audience is built correctly, and an unknown unit gives 400.
- Pinning works.
- Three reads, two of them at the same moment, give a count of 1.
- A buyer outside the audience gets 403; a missing notice gives 404.
- Stats exactly match a known setup.

## At scale (for the note)
One counter document handles about 1 write per second. That's fine for hundreds of units. Larger projects would split the counter across N documents.
