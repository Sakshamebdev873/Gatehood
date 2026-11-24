# Gatehood: design note

**Data model.** Firestore: `towers`, `units` (`A-1204`), `invites/{code}`, `members/{uid}`, `notices`. Each notice stores its target and a derived `audience` array (`all`, `tower:A`, `unit:A-1204`); a buyer's keys are those three, carried as auth claims.

**Feed query.** `audience array-contains-any myKeys`, ordered `pinned` desc then `createdAt` desc, 15 per page with `startAfter`. My tower and My unit use `array-contains`. Page one is an `onSnapshot` listener, so new and pinned notices arrive live; read state comes from a listener on `members/{uid}/reads`.

**Read counts.** Opening a notice calls the server, which in one transaction checks the audience, creates `notices/{id}/reads/{uid}` only if missing, and increments `readCount` only then. Repeats and retries count once. "Not read" is joined audience members minus receipts. A single counter takes about one write per second; at scale I'd split it across N shards summed on read.

**Security rules.** Clients write nothing; every write goes through the Admin SDK. Buyers read only notices whose audience meets their claims, plus their own unit and member record. The rules emulator confirmed they accept the `array-contains-any` query, so no merged-query fallback was needed.

**Trade-offs.**
- Reviewers run two processes (emulators, server) but need no credentials.
- The unread badge is total minus reads, so it would drift if read notices were deleted (this app never deletes).
- Offline shows only the cached first page per filter.
- Firebase JS SDK (Web config) keeps it in Expo Go; production would move to React Native Firebase for push and native offline storage.
