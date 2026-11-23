# M3 Server core

**Folder:** `apps/server/src` · **Built in:** phase 03 · **Used by:** M4, M5, M6, M7

## Job
The base of the TypeScript Express server: the Firebase admin connection, the login check, errors and startup.

## Files
```
src/firebase.ts           initAdmin(): { db, auth }
src/app.ts                createApp({ db, auth, now? })
src/errors.ts             HttpError, errorHandler
src/middleware/auth.ts    requireRole('builder' | 'buyer')
src/index.ts              listen on PORT (default 4000), 0.0.0.0
test/helpers.ts           makeApp, clearFirestore, idTokenFor
.env.example
```

## Features
- **Firebase connection:** uses the emulators when `FIRESTORE_EMULATOR_HOST` / `FIREBASE_AUTH_EMULATOR_HOST` are set. Otherwise it uses a real project through `GOOGLE_APPLICATION_CREDENTIALS`, which is never committed.
- **Login check:**
  - reads `Authorization: Bearer <Firebase ID token>`
  - sets `req.user = { uid, role, towerId?, unitId? }`
  - no token or a bad token gives 401; the wrong role gives 403
- **Errors:** always `{ "error": { "code", "message" } }`. Invalid input gives 400 `bad_request`.
- **Routes:** `GET /health` gives `{ ok: true }`. CORS is on and JSON bodies are limited to 2 MB.
- **Fake clock:** `now` can be passed in, so tests can check expiry.

## Env variables
`PORT`, `FIREBASE_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS`, `FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`, `INVITE_TTL_DAYS`, `BUILDER_EMAIL`, `BUILDER_PASSWORD`

## Uses
M1 (types, schemas), plus `express`, `firebase-admin`, `zod`, `cors` and `dotenv`.

## Tests (vitest + supertest, inside the emulators via `npm run test:emu`)
- `/health` gives 200.
- A builder-only route gives 401 with no token, 403 for a buyer, and 200 for a builder.
