import NetInfo from '@react-native-community/netinfo';
import type { Notice } from '@gatehood/shared';
import {
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  onSnapshot,
  type DocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { useSyncExternalStore } from 'react';

import { useAuth } from '@/auth/AuthProvider';
import { db } from '@/lib/firebase';

import { loadFeed, saveFeed } from './cache';
import type { SavedFeed } from './cacheFormat';
import {
  ackNew,
  applyFirstPage,
  applyNextPage,
  applyRefreshed,
  cursorForMore,
  feedStatus,
  hasMore,
  initialModel,
  itemsOf,
  type Entry,
  type FeedModel,
  type FeedStatus,
} from './model';
import { feedCountQuery, feedQuery, filterKeys, toNotice, type FeedFilter } from './queries';

export type { FeedFilter } from './queries';

/** No server answer in this long counts as "can't reach it": saved feed if any, else the error screen. */
const STALL_MS = 10_000;

export type FeedView = {
  items: Notice[];
  status: FeedStatus;
  offlineSince?: Date;
  hasMore: boolean;
  loadingMore: boolean;
  newCount: number;
  /** Total notices for this filter, once counted ("15 of 52"). */
  total?: number;
  /** For the first-launch screen. */
  launch: { cacheChecked: boolean; hadCache: boolean; serverSeen: boolean; saved: boolean };
};

type Me = { uid: string; towerId: string; unitId: string };

/**
 * One feed (user + filter). Shared by every screen that shows it, so the tab badge, Home and the
 * Updates list see the same loaded pages. Listens while at least one screen is subscribed.
 */
class FeedController {
  private model: FeedModel<DocumentSnapshot> = initialModel();
  private cache: SavedFeed | null = null;
  private cacheChecked = false;
  private hadCache = false;
  private saved = false;
  private netOffline = false;
  private failed = false;
  private loadingMore = false;
  private total: number | undefined;
  private lastCountedIds = '';
  private view: FeedView;
  private readonly listeners = new Set<() => void>();
  private stopFns: Unsubscribe[] = [];
  private stall: ReturnType<typeof setTimeout> | undefined;
  private readonly keys: string[];

  constructor(
    private readonly me: Me,
    private readonly filter: FeedFilter,
  ) {
    this.keys = filterKeys(filter, me);
    this.view = this.compute();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    if (this.listeners.size === 1) this.start();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.stop();
    };
  };

  getView = (): FeedView => this.view;

  loadMore = (): void => {
    const cursor = cursorForMore(this.model);
    if (this.loadingMore || this.netOffline || !this.model.serverSeen || !hasMore(this.model) || !cursor) return;
    this.loadingMore = true;
    this.emit();
    getDocs(feedQuery(db, this.filter, this.keys, cursor))
      .then((snap) => {
        this.model = applyNextPage(this.model, snap.docs.map(toEntry));
      })
      .catch(() => {
        // Leave hasMore as it was; reaching the end of the list again tries once more.
      })
      .finally(() => {
        this.loadingMore = false;
        this.emit();
      });
  };

  retry = (): void => {
    this.unlisten();
    this.listen();
    this.emit();
  };

  ackNew = (): void => {
    this.model = ackNew(this.model);
    this.emit();
  };

  private start(): void {
    if (!this.cacheChecked) {
      void loadFeed(this.me.uid, this.filter).then((saved) => {
        // A fresh server answer may have been saved while this read was in flight.
        if (!this.cache) this.cache = saved;
        this.hadCache = saved !== null;
        this.cacheChecked = true;
        this.emit();
      });
    }
    this.stopFns.push(
      NetInfo.addEventListener((state) => {
        const offline = state.isConnected === false;
        if (offline === this.netOffline) return;
        this.netOffline = offline;
        // Back online without a server answer yet: give the listener a fresh start.
        if (!offline && !this.model.serverSeen) this.retry();
        else this.emit();
      }),
    );
    this.listen();
  }

  private stop(): void {
    this.unlisten();
    for (const fn of this.stopFns) fn();
    this.stopFns = [];
  }

  private listen(): void {
    this.failed = false;
    clearTimeout(this.stall);
    this.stall = setTimeout(() => {
      if (!this.model.serverSeen) {
        this.failed = true;
        this.emit();
      }
    }, STALL_MS);
    const unsub = onSnapshot(
      feedQuery(db, this.filter, this.keys),
      // Metadata changes too, so the fromCache → server switch is seen even when the docs are the same.
      { includeMetadataChanges: true },
      (snap) => this.onFirstPage(snap.docs.map(toEntry), snap.metadata.fromCache),
      () => {
        this.failed = true;
        this.emit();
      },
    );
    this.snapUnsub = unsub;
  }

  private snapUnsub: Unsubscribe | undefined;

  private unlisten(): void {
    clearTimeout(this.stall);
    this.snapUnsub?.();
    this.snapUnsub = undefined;
  }

  private onFirstPage(page: Entry<DocumentSnapshot>[], fromCache: boolean): void {
    this.model = applyFirstPage(this.model, page, fromCache);
    for (const id of this.model.dropped) this.refresh(id);
    if (!fromCache) {
      this.failed = false;
      clearTimeout(this.stall);
      const items = page.map((e) => e.notice);
      const savedAt = Date.now();
      this.cache = { items, savedAt };
      void saveFeed(this.me.uid, this.filter, items, savedAt)
        .then(() => {
          this.saved = true;
          this.emit();
        })
        .catch(() => undefined);
      this.countIfChanged(page);
    }
    this.emit();
  }

  /** A notice left the first page (pushed down or unpinned): read its current copy. */
  private refresh(id: string): void {
    getDoc(doc(db, 'notices', id))
      .then((snap) => {
        this.model = applyRefreshed(this.model, id, snap.exists() ? toEntry(snap) : null);
        this.emit();
      })
      .catch(() => {
        // Denied or offline: keep what we have.
      });
  }

  private countIfChanged(page: Entry<DocumentSnapshot>[]): void {
    const ids = page.map((e) => e.notice.id).join(',');
    if (ids === this.lastCountedIds) return;
    this.lastCountedIds = ids;
    getCountFromServer(feedCountQuery(db, this.filter, this.keys))
      .then((res) => {
        this.total = res.data().count;
        this.emit();
      })
      .catch(() => undefined);
  }

  private compute(): FeedView {
    const live = this.model.serverSeen || this.model.entries.size > 0;
    const items = live ? itemsOf(this.model) : (this.cache?.items ?? []);
    const status = feedStatus({
      serverSeen: this.model.serverSeen,
      items: items.length,
      hasCache: this.cache !== null,
      netOffline: this.netOffline,
      failed: this.failed,
    });
    return {
      items,
      status,
      offlineSince: status === 'offline' && this.cache ? new Date(this.cache.savedAt) : undefined,
      hasMore: hasMore(this.model),
      loadingMore: this.loadingMore,
      newCount: this.model.newCount,
      total: this.total,
      launch: {
        cacheChecked: this.cacheChecked,
        hadCache: this.hadCache,
        serverSeen: this.model.serverSeen,
        saved: this.saved,
      },
    };
  }

  private emit(): void {
    this.view = this.compute();
    for (const l of this.listeners) l();
  }
}

