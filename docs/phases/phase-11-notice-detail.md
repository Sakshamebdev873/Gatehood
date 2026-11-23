# Phase 11: Notice detail

**Stage:** App · **Depends on:** 10

## Goal
Give a notice a full screen. Opening it is the moment it counts as read.

## Builds
- **Notice screen:**
  - the audience label, plus a pin tag when pinned
  - the title in serif, and the date in mono
  - the full text
- **Marking read:** opening the screen marks the notice read. The dot disappears from the list at once, and the server records it.
- **Offline:** if the phone is offline, it shows as read straight away and is sent to the server once the phone is back online.
- **States:** loading, and "This update isn't available." with a Back button when the notice is missing or not allowed.

## Files
```
apps/mobile/app/(buyer)/updates/[id].tsx
```

## Steps
1. Build the screen. It loads from the saved feed first, then from Firestore.
2. Call `markRead` when the screen opens.
3. Check:
   - open an unread notice
   - open it again
   - open one while offline
   - watch the builder's count in the emulator UI (`localhost:4001`)
4. Commit.

## Done when
- The builder's read count goes up by exactly 1 per buyer, even after the notice is opened twice.
- A read made while offline counts once the phone is back online.

## Hands to next phase
Real read receipts flowing in, which the builder stats screen shows live.
