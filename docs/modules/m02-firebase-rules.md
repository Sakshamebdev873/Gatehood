# M2 Firebase rules

**Folder:** `firebase/` · **Built in:** phase 02 · **Used by:** M8, M10, M11 (direct reads), M3 (emulators)

## Job
Decide what the app can read straight from Firestore, block every write from the app, and run the local emulators.

## Files
```
firebase.json            emulator ports: Firestore 8080, Auth 9099, UI 4001
.firebaserc              project demo-gatehood
firestore.rules
firestore.indexes.json
```

## Data it protects

| Collection | Builder | Buyer |
|---|---|---|
| `notices/{id}` | read | read only if the audience has `all`, `tower:<mine>` or `unit:<mine>` |
| `notices/{id}/reads/{uid}` | read | — |
| `units/{id}` | read | read their own unit only |
| `towers/{id}` | read | read |
| `members/{uid}` and `members/{uid}/reads/*` | read | read their own only |
| `invites/{code}` | read | — |
| Any write | — | — |

## Indexes
- Notices: `audience` (array) + `pinned` desc + `createdAt` desc, for the feed.
- Notices: `createdAt` desc, for the builder's list.

## Uses
Login claims set by M4: `role`, `towerId` and `unitId`.

## Tests (`@firebase/rules-unit-testing`, in `apps/server/test/rules.test.ts`)
- **Buyer A-1204:**
  - can run all three feed queries
  - cannot read a Tower B notice, list notices without a filter, read unit A-0302, read invites, or write anything
- **Builder:** can read everything and write nothing.

## Risk
If the rules can't verify the "All" query (`array-contains-any`), "All" becomes three `array-contains` queries merged in M10. The result is recorded in `NOTE.md`.
