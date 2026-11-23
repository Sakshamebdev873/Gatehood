# Phase 12: Builder screens

**Stage:** App · **Depends on:** 09 (and the server from 05 and 06)

## Goal
Build every screen the builder needs to import buyers, see who has joined, post notices and see who has read them.

## Builds
- **Towers tab:**
  - one card per tower, showing "Tower A", joined / invited with a progress bar, and the number of units
  - pull to refresh
  - empty state: "No buyers yet. Import a CSV to send invite codes."
- **Buyers tab:**
  - filter by tower (All, A, B, C)
  - each row shows the name, unit, code and a status chip: Joined (green), Pending (amber) or Expired (grey)
  - an "Import CSV" button
- **Import screen:**
  1. pick a CSV file from the phone
  2. preview it: the number of valid rows, and each bad row with its line and reason
  3. tap "Import N buyers"
  4. the result shows the new codes, each with a Copy button
- **Notices tab:**
  - a live list, each row with its title, audience label and "184 read", which updates live
  - a pin switch on each row
  - a "New notice" button
- **New notice screen:**
  - title and text
  - audience: Whole project, Towers (A/B/C chips) or Units (type values like `A-1204`)
  - a pin switch, and a Post button
  - errors show inline
- **Notice stats screen**, matching the mockup:
  - large "184 / 240 read" with a bar
  - a bar per tower
  - "Not read yet · 56", listing name and unit
  - "N invited but not joined"
  - updates live while a buyer reads

## Files
```
apps/mobile/app/(builder)/index.tsx
apps/mobile/app/(builder)/buyers.tsx
apps/mobile/app/(builder)/import.tsx
apps/mobile/app/(builder)/notices/{index,new,[id]}.tsx
```

## Steps
1. Build Towers, then Buyers and Import, then Notices, New notice and Stats.
2. Do a full run on two phones (below).
3. Run the type check and lint.
4. Commit.

## Done when
A full run works on two phones:
1. Import `sample/buyers.csv`. The bad row shows in the preview, and the codes are listed.
2. Join with one of the new codes on the second phone. Towers shows that buyer as joined.
3. Post a notice to Tower A only. A Tower B buyer doesn't see it, and a Tower A buyer sees it live.
4. The buyer opens it. The builder's count goes up and the buyer leaves "Not read yet".
5. Pin it. It moves to the top of the buyer's feed.

## Hands to next phase
The whole app working for both roles, ready to record.
