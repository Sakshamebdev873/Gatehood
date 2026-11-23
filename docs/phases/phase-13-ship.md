# Phase 13: README, NOTE and final check

**Stage:** Ship · **Depends on:** every earlier phase

## Goal
Package the work so a reviewer can set it up from the README, and write the submission note and video script.

## Builds
- **README.md:**
  1. **What it is:** one paragraph and a row of screenshots.
  2. **What you need:** Node 20+, Java 11+, Expo Go on a phone.
  3. **Quick start on the emulators, with no credentials:**
     ```
     npm install
     npm run emulators
     npm run seed
     npm run server
     cp apps/mobile/.env.example apps/mobile/.env   # set your computer's LAN IP
     npm run mobile
     ```
  4. **Demo logins and codes,** as printed by the seed.
  5. **Using a real Firebase project:** the env variables to set, and how to deploy the rules and indexes.
  6. **Running the tests.**
  7. **Project structure.**
  8. **Optional:** deploying the server online.
- **NOTE.md**, 250 words or fewer, covering:
  - **data model:** the collections, and audience keys like `tower:A`
  - **feed query:** audience filter, pinned then newest, 15 per page, the live first page
  - **read counts:** one receipt per buyer, counted once in a server transaction. At larger scale, split the counter across several documents.
  - **security rules:** the app can only read, and only what's meant for it. All writes go through the server.
  - **trade-offs:**
    - reviewers run two processes
    - the unread badge only counts loaded pages
    - the offline cache only holds the first page
    - the outcome of the phase 02 risk check
- **Video script**, under 90 seconds:
  1. the builder imports the CSV
  2. the builder posts a notice to Tower A
  3. the buyer tries a used code and sees the error, then joins with a valid one
  4. the notice arrives live, and the buyer opens it
  5. the builder's read count goes up
  6. the offline feed

## Files
```
README.md  NOTE.md
```

## Steps
1. Write the README and NOTE.
2. Check the NOTE's word count (`wc -w NOTE.md`): it must be 250 or fewer.
3. Run every test.
4. Check that no `.env` or service-account file is in git.
5. Clone the repo fresh and follow the README word for word on both phones.
6. Commit.

## Done when
- All tests pass.
- No secrets are in git.
- A fresh clone works by following the README alone.
- Every item in the brief has been checked (see the coverage table in the design document).

## After this
Record the video, push to GitHub, and submit the repo link, the video and the note.
