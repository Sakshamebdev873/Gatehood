# Phase 01: Repo and shared code

**Stage:** Backend · **Depends on:** nothing

## Goal
Set up one repo that holds the app, the server and the shared code. Write the pure logic that both sides use, with tests.

## Builds
- An npm workspaces monorepo: `apps/mobile`, `apps/server` and `packages/shared`.
- In `packages/shared`:
  - **Types:** Notice, NoticeTarget, BuyerRow, the API response types, and the error codes.
  - **zod schemas:** for each API request (redeem, import, create notice, pin).
  - **Audience keys:** a buyer in A-1204 gets `all`, `tower:A` and `unit:A-1204`. A notice for towers A and B gets `tower:A` and `tower:B`.
  - **Invite codes:**
    - format `A1204-7KQ`, generated from tower and unit
    - the suffix uses no 0, O, 1 or I
    - typed input is cleaned up, so `a1204 7kq` becomes `A1204-7KQ`
  - **CSV parser:**
    - reads tower, unit, name, phone and an optional config column
    - reports bad rows with their line number
    - skips duplicates
  - **Feed helpers:** merging pages (pinned first, then newest, no duplicates) and days-until-possession.

## Files
```
package.json  tsconfig.base.json  .gitignore  .nvmrc
packages/shared/src/{index,types,schemas,audience,invite,csv,feed}.ts
packages/shared/test/{audience,invite,csv,feed}.test.ts
```

## Steps
1. Create the root `package.json` with workspaces and the shared `tsconfig`.
2. Write the tests first: audience, invite, CSV and feed.
3. Run them and watch them fail.
4. Write each function until the tests pass.
5. Build the shared package with `tsc`.
6. Commit.

## Done when
- `npm test -w packages/shared` passes.
- The CSV test covers BOM, Windows line endings, header case and spaces, blank lines, a missing phone and a duplicate row.
- The code test covers lowercase, spaces and a missing dash.

## Hands to next phase
`@gatehood/shared` with:
- `audienceKeysFor` and `audienceForTarget`
- `unitIdOf`, `generateInviteCode` and `normalizeInviteCode`
- `parseBuyersCsv`
- `mergeNoticePages` and `daysUntil`
- the request schemas and API types
