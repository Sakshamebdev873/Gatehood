# Video script (under 90 seconds)

**Setup before recording:** emulators, `npm run seed` and `npm run server` running. Two phones side by side (or screen-record each and cut): **builder** phone signed in on Towers, **buyer** phone on the join screen. `sample/buyers.csv` saved on the builder phone. Have the seed's **used** and **valid** codes to hand (valid = Tower A, unit 1203).

| # | Time | Screen | Do | Say |
|---|---|---|---|---|
| 0 | 0:00–0:06 | Buyer: splash → join | Cold-start the app | "Gatehood keeps flat buyers up to date. One app, two roles." |
| 1 | 0:06–0:20 | Builder: Buyers → Import | Pick `buyers.csv`, show the preview with the one bad row, tap Import, show the new codes | "The builder imports buyers from a CSV. Bad rows come back with a reason; every buyer gets an invite code." |
| 2 | 0:20–0:32 | Builder: Notices → New | Title "Tower A lift maintenance", audience **Towers → A**, Post | "Notices go to the whole project, chosen towers or chosen units, and can be pinned." |
| 3 | 0:32–0:46 | Buyer: join | Type the **used** code → error. Type the **valid** code loosely (`a1203 xxx`) → My Unit | "A used code says so and what to do. A valid one joins — case and spaces don't matter." |
| 4 | 0:46–0:56 | Buyer: My Unit → Updates | Show unit, tower progress, days to possession; open Updates, show the Tower A notice at the top with its unread dot, open it | "Buyers see only what's meant for them: pinned first, then newest." |
| 5 | 0:56–1:08 | Builder: Notices → the notice | Read count goes 0 → 1 live; open stats, "Not read yet" list | "The builder's count ticks up live, counted once per buyer, and shows who hasn't read." |
| 6 | 1:08–1:20 | Buyer: Updates | Airplane mode on, close and reopen the app → saved feed with the offline banner | "Offline, the last feed is still there." |
| 7 | 1:20–1:25 | Either | End card or repo URL | "TypeScript server, Firestore rules, and tests in the repo." |

**Tip:** post the notice (step 2) *after* the buyer has joined if you want it to pop in live with the "1 new update" pill; then swap steps 2 and 3.
