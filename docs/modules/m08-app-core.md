# M8 App core

**Folder:** `apps/mobile/src`, `apps/mobile/app/_layout.tsx` · **Built in:** phase 08 · **Used by:** M9, M10, M11

## Job
Everything every screen needs: Gatehood's look, shared components, the Firebase and API connections, login state, the splash and routing by role.

## Files
```
src/theme/tokens.ts       colours, fonts, spacing, radius
src/theme/type.tsx        <Display em>, <Eyebrow>, <Body>
src/lib/firebase.ts       app, auth (saved on phone), db; emulator switch
src/lib/api.ts            api<T>(path, opts) with login token; ApiError
src/auth/AuthProvider.tsx useAuth()
src/components/           Card, Button, Segmented, StateViews, TabIcon, LaunchLoading
app/_layout.tsx           fonts, splash hold, role routing
app/(auth|buyer|builder)/_layout.tsx
app.json  .env.example
```

## Features
- **Look (direction A):**
  - colours: forest `#2D6A4F`, amber `#F4A261` / `#C2651A`, ivory `#FBF8F2`, ink `#1A1A1A`, line `#E8E4DC`
  - fonts: Cormorant Garamond for headlines (italic green second line), DM Sans for body, JetBrains Mono for small capitals labels
- **Screen states:**
  - `LoadingCards` (skeleton cards)
  - `Empty`
  - `ErrorRetry`
  - `OfflineBanner`, showing "Offline · showing updates from 9:12 am"
- **Splash:** the three-towers icon on ivory. It stays up until the fonts load and the login state is known.
- **First-launch loading:** `LaunchLoading` shows steps (done, now or todo).
- **Tab icons** (lucide): Home, Bell, Building, Megaphone and Users, with an unread badge.
- **Login state:** `useAuth()` gives `{ status: loading | signedOut | buyer | builder, uid, towerId, unitId, signOut }`, read from the login claims.
- **Routing by role:** signed out goes to `(auth)`, a buyer to `(buyer)` and a builder to `(builder)`. A buyer can never reach builder screens.
- **API client:**
  - adds the login token to each request
  - errors become `ApiError { status, code, message }`
  - when there's no network, the message is "Can't reach the server. Check your connection and try again."

## Firebase library decision
The app uses the **Firebase JS SDK** (configured from a **Web** app in the Firebase console), not React Native Firebase (configured from Android/iOS apps).
- **Why:** it runs in Expo Go on both Android and iOS with one config, and reviewers need no native builds, Mac or Apple account.
- **Cost:** no push notifications or native offline database. The last feed is saved to AsyncStorage instead, which covers the brief's offline requirement.

Full comparison: design document section 4.1. Console steps: `docs/firebase-setup.md`.

## Env variables
`EXPO_PUBLIC_FIREBASE_*` (from the Web app config), `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_USE_EMULATORS`, `EXPO_PUBLIC_EMULATOR_HOST`

## Uses
M1, plus Expo, expo-router, Firebase JS SDK, AsyncStorage, NetInfo, `@expo-google-fonts/*` and `lucide-react-native`.

## Checks
The type check and lint are clean. It opens in Expo Go on Android and iOS: the ivory splash, then the join screen.
