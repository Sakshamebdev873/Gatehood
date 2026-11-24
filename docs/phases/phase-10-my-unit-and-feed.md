# Phase 10: My Unit and live feed

**Stage:** App · **Depends on:** 09

## Goal
Build the two main buyer screens: My Unit, and the live updates feed with filters, paging, read state and offline support.

## Builds
- **My Unit (Home tab):**
  - project name and a unit chip
  - "Tower A, 1204 / *3BHK · 1,640 sq ft*"
  - construction % with a progress bar
  - days to possession, and the handover month
  - the newest pinned notice
  - loading and error-with-retry states
- **Updates feed:**
  - shows only notices meant for this buyer, pinned first, then newest
  - All, My tower and My unit filters
  - 15 at a time, loading more on scroll ("15 of 52 · loading more")
  - **live:** the first page listens for changes, and new notices show a "↑ 1 new update" pill
  - **read and unread:** a dot and bold text when unread, muted when read, and an unread count on the Updates tab
  - each row shows its audience label ("Pinned · all towers", "Tower A", "Your unit · A-1204") and how long ago it was posted
- **States:**
  - loading shows skeleton cards
  - empty shows "No updates for your unit yet." (per filter)
  - error shows a Retry button
  - offline shows the last saved feed under the offline banner
- **Offline cache:** every fresh first page is saved to the phone (AsyncStorage) and shown at once on the next launch.
- **First-launch loading screen:** steps tick off as they finish (signed in, unit found, loading updates, saving for offline). It only appears when there's no saved feed yet.

## Files
```
apps/mobile/src/features/unit/useMyUnit.ts
apps/mobile/src/features/feed/{queries.ts,cache.ts,cacheFormat.ts,model.ts,labels.ts,useFeed.ts,ReadState.tsx}
apps/mobile/src/components/NoticeRow.tsx
apps/mobile/src/lib/useNow.ts
apps/mobile/src/app/(buyer)/_layout.tsx
apps/mobile/src/app/(buyer)/index.tsx
apps/mobile/src/app/(buyer)/updates/index.tsx
apps/mobile/test/{labels,model,cacheFormat,queries}.test.ts
apps/mobile/scripts/feed-check.ts
```

How it fits together:
- `model.ts` holds the feed logic with no Firebase or React in it: merging the live first page with later pages, counting new arrivals, the paging cursor, and the screen state. It is unit tested.
- `useFeed.ts` keeps one shared feed per buyer and filter, so the tab badge, Home and the Updates list all see the same loaded pages.
- "All" is one `array-contains-any` query. Phase 02 showed the rules accept it, so there is no three-query fallback.
- My Unit also saves the unit and tower on the phone, so Home still shows them offline.
- Notices marked read on a bad connection are kept on the phone and sent again when the app comes back to the front.

## Steps
1. Build the feed queries (using phase 02's answer: one query or three for "All").
2. Build `useFeed`: the live first page, more pages on scroll, merging without duplicates, the cache, and offline detection.
3. Build the read state: listen to the buyer's receipts, and mark read on screen straight away.
4. Build the My Unit and Updates screens and the first-launch loading screen.
5. Check by hand on both phones (list below).
6. Commit.

## Checks
- `npm test -w apps/mobile`: unit tests for the feed model, labels, saved-feed format and queries.
- `npx tsx apps/mobile/scripts/feed-check.ts`, with the emulators, seed and API running: signs in real buyers and checks targeting, order, paging to the end, totals, live arrival for Tower A but not Tower B, and read receipts.

## Done when
- A buyer sees only notices meant for them, with pinned ones first.
- Scrolling loads 15 more each time, to the end.
- Each filter changes the list.
- A notice posted to Tower A appears live for a Tower A buyer, and never for a Tower B buyer.
- With airplane mode on and the app restarted, the saved feed shows under the offline banner.
- With the server down and nothing saved, the error screen appears, and Retry works once the server is back.

## Hands to next phase
`useReadState().markRead()`, and notices in the saved feed for the detail screen.
