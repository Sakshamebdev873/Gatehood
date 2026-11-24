import { audienceKeysFor, FEED_PAGE_SIZE, type Notice, type NoticeTarget } from '@gatehood/shared';
import {
  collection,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type DocumentData,
  type Firestore,
  type Query,
  type DocumentSnapshot,
} from 'firebase/firestore';

import type { FeedFilter } from './cacheFormat';

export type { FeedFilter } from './cacheFormat';

type Me = { towerId: string; unitId: string };

/** The audience keys a filter matches: all three for "All", one for tower or unit. */
export function filterKeys(filter: FeedFilter, me: Me): string[] {
  const [all, tower, unit] = audienceKeysFor(me) as [string, string, string];
  if (filter === 'tower') return [tower];
  if (filter === 'unit') return [unit];
  return [all, tower, unit];
}

/**
 * One feed page, pinned first then newest (design §5.4). "All" is a single array-contains-any
 * query; the phase 02 rules check showed the `hasAny` rule accepts it, so no three-query fallback.
 * Takes `db` so it can run outside the app (tests, scripts).
 */
export function feedQuery(
  db: Firestore,
  filter: FeedFilter,
  keys: string[],
  after?: DocumentSnapshot,
): Query<DocumentData> {
  const audience =
    filter === 'all' ? where('audience', 'array-contains-any', keys) : where('audience', 'array-contains', keys[0]);
  const parts = [audience, orderBy('pinned', 'desc'), orderBy('createdAt', 'desc')];
  return after
    ? query(collection(db, 'notices'), ...parts, startAfter(after), limit(FEED_PAGE_SIZE))
    : query(collection(db, 'notices'), ...parts, limit(FEED_PAGE_SIZE));
}

/** Same filter with no limit, for counting the total ("15 of 52"). */
export function feedCountQuery(db: Firestore, filter: FeedFilter, keys: string[]): Query<DocumentData> {
  const audience =
    filter === 'all' ? where('audience', 'array-contains-any', keys) : where('audience', 'array-contains', keys[0]);
  return query(collection(db, 'notices'), audience);
}

function millis(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && v !== null && typeof (v as { toMillis?: unknown }).toMillis === 'function') {
    return (v as { toMillis(): number }).toMillis();
  }
  return 0;
}

/** Firestore notice data → the app's Notice, with createdAt in milliseconds. */
export function toNotice(id: string, data: DocumentData): Notice {
  return {
    id,
    title: typeof data.title === 'string' ? data.title : '',
    body: typeof data.body === 'string' ? data.body : '',
    pinned: data.pinned === true,
    createdAt: millis(data.createdAt),
    target: (data.target as NoticeTarget | undefined) ?? { type: 'all' },
    audience: Array.isArray(data.audience) ? (data.audience as string[]) : [],
    readCount: typeof data.readCount === 'number' ? data.readCount : 0,
  };
}
