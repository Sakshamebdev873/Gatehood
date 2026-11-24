# Firebase setup (real project, optional)

**You don't need this to run the app.** By default everything runs on the Firebase emulators with no credentials. Use these steps only when you want a real Firebase project, for example `gatehood-9ef1e`.

## Why a "Web" app and not an Android app?
The app uses the **Firebase JS SDK** so it runs in **Expo Go** on Android and iOS without a native build. The JS SDK uses Firebase's **Web** config.

Registering an Android app (`google-services.json`) or an iOS app (`GoogleService-Info.plist`) is only needed for **React Native Firebase**. That needs custom native builds, and an iOS reviewer would need a Mac or a paid Apple account.

The app is still a real Android and iOS app: "Web" is only the name of the config type. The full comparison is in the design document, section 4.1.

## Steps

### 1. Register a Web app (used by the mobile app)
1. Firebase console → Project Overview → **Add app** → the **Web** icon `</>`.
   - Don't use the Android or iOS options. Close those if you opened them.
2. Nickname: `gatehood-mobile`. Leave **Firebase Hosting unticked**.
3. Click **Register app**, then copy the values from the `firebaseConfig` block into `apps/mobile/.env`:
   ```
   EXPO_PUBLIC_FIREBASE_API_KEY=...
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=<project-id>.firebaseapp.com
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=<project-id>
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   EXPO_PUBLIC_FIREBASE_APP_ID=...
   EXPO_PUBLIC_USE_EMULATORS=0
   ```

### 2. Turn on Authentication
1. Build → **Authentication** → Get started → Sign-in method → enable **Email/Password**. This is for the builder login.
2. Nothing else is needed. Buyers sign in with a token the server creates (a custom token), which doesn't need a provider switched on.

### 3. Create the Firestore database
1. Build → **Firestore Database** → Create database. Use Firestore, not Realtime Database. The reasons are in `docs/database.md`.
2. Edition: **Standard**, if asked. Database ID: `(default)`.
3. Location: `asia-south1` (Mumbai). This can't be changed later. Start in **production mode**.
4. Deploy our rules and indexes over it:
   ```
   npx firebase deploy --only firestore:rules,firestore:indexes --project <project-id> --config firebase/firebase.json
   ```

### 4. Server key (used by the TypeScript server)
1. Project settings (gear icon) → **Service accounts** → **Generate new private key**.
2. Save the file as `apps/server/service-account.json`. It's gitignored: **never commit or share it**.
3. In `apps/server/.env`:
   ```
   FIREBASE_PROJECT_ID=<project-id>
   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
   BUILDER_EMAIL=<builder email>
   BUILDER_PASSWORD=<builder password>
   ```
4. Leave `FIRESTORE_EMULATOR_HOST` and `FIREBASE_AUTH_EMULATOR_HOST` unset, so the server talks to the real project.

### 5. Seed and run
```
npm run seed      # creates builder, towers, units, codes, notices in the real project
npm run server
npm run mobile
```

## What never goes in git
- `apps/mobile/.env`
- `apps/server/.env`
- `apps/server/service-account.json`

Only the `.env.example` files are committed.
