# M10 App: buyer

**Folder:** `apps/mobile/app/(buyer)`, `apps/mobile/src/features` · **Built in:** phases 10 and 11 · **Used by:** buyers

## Job
The buyer's side of the app: their unit, a live feed of only their notices, and reading a notice.

## Screens

| Screen | File | Shows |
|---|---|---|
| My Unit (Home tab) | `(buyer)/index.tsx` | "Tower A, 1204 / *3BHK · 1,640 sq ft*", construction % and bar, days to possession and handover month, newest pinned notice |
| Updates | `(buyer)/updates/index.tsx` | Filters (All, My tower, My unit); pinned first, then newest; 15 per page; read and unread dots; "↑ 1 new update" pill; unread badge on the tab |
| Notice | `(buyer)/updates/[id].tsx` | Audience label, pin tag, serif title, date, full text. Opening it marks it read. |

## Logic files

| File | Does |
|---|---|
| `features/unit/useMyUnit.ts` | Live unit and tower data |
| `features/feed/queries.ts` | The feed query per filter, sorted pinned then newest, 15 per page |
| `features/feed/useFeed.ts` | Live first page, more pages on scroll, merge without duplicates, new-update count, offline detection |
| `features/feed/cache.ts` | Saves and loads the last feed per filter on the phone |
| `features/feed/ReadState.tsx` | Listens to the buyer's receipts. `markRead` shows as read at once, then calls the server (M6), retrying if offline. |
| `components/NoticeRow.tsx` | One feed row |

## States on every screen
- **Loading:** skeleton cards.
- **Empty:** "No updates for your unit yet." (per filter).
- **Error:** Retry button.
- **Offline:** the last saved feed under the offline banner.
- **First launch** with nothing saved: the step-by-step loading screen.

## Uses
- M1: `mergeNoticePages`, `daysUntil`, `audienceKeysFor`
- M2: direct reads
- M6: mark read
- M8: theme, components, clients

## Checks (by hand, both phones)
- Only targeted notices show, with pinned ones first.
- Paging works to the end, and the filters change the list.
- A new notice arrives live with the pill.
- Airplane mode plus a restart shows the saved feed.
- With nothing saved and the server down, the error screen shows, and Retry recovers.
- Opening a notice twice counts once.
- A read made offline counts once back online.
