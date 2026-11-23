# Phase 03: Server base

**Stage:** Backend · **Depends on:** 01, 02

## Goal
Stand up the TypeScript Express server with Firebase admin access, a login check by role, and one error format.

## Builds
- **Firebase admin connection:** uses the emulators when the emulator host variables are set, otherwise a real project through a service-account file that is never committed.
- **App factory** `createApp({ db, auth, now })`, so tests can pass in a fake clock.
- **Login check** `requireRole('builder' | 'buyer')`:
  - reads the Firebase ID token from the `Authorization` header
  - no token or a bad token gives 401
  - the wrong role gives 403
- **Errors** always look like `{ "error": { "code", "message" } }`. Invalid input gives 400.
- `GET /health`.
- Test helpers: clear the emulator database, and get a real ID token for a test user.

## Files
```
apps/server/src/{firebase,app,errors,index}.ts
apps/server/src/middleware/auth.ts
apps/server/test/{helpers,auth}.test.ts
apps/server/.env.example
```

## Steps
1. Write the tests: `/health` gives 200; a builder-only route gives 401, 403 and 200 for no token, a buyer and a builder.
2. Add the `test:emu` script, which runs the tests inside the Firebase emulators.
3. Watch them fail, write the code, watch them pass.
4. Commit.

## Done when
- `npm run test:emu -w apps/server` passes.
- The server starts on port 4000.
- `.env.example` lists every variable, and `.env` is gitignored.

## Hands to next phase
`createApp`, `requireRole`, `HttpError`, and the test helpers `makeApp`, `clearFirestore` and `idTokenFor`.
