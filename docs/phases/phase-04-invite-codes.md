# Phase 04: Invite codes

**Stage:** Backend · **Depends on:** 03

## Goal
A buyer types an invite code and gets signed in, linked to their tower and unit. Bad codes get a clear answer.

## Builds
`POST /api/invites/redeem { code }`. No login is needed, and it's limited to 10 tries a minute per phone.
1. Clean up the typed code. If it's not a valid format, return **404 invalid_code**.
2. In one database transaction:
   - the code doesn't exist: **404 invalid_code**
   - already used: **409 code_used**
   - expired: **410 code_expired**
   - otherwise mark it used and create the buyer's member record
3. Create the buyer's login account with claims `role: buyer`, `towerId` and `unitId`, and return a sign-in token.
4. If creating the account fails, undo step 2 so the code isn't wasted.

The core logic is exported as `redeemInvite()` so the seed script (phase 07) can reuse it.

## Files
```
apps/server/src/routes/invites.ts
apps/server/test/redeem.test.ts
```

## Steps
1. Write the tests:
   - valid code, including one typed as `' a1204 7kq '`
   - unknown code and garbage text
   - used code and expired code
   - two phones redeeming the same code at once
   - the 11th try in a minute
2. Watch them fail, write the route, watch them pass.
3. Commit.

## Done when
- A valid code returns a token whose login carries `unitId A-1204` and `towerId A`.
- The same code used twice at the same moment gives exactly one success and one 409.
- Expiry is judged by the server's clock, not the phone's.

## Hands to next phase
- Buyer accounts with the right claims.
- `members/{uid}` records.
- `redeemInvite(db, auth, code, now)`.
