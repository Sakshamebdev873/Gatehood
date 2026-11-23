# M11 App: builder

**Folder:** `apps/mobile/app/(builder)` · **Built in:** phase 12 · **Used by:** the builder's team

## Job
Let the builder import buyers, hand out codes, see who joined, post and pin notices, and see who has read them.

## Screens

| Screen | File | Shows and does |
|---|---|---|
| Towers (tab) | `(builder)/index.tsx` | Per tower: joined / invited with a bar, and a units count. Pull to refresh. Empty: "No buyers yet. Import a CSV to send invite codes." |
| Buyers (tab) | `(builder)/buyers.tsx` | Tower filter. Rows show name, unit, code and a status chip: Joined (green), Pending (amber), Expired (grey). An "Import CSV" button. |
| Import | `(builder)/import.tsx` | Pick a CSV, then preview the valid count and each bad row with its line and reason, then "Import N buyers", then the new codes with Copy buttons |
| Notices (tab) | `(builder)/notices/index.tsx` | A live list with title, audience and "184 read" (live), a pin switch, and a "New notice" button |
| New notice | `(builder)/notices/new.tsx` | Title and text. Audience: Whole project, Towers (A/B/C chips) or Units (`A-1204, …`). Pin switch, Post button, errors inline. |
| Notice stats | `(builder)/notices/[id].tsx` | "184 / 240 read" with a bar, a bar per tower, "Not read yet · N" with names and units, and the not-joined count. Updates live. |

## Server calls
- M5: `/import`, `/overview`, `/buyers`
- M6: `/notices` (POST, PATCH), `/notices/:id/stats`

## Live data
- The notice list listens to `notices` directly (M2).
- The stats screen refetches when that notice's `readCount` changes.

## Uses
M1 (`parseBuyersCsv` for the preview, plus types), M5, M6, M8, `expo-document-picker` and `expo-clipboard`.

## Checks (full run on two phones)
1. Import `sample/buyers.csv`, with the bad row shown and the codes listed.
2. Join with a new code on the second phone. Towers shows the buyer as joined.
3. Post to Tower A only. Tower B doesn't see it; Tower A sees it live.
4. The buyer opens it. The count goes up and the buyer leaves "Not read yet".
5. Pin it. It jumps to the top of the buyer's feed.
