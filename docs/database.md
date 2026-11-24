# Database: Cloud Firestore

We use **Cloud Firestore**, Firebase's document (NoSQL) database. The assignment brief requires it. It's also a good fit for a live, targeted feed with read tracking at the scale of hundreds of units.

## Which Firebase database (and which not)

| Option | Use? | Why |
|---|---|---|
| **Cloud Firestore** | **Yes** | Required by the brief. Live queries, indexes, security rules. |
| Realtime Database | No | Firebase's older JSON database. Weaker querying and rules, and not what the brief names. |
| Data Connect (SQL / Postgres) | No | Not what the brief asks for. |

**When creating it in the console** (Build → Firestore Database → Create database):
- **Edition:** Standard, if asked.
- **Database ID:** `(default)`.
- **Location:** `asia-south1` (Mumbai). This can't be changed later.
- **Mode:** Production mode. Our own rules are deployed over it.

On your computer, the **Firestore emulator** stands in for the cloud database, so development and reviewers need no cloud account. See `docs/firebase-setup.md` for the real-project steps.

## Why Firestore and not Realtime Database

Both are Firebase databases and both push live updates. They differ in how you can **query** and **protect** data, and that's exactly what this app depends on.

| Need in this app | Firestore | Realtime Database |
|---|---|---|
| **Feed query:** "notices for `all` or `tower:A` or `unit:A-1204`, pinned first, then newest, 15 at a time" | One query: `array-contains-any` on audience + `orderBy(pinned)` + `orderBy(createdAt)` + `limit(15)`, served by a composite index | Can't. A query can sort or filter on **only one field**, and there's no "contains any of these". You'd fetch too much and filter on the phone, or build per-buyer feeds (below). |
| **Paging 15 at a time** in that order | Cursors (`startAfter`) work across both sort fields | Paging works on one sort key only, so "pinned first, then newest" breaks it |
| **Security:** a buyer only sees their notices | Rules check each notice's audience against the buyer's tower and unit, and Firestore validates the query | Rules can't filter a list per user. Read access granted at a parent covers everything under it. You'd need a separate copy of the feed per buyer to keep data private. |
| **Data shape** | Documents and subcollections; reading a notice doesn't pull its read receipts | One big JSON tree; reading a node downloads everything under it (e.g. a notice plus all its receipts) unless you restructure |
| **Scaling** | Scales automatically | One database instance has fixed limits (about 200,000 open connections, about 1,000 writes per second); beyond that you split it across databases yourself |
| **What the brief says** | "Firestore" | Not allowed by the brief |

**What Realtime Database would force us to build.** Without multi-field queries or per-user rules, the usual design is a copy of the feed for every buyer: posting one notice to all towers writes it to **240 buyer feeds** instead of one document. Changing a notice's audience or pin would mean rewriting those copies. That means more writes, more code, and more ways for counts and feeds to drift apart.

**Where Realtime Database is actually better:** very low latency, and billing by data transferred rather than per document read. That makes it cheaper for tiny, constant updates like chat typing indicators, online/offline presence or live cursors. This app doesn't need any of those. Its data is notices that change rarely and are read by many people, which is Firestore's strength.

**In one line for the note:** Firestore gives multi-field queries, cursor paging and per-document rules, so the targeted, pinned-then-newest feed is a single indexed query. Realtime Database would need a copy of the feed for every buyer.

## What's stored

| Collection | What's in it |
|---|---|
| `towers/{A}` | Name, construction %, possession date |
| `units/{A-1204}` | Tower, unit number, configuration (3BHK), area |
| `invites/{A1204-7KQ}` | Buyer name, phone, unit, expiry, who used it and when |
| `members/{uid}` | Joined buyers and the builder: role, tower, unit |
| `members/{uid}/reads/{noticeId}` | Which notices this buyer has read (drives the read and unread dots) |
| `notices/{id}` | Title, text, pinned, date, audience (`all` / `tower:A` / `unit:A-1204`), `readCount` |
| `notices/{id}/reads/{uid}` | One receipt per buyer who read it (drives exact counts and "who hasn't read") |

**Who reads and writes:**
- The app **reads** Firestore directly: the live feed, unit details and read dots. Security rules control what it can see.
- **All writes** go through our TypeScript server, using the Firebase Admin SDK.

## Why it's a good fit

- **Live updates are built in.** `onSnapshot` pushes a new notice to the buyer's phone the moment the builder posts it. Most databases would need WebSockets built by hand.
- **Targeting is a single query.** Each notice stores its audience keys, and the feed asks for "notices whose audience includes any of my 3 keys", sorted pinned then newest, 15 at a time. Firestore indexes this, so it stays fast with thousands of notices.
- **Security rules enforce access at the source.** The database itself refuses to give a Tower B notice to a Tower A buyer, even if someone modifies the app.
- **No server is needed for reads.** The app reads directly, and the server only handles writes.
- **It's free at this size.** The free plan allows about 50,000 document reads and 20,000 writes a day. 240 units and 55 notices barely touch that.
- **The local emulator** gives a no-credentials setup for reviewers.

## Where it's weaker, and how we handle it

| Weakness | Effect here | Our answer |
|---|---|---|
| No joins (NoSQL) | "Who hasn't read" can't be one query | The server works it out: joined buyers in the audience, minus the read receipts |
| One document sustains about 1 update per second | 500 buyers opening one notice in the same second would queue on its `readCount` | Fine for hundreds of units. At larger scale, split the counter across N documents and sum them when read. |
| Query limits: one `array-contains-any` per query, max 30 values | We only use 3 keys | No problem. If rules can't verify it, fall back to three `array-contains` queries merged in the app (phase 02 check). |
| Billed per document read | A careless listener on every notice gets expensive at scale | Pages of 15. Only the first page is live; older pages load once. |
| The JS SDK offline cache is memory-only in Expo Go | The feed would be lost after an app restart | The last feed is saved to AsyncStorage and shown under an offline banner |

## Verdict

Firestore fits this app well: live delivery, per-buyer targeting and access rules come built in. Each weakness is known and has a planned answer. Those answers are the material for the "read counts at scale", "feed query" and "trade-offs" parts of `NOTE.md`.

Related:
- the design, section 5: `docs/superpowers/specs/2026-11-23-gatehood-buyer-updates-design.md`
- the rules: `docs/modules/m02-firebase-rules.md`
- the read counts: `docs/modules/m06-server-notices.md`
