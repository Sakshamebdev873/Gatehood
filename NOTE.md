# Gatehood: design note

**Data model.** Firestore holds towers, units, invite codes, members (joined buyers) and notices. Each notice is tagged with who it is for: "all", "tower:A" or "unit:A-1204". Each buyer's login carries their own three tags.

**Feed query.** The feed asks Firestore for notices matching any of the buyer's tags, pinned first, then newest, 15 at a time. "My tower" and "My unit" use one tag. The first page is a live listener, so new notices appear without refreshing.

**Read counts.** Opening a notice tells the server. In one transaction it checks the buyer may see it, saves a read receipt if that buyer has none yet, and adds 1 to the count only then. Opening twice, or retrying after a network drop, still counts once. "Not read yet" is joined buyers in the audience minus those with a receipt. One counter handles about one update per second; for a bigger project I would split it into several counters and add them up.

**Security rules.** The app can only read; every write goes through the server. A buyer can read only notices tagged for them, plus their own unit and profile. Tests check a buyer can't read another tower's notices.

**Trade-offs.**
- Reviewers run two things (Firebase emulators, server) but need no keys.
- Offline shows only the last saved first page.
- The Firebase JavaScript SDK lets it run in Expo Go; production would switch to React Native Firebase for push notifications and better offline storage.
