# M4 Server: invites

**Folder:** `apps/server/src/routes/invites.ts` · **Built in:** phase 04 · **Used by:** M9 (join screen), M7 (seed)

## Job
Turn an invite code into a signed-in buyer linked to their tower and unit, with a clear answer for bad codes.

## Endpoint
`POST /api/invites/redeem { code }`. No login is needed, and it's limited to 10 tries a minute per IP.

| Case | Answer |
|---|---|
| Valid | 200 `{ token }` (a custom sign-in token) |
| Wrong format or unknown | 404 `invalid_code` |
| Already used | 409 `code_used` |
| Expired | 410 `code_expired` |
| Too many tries | 429 `rate_limited` |

## How it works
1. Clean up the code with `normalizeInviteCode` (M1).
2. In one transaction, check the invite, then mark it used and create `members/{uid}` = `{ role, unitId, towerId, name, joinedAt }`.
3. Create the login account and set the claims `{ role: 'buyer', towerId, unitId }` (the claims M2 relies on).
4. If step 3 fails, undo step 2.

## What others use
`redeemInvite(db, auth, code, now)`, which M7 uses to create the demo buyers.

## Uses
M1, M3.

## Tests
- A valid code typed loosely works, and the returned login carries the right claims.
- Unknown code and garbage text both give 404.
- A used code gives 409; an expired code gives 410.
- Two redeems of one code at once give one 200 and one 409.
- The 11th try in a minute gives 429.
