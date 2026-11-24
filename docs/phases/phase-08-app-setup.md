# Phase 08: App setup, theme and splash

**Stage:** App · **Depends on:** 01, 07

## Goal
Create the Expo app with Gatehood's look, the splash screen, the Firebase connection, and routing by role.

## Builds
- An Expo app made with `create-expo-app@latest` (expo-router, TypeScript), cleared of its example screens.
- **Theme (direction A):**
  - colours: forest `#2D6A4F`, amber `#F4A261` / `#C2651A`, ivory `#FBF8F2`, ink `#1A1A1A`
  - fonts: Cormorant Garamond (headlines with an italic green second line), DM Sans (body) and JetBrains Mono (small capitals labels)
- **Text pieces:** `<Display em>`, `<Eyebrow>` and `<Body>`.
- **Shared components:** Card, Button, Segmented, TabIcon (with a badge), LaunchLoading.
- **Screen-state components:**
  - `LoadingCards`
  - `Empty`
  - `ErrorRetry`
  - `OfflineBanner`, showing "Offline · showing updates from 9:12 am"
- **Splash:** the three-towers icon on ivory. It stays up until the fonts load and the login state is known.
- **Firebase client:** uses the **Firebase JS SDK**, set up from a **Web** app config, not the Android/iOS native library. That keeps the app running in Expo Go on both phones. See the design document, section 4.1, and `docs/firebase-setup.md`.
  - logins persist through AsyncStorage
  - connects to the emulators when `EXPO_PUBLIC_USE_EMULATORS=1`
- **API client:** adds the login token to each request, and turns errors into readable messages.
- **Routing by role:**
  - signed out: the join screens
  - buyer: the buyer tabs (Home, Updates)
  - builder: the builder tabs (Towers, Notices, Buyers)
  - icon tab bars throughout

## Files
```
apps/mobile/app/_layout.tsx  app/(auth)/_layout.tsx  app/(buyer)/_layout.tsx  app/(builder)/_layout.tsx
apps/mobile/src/theme/{tokens.ts,type.tsx}
apps/mobile/src/lib/{firebase.ts,api.ts}
apps/mobile/src/auth/AuthProvider.tsx
apps/mobile/src/components/{Card,Button,Segmented,StateViews,TabIcon,LaunchLoading}.tsx
apps/mobile/.env.example  apps/mobile/app.json
```

## Steps
1. Create the Expo app inside the workspace and add `@gatehood/shared`.
2. Add the theme, fonts and components.
3. Add the Firebase and API clients and the login provider.
4. Add the root layout, with the splash hold and role routing.
5. Run the type check and lint, then open the app in Expo Go on Android and iOS.
6. Commit.

## Done when
- The app opens on both phones and shows the ivory splash, then the join screen.
- The type check and lint are clean.

## Hands to next phase
- `useAuth()`, which gives the status (signed out, buyer or builder) plus the buyer's tower and unit.
- `api()`.
- The theme and the state components that every screen uses.
