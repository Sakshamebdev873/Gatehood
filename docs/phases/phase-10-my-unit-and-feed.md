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
apps/mobile/src/features/feed/{queries.ts,cache.ts,useFeed.ts,ReadState.tsx}
apps/mobile/src/components/NoticeRow.tsx
apps/mobile/app/(buyer)/index.tsx
apps/mobile/app/(buyer)/updates/index.tsx
```

## Steps
1. Build the feed queries (using phase 02's answer: one query or three for "All").
2. Build `useFeed`: the live first page, more pages on scroll, merging without duplicates, the cache, and offline detection.
3. Build the read state: listen to the buyer's receipts, and mark read on screen straight away.
4. Build the My Unit and Updates screens and the first-launch loading screen.
5. Check by hand on both phones (list below).
6. Commit.

## Done when
- A buyer sees only notices meant for them, with pinned ones first.
- Scrolling loads 15 more each time, to the end.
- Each filter changes the list.
- A notice posted to Tower A appears live for a Tower A buyer, and never for a Tower B buyer.
- With airplane mode on and the app restarted, the saved feed shows under the offline banner.
- With the server down and nothing saved, the error screen appears, and Retry works once the server is back.

## Hands to next phase
`useReadState().markRead()`, and notices in the saved feed for the detail screen.