function toEntry(snap: DocumentSnapshot): Entry<DocumentSnapshot> {
  return { notice: toNotice(snap.id, snap.data() ?? {}), cursor: snap };
}

const controllers = new Map<string, FeedController>();

function controllerFor(me: Me, filter: FeedFilter): FeedController {
  const key = `${me.uid}|${me.towerId}|${me.unitId}|${filter}`;
  let c = controllers.get(key);
  if (!c) {
    c = new FeedController(me, filter);
    controllers.set(key, c);
  }
  return c;
}

/** A notice this user's feeds already have in memory (any filter, any loaded page). */
export function findLoadedNotice(uid: string, id: string): Notice | undefined {
  for (const [key, c] of controllers) {
    if (!key.startsWith(`${uid}|`)) continue;
    const hit = c.getView().items.find((n) => n.id === id);
    if (hit) return hit;
  }
  return undefined;
}

const EMPTY_VIEW: FeedView = {
  items: [],
  status: 'loading',
  hasMore: false,
  loadingMore: false,
  newCount: 0,
  launch: { cacheChecked: false, hadCache: false, serverSeen: false, saved: false },
};
const noop = () => undefined;
const noSubscribe = () => noop;

export type UseFeed = FeedView & { loadMore(): void; retry(): void; ackNew(): void };

/** The signed-in buyer's feed for one filter: live first page, paging, saved copy, offline state. */
export function useFeed(filter: FeedFilter): UseFeed {
  const { uid, towerId, unitId } = useAuth();
  const c = uid && towerId && unitId ? controllerFor({ uid, towerId, unitId }, filter) : null;
  const view = useSyncExternalStore(c ? c.subscribe : noSubscribe, c ? c.getView : () => EMPTY_VIEW);
  return {
    ...view,
    loadMore: c ? c.loadMore : noop,
    retry: c ? c.retry : noop,
    ackNew: c ? c.ackNew : noop,
  };
}
