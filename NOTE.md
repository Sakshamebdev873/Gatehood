# Gatehood: design note

**Data model.** Firestore holds towers, units, invite codes, members (joined buyers) and notices. Each notice saves who it is for as a list of tags: "all", "tower:A" or "unit:A-1204". Every buyer carries the same three tags for themselves, stored in their login.

**Feed query.** The feed asks Firestore for notices whose tags match any of the buyer's tags, pinned first, then newest, 15 at a time. "My tower" and "My unit" ask for one tag only. The first page is a live listener, so a new notice appears without refreshing.

**Read counts.** When a buyer opens a notice, the app tells the server. In one transaction the server checks the buyer is allowed to see it, saves a read receipt for that buyer if one doesn't exist yet, and adds 1 to the count only when it saved a new receipt. Opening it twice, or retrying after a network drop, still counts once. "Not read yet" is the joined buyers in the audience minus those with a receipt. One counter handles about one update per second; for a much bigger project I would split it into several counters and add them up.

**Security rules.** The app can only read; every write goes through the server. A buyer can read only notices tagged for them, plus their own unit and profile. Tests check that a buyer can't read another tower's notices.

**Trade-offs.**
- Reviewers run two things (Firebase emulators and the server), but need no keys.
- Offline shows the last saved first page only.
- It uses the Firebase JavaScript SDK so it runs in Expo Go. A production app would switch to React Native Firebase for push notifications and better offline storage.
