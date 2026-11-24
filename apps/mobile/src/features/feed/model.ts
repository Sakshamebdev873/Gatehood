import { compareNotices, FEED_PAGE_SIZE, type Notice } from '@gatehood/shared';

/**
 * Pure state for one feed (one filter). No Firebase or React here, so it can be unit tested.
 * `C` is the paging cursor; in the app it is the Firestore document snapshot.
 */
export type Entry<C> = { notice: Notice; cursor: C };

export interface FeedModel<C> {
  /** Every notice loaded so far, by id: the live first page plus any later pages. */
  entries: ReadonlyMap<string, Entry<C>>;
  /** Ids in the latest first-page snapshot. */
  page1Ids: readonly string[];
  /** True once the server (not the local cache) has answered the first page. */
  serverSeen: boolean;
  /** Notices that arrived live since the last ack. */
  newCount: number;
  /**
   * createdAt of the newest notice seen so far. Only a notice newer than this counts as new, so
   * an old one that moves into the first page (just pinned, or re-created under a new id) doesn't.
   */
  newestSeen: number;
  /** Size of the most recently fetched page; a full page means there may be more. */
  lastPageSize: number;
  /** How many pages have been loaded after the first. */
  extraPages: number;
  /**
   * Ids that left the first page in the latest snapshot. They stay listed (notices are never
   * deleted, so they were pushed down or changed), and the caller re-reads them with applyRefreshed.
   */
  dropped: string[];
}

export function initialModel<C>(): FeedModel<C> {
  return {
    entries: new Map(),
    page1Ids: [],
    serverSeen: false,
    newCount: 0,
    newestSeen: 0,
    lastPageSize: 0,
    extraPages: 0,
    dropped: [],
  };
}

function sorted<C>(entries: ReadonlyMap<string, Entry<C>>): Entry<C>[] {
  return [...entries.values()].sort((a, b) => compareNotices(a.notice, b.notice));
}

/** A first-page snapshot from the live listener. `fromCache` is the snapshot's metadata.fromCache. */
export function applyFirstPage<C>(m: FeedModel<C>, page: Entry<C>[], fromCache: boolean): FeedModel<C> {
  const ids = page.map((x) => x.notice.id);
  const idSet = new Set(ids);
  // Only count arrivals once the server has given us a baseline.
  const counting = m.serverSeen && !fromCache;
  let added = 0;
  let newestSeen = m.newestSeen;
  const entries = new Map(m.entries);
  for (const entry of page) {
    const { id, createdAt } = entry.notice;
    if (counting && !m.entries.has(id) && createdAt > m.newestSeen) added++;
    newestSeen = Math.max(newestSeen, createdAt);
    entries.set(id, entry);
  }
  return {
    ...m,
    entries,
    page1Ids: ids,
    serverSeen: m.serverSeen || !fromCache,
    newCount: m.newCount + added,
    newestSeen,
    lastPageSize: m.extraPages === 0 ? page.length : m.lastPageSize,
    dropped: m.page1Ids.filter((id) => !idSet.has(id)),
  };
}

/** A later page fetched with getDocs after cursorForMore. */
export function applyNextPage<C>(m: FeedModel<C>, page: Entry<C>[]): FeedModel<C> {
  const entries = new Map(m.entries);
  for (const entry of page) entries.set(entry.notice.id, entry);
  return { ...m, entries, extraPages: m.extraPages + 1, lastPageSize: page.length, dropped: [] };
}

/**
 * The fresh copy of a notice that left the first page, or null if it can no longer be read.
 * A copy that now sorts past the end of what is loaded is left for paging to bring back,
 * so the paging cursor never jumps over notices that haven't been loaded yet.
 */
export function applyRefreshed<C>(m: FeedModel<C>, id: string, entry: Entry<C> | null): FeedModel<C> {
  const entries = new Map(m.entries);
  entries.delete(id);
  if (entry) {
    const others = sorted(entries);
    const last = others.at(-1);
    const pastEnd = hasMore(m) && last !== undefined && compareNotices(entry.notice, last.notice) > 0;
    if (!pastEnd) entries.set(id, entry);
  }
  return { ...m, entries };
}

export function ackNew<C>(m: FeedModel<C>): FeedModel<C> {
  return m.newCount === 0 ? m : { ...m, newCount: 0 };
}

/** Pinned first, then newest. */
export function itemsOf<C>(m: FeedModel<C>): Notice[] {
  return sorted(m.entries).map((x) => x.notice);
}

/** Where the next page starts: after the last loaded notice. */
export function cursorForMore<C>(m: FeedModel<C>): C | undefined {
  return sorted(m.entries).at(-1)?.cursor;
}

export function hasMore<C>(m: FeedModel<C>): boolean {
  return m.lastPageSize === FEED_PAGE_SIZE;
}

export type FeedStatus = 'loading' | 'ready' | 'empty' | 'error' | 'offline';

type StatusInput = {
  serverSeen: boolean;
  /** Items on screen: live ones, or the saved copy until the server answers. */
  items: number;
  hasCache: boolean;
  netOffline: boolean;
  /** The listener errored, or the server didn't answer in time. */
  failed: boolean;
};

export function feedStatus({ serverSeen, items, hasCache, netOffline, failed }: StatusInput): FeedStatus {
  if (netOffline && (serverSeen || hasCache)) return 'offline';
  if (serverSeen) return items > 0 ? 'ready' : 'empty';
  if (failed || netOffline) return hasCache ? 'offline' : 'error';
  return items > 0 ? 'ready' : 'loading';
}
