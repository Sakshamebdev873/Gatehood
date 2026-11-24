# Phase-wise plan

There is one file per phase. Do them in order: each phase needs the one before it.

| # | Phase | Stage | Depends on |
|---|---|---|---|
| 01 | [Repo and shared code](phase-01-repo-and-shared.md) | Backend | — |
| 02 | [Security rules](phase-02-security-rules.md) | Backend | 01 |
| 03 | [Server base](phase-03-server-base.md) | Backend | 01, 02 |
| 04 | [Invite codes](phase-04-invite-codes.md) | Backend | 03 |
| 05 | [CSV import and overview](phase-05-csv-import.md) | Backend | 04 |
| 06 | [Notices and read counts](phase-06-notices-read-counts.md) | Backend | 05 |
| 07 | [Seed data](phase-07-seed-data.md) | Backend | 04, 06 |
| 08 | [App setup, theme and splash](phase-08-app-setup.md) | App | 01, 07 |
| 09 | [Join and builder sign-in](phase-09-join-screens.md) | App | 08 |
| 10 | [My Unit and live feed](phase-10-my-unit-and-feed.md) | App | 09 |
| 11 | [Notice detail](phase-11-notice-detail.md) | App | 10 |
| 12 | [Builder screens](phase-12-builder-screens.md) | App | 09 |
| 13 | [README, NOTE and final check](phase-13-ship.md) | Ship | all |

Each file has six parts:
- **Goal:** what the phase is for
- **Builds:** the features
- **Files:** what gets created
- **Steps:** in order
- **Done when:** how we know it works
- **Hands to next phase:** what later phases rely on

Background:
- the database (Firestore), what it stores, and its strengths and weaknesses: `docs/database.md`
- Firebase console setup: `docs/firebase-setup.md`
- the design: `docs/superpowers/specs/2026-11-23-gatehood-buyer-updates-design.md`
- the task-level detail and test code: `docs/superpowers/plans/2026-11-23-gatehood-buyer-updates.md`
- the whole plan on one page: `docs/BUILD-PLAN.md`
