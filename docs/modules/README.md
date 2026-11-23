# Module-wise plan

The project is split into 12 modules. Each module is one area of code with one job. Its file covers:
- what the module is for
- the files it owns
- its features
- what other modules use from it
- what it uses
- how it's tested
- which phase builds it

| # | Module | Folder | Job | Built in phase |
|---|---|---|---|---|
| M1 | [Shared](m01-shared.md) | `packages/shared` | Types and logic used by both the app and the server | 01 |
| M2 | [Firebase rules](m02-firebase-rules.md) | `firebase/` | Who can read what; nobody writes from the app | 02 |
| M3 | [Server core](m03-server-core.md) | `apps/server/src` | Express app, login check, errors | 03 |
| M4 | [Server: invites](m04-server-invites.md) | `apps/server/src/routes/invites.ts` | Join with a code | 04 |
| M5 | [Server: builder data](m05-server-builder-data.md) | `apps/server/src/routes/{import,builder}.ts` | CSV import, joined by tower, buyer list | 05 |
| M6 | [Server: notices](m06-server-notices.md) | `apps/server/src/routes/notices.ts` | Post, pin, mark read, read stats | 06 |
| M7 | [Server: seed](m07-server-seed.md) | `apps/server/src/seed.ts` | Demo data in one command | 07 |
| M8 | [App core](m08-app-core.md) | `apps/mobile/src`, `app/_layout.tsx` | Theme, components, Firebase and API clients, splash, routing | 08 |
| M9 | [App: sign-in](m09-app-signin.md) | `apps/mobile/app/(auth)` | Join with a code, builder sign-in | 09 |
| M10 | [App: buyer](m10-app-buyer.md) | `apps/mobile/app/(buyer)`, `src/features` | My Unit, live feed, notice detail, offline | 10, 11 |
| M11 | [App: builder](m11-app-builder.md) | `apps/mobile/app/(builder)` | Towers, buyers and import, notices, stats | 12 |
| M12 | [Submission](m12-submission.md) | `README.md`, `NOTE.md` | Setup guide, note, video | 13 |

## How the modules connect

```
                    M1 Shared (types, audience keys, codes, CSV, feed sort)
                   /                                   \
     Server side  /                                     \  App side
   M3 Server core                                     M8 App core
     ├─ M4 Invites ──────── join ─────────────────────── M9 Sign-in
     ├─ M5 Builder data ─── import, overview ─────────── M11 Builder
     ├─ M6 Notices ──────── post, read, stats ────────── M10 Buyer / M11 Builder
     └─ M7 Seed (uses M4 + M6)
                   \                                     /
                    M2 Firebase rules ── app reads Firestore directly
                                                         (feed, unit, read dots)
M12 Submission documents all of it.
```

**Rule of the build:** the app reads Firestore directly for live data. Every write goes through the server (M4, M5, M6).

Related:
- phase-wise order: `docs/phases/README.md`
- design: `docs/superpowers/specs/2026-11-23-gatehood-buyer-updates-design.md`
