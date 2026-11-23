# M9 App: sign-in

**Folder:** `apps/mobile/app/(auth)` · **Built in:** phase 09 · **Used by:** every buyer and builder (first screen)

## Job
Get a buyer in with an invite code, and a builder in with email.

## Screens

| Screen | File | Does |
|---|---|---|
| Join | `(auth)/index.tsx` | Code field in mono (`A1204-7KQ`), Join button, error messages, link to builder sign-in |
| Builder sign-in | `(auth)/builder.tsx` | Email and password |

## Messages

| Case | Text |
|---|---|
| Invalid code | "We couldn't find that code. Check it against your allotment letter." |
| Used code | "This code was already used on another phone. Ask the site office for a fresh code." |
| Expired code | "This code has expired. Ask the site office for a new one." |
| No internet | "Can't reach the server. Check your connection and try again." |
| Wrong builder login | "Email or password is wrong." |

## Flow
1. The Join button stays off until `normalizeInviteCode` (M1) accepts the input.
2. It calls `POST /api/invites/redeem` (M4).
3. It signs in with the returned token.
4. M8's routing moves the buyer to the buyer tabs.

## Uses
M1, M4, M8.

## Checks (by hand, with the seed's demo codes)
- Each bad code shows its message.
- The valid code opens the buyer tabs.
- The builder login opens the builder tabs.
