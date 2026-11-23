# Phase 09: Join and builder sign-in

**Stage:** App · **Depends on:** 08

## Goal
Buyers join with an invite code, with a clear message for each kind of bad code. The builder signs in with email.

## Builds
- **Join screen**, matching the mockup:
  - eyebrow "Buyer access"
  - headline "Join your / *home's updates.*"
  - a large code field in mono, with placeholder `A1204-7KQ`. The Join button stays off until the code looks valid.
  - messages, shown under the field with a red border:

    | Case | Message |
    |---|---|
    | Invalid | "We couldn't find that code. Check it against your allotment letter." |
    | Used | "This code was already used on another phone. Ask the site office for a fresh code." |
    | Expired | "This code has expired. Ask the site office for a new one." |
    | No internet | "Can't reach the server. Check your connection and try again." |

  - on success, sign in, and the app moves to the buyer tabs
  - link at the bottom: "Builder team? Sign in with email"
- **Builder sign-in:** email and password. A wrong login shows "Email or password is wrong."

## Files
```
apps/mobile/app/(auth)/index.tsx
apps/mobile/app/(auth)/builder.tsx
```

## Steps
1. Build both screens.
2. Test with the four demo codes printed by the seed, and with the builder login.
3. Run the type check and lint.
4. Commit.

## Done when
- Each demo code shows its message on a real phone.
- The valid code opens the buyer tabs.
- The builder login opens the builder tabs.

## Hands to next phase
A signed-in buyer whose tower and unit are known, which the feed needs.
