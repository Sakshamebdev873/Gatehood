# Phase 06: Notices and read counts

**Stage:** Backend · **Depends on:** 05

## Goal
The builder posts targeted notices and pins them. Buyers mark them read. Read counts are always exact, and the builder sees who hasn't read.

## Builds
- `POST /api/builder/notices { title, body, target, pinned }`:
  - the target is the whole project, chosen towers or chosen units
  - the server turns the target into audience keys
  - unknown units are rejected with 400, which names them
- `PATCH /api/builder/notices/:id { pinned }`: pin or unpin.
- `POST /api/notices/:id/read` (buyer), in one transaction:
  - notice missing: **404**
  - the buyer isn't in its audience: **403**
  - receipt already exists: `{ counted: false }`
  - otherwise write the receipt (under the notice, and under the buyer) and add 1 to `readCount`
- `GET /api/builder/notices/:id/stats` returns:
  - read count, and joined buyers in the audience
  - read and joined counts per tower
  - the list of who hasn't read, with name and unit
  - the count of invited buyers who haven't joined yet

The read logic is exported as `markRead()` for the seed script.

## Files
```
apps/server/src/routes/notices.ts
apps/server/test/notices.test.ts
```

## Steps
1. Write the tests:
   - audience built correctly, and an unknown unit gives 400
   - pinning works
   - reading three times (twice at once) gives a count of 1
   - a buyer outside the audience gets 403
   - a missing notice gives 404
   - stats exactly match a known setup: 3 joined in A, 1 in B, 1 in C, 2 reads in A
2. Watch them fail, write the routes, watch them pass.
3. Run the whole server test suite.
4. Commit.

## Done when
- Read counts can never be doubled or faked.
- The not-read list is correct.
- The whole server suite is green.

## Hands to next phase
- Notices with `audience` and a live `readCount`.
- Receipts under `members/{uid}/reads`, which the app listens to for read and unread dots.
- `markRead(db, user, noticeId)`.
