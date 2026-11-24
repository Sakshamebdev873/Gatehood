import type { Notice, NoticeStats } from '@gatehood/shared';
import { useFocusEffect } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';

import { BUILDER_PAGE_SIZE, builderNoticesQuery } from '@/features/builder/queries';
import { toNotice } from '@/features/feed/queries';
import { api, ApiError, NETWORK_MESSAGE } from '@/lib/api';
import { db } from '@/lib/firebase';

function messageOf(err: unknown): string {
  return err instanceof ApiError ? err.message : NETWORK_MESSAGE;
}

export type ApiData<T> = {
  status: 'loading' | 'ready' | 'error';
  data?: T;
  error?: string;
  /** True while a pull-to-refresh is running. */
  refreshing: boolean;
  refresh(): void;
  /** Fetch again without the pull-to-refresh spinner. */
  reload(): void;
};

/**
 * GETs an API path, and again each time the screen comes into focus (so Towers shows a buyer
 * who joined while you were on another tab). Data already on screen stays while it refetches.
 */
export function useApiData<T>(path: string): ApiData<T> {
  const [state, setState] = useState<{ path: string; data?: T; error?: string }>({ path });
  const [refreshing, setRefreshing] = useState(false);
  const seq = useRef(0);

  const load = useCallback(
    async (pull: boolean) => {
      const mine = ++seq.current;
      if (pull) setRefreshing(true);
      try {
        const data = await api<T>(path);
        if (mine === seq.current) setState({ path, data });
      } catch (err) {
        // Keep what is on screen; only show the error when there is nothing else to show.
        if (mine === seq.current) setState((s) => (s.path === path && s.data ? s : { path, error: messageOf(err) }));
      } finally {
        if (pull && mine === seq.current) setRefreshing(false);
      }
    },
    [path],
  );

  useFocusEffect(
    useCallback(() => {
      void load(false);
    }, [load]),
  );

  // A different path (a new tower filter) must not show the old path's rows.
  const current = state.path === path ? state : { path };
  const status = current.data !== undefined ? 'ready' : current.error ? 'error' : 'loading';
  return {
    status,
    data: current.data,
    error: current.error,
    refreshing,
    refresh: () => void load(true),
    reload: () => {
      setState({ path });
      void load(false);
    },
  };
}

export type BuilderNotices = {
  status: 'loading' | 'ready' | 'empty' | 'error';
  items: Notice[];
  hasMore: boolean;
  loadingMore: boolean;
  loadMore(): void;
  retry(): void;
};

/**
 * The builder's notice list, live. One listener whose limit grows by a page on loadMore, so every
 * loaded row's read count and pin stay live, not just the first page's.
 */
export function useBuilderNotices(): BuilderNotices {
  const [count, setCount] = useState(BUILDER_PAGE_SIZE);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ items: Notice[]; loadedFor: number; server: boolean; error: boolean }>({
    items: [],
    loadedFor: 0,
    server: false,
    error: false,
  });

  useEffect(() => {
    let serverSeen = false;
    const unsub = onSnapshot(
      builderNoticesQuery(db, count),
      { includeMetadataChanges: true },
      (snap) => {
        if (!snap.metadata.fromCache) serverSeen = true;
        const items = snap.docs.map((d) => toNotice(d.id, d.data()));
        // An empty answer from the phone's memory before the server has answered means "can't reach it yet".
        if (!serverSeen && items.length === 0) return;
        // After loadMore the listener restarts and the phone's copy of the old page comes first:
        // only the server's answer says how far the list now goes.
        const fromServer = !snap.metadata.fromCache;
        setState((s) => ({
          items,
          loadedFor: fromServer ? count : s.loadedFor,
          server: s.server || fromServer,
          error: false,
        }));
      },
      () => setState((s) => ({ ...s, error: true })),
    );
    // The JS SDK doesn't error when the server is unreachable; it waits. Give up after 10 s.
    const timer = setTimeout(() => {
      if (!serverSeen) setState((s) => (s.items.length ? s : { ...s, error: true }));
    }, 10_000);
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, [count, attempt]);

  const { items, loadedFor, server, error } = state;
  const loadingMore = loadedFor > 0 && loadedFor < count;
  const hasMore = items.length >= loadedFor && loadedFor > 0;

  let status: BuilderNotices['status'];
  if (items.length > 0) status = 'ready';
  else if (error) status = 'error';
  else if (server) status = 'empty';
  else status = 'loading';

  return {
    status,
    items,
    hasMore,
    loadingMore,
    loadMore: () => {
      if (hasMore && !loadingMore) setCount(loadedFor + BUILDER_PAGE_SIZE);
    },
    retry: () => {
      setState({ items: [], loadedFor: 0, server: false, error: false });
      setAttempt((a) => a + 1);
    },
  };
}

export type NoticeWithStats = { retry(): void } & (
  | { status: 'loading' }
  /** Deleted or never existed. */
  | { status: 'missing' }
  | { status: 'error'; statsError?: string }
  /** `statsError` set: the last refresh failed and the last good numbers are shown. */
  | { status: 'ready'; notice: Notice; stats: NoticeStats; statsError?: string }
);

/**
 * One notice and its read stats. The notice doc is watched live, and the stats are fetched again
 * whenever its read count changes, so the screen ticks up while a buyer reads it.
 */
export function useNoticeStats(id: string): NoticeWithStats {
  const [notice, setNotice] = useState<Notice | null | undefined>(undefined);
  const [noticeError, setNoticeError] = useState(false);
  const [stats, setStats] = useState<NoticeStats | undefined>(undefined);
  const [statsError, setStatsError] = useState<string | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);
  const seq = useRef(0);

  const fetchStats = useCallback(async () => {
    if (!id) return;
    const mine = ++seq.current;
    try {
      const s = await api<NoticeStats>(`/api/builder/notices/${encodeURIComponent(id)}/stats`);
      if (mine !== seq.current) return;
      setStats(s);
      setStatsError(undefined);
    } catch (err) {
      if (mine === seq.current) setStatsError(messageOf(err));
    }
  }, [id]);

  // Watch the notice; fetch the stats again each time its read count moves (and on the first copy).
  useEffect(() => {
    if (!id) return;
    let lastCount: number | undefined;
    const unsub = onSnapshot(
      doc(db, 'notices', id),
      (snap) => {
        setNoticeError(false);
        const next = snap.exists() ? toNotice(snap.id, snap.data()) : null;
        setNotice(next);
        if (next && next.readCount !== lastCount) {
          lastCount = next.readCount;
          void fetchStats();
        }
      },
      () => setNoticeError(true),
    );
    return unsub;
  }, [id, attempt, fetchStats]);

  // And when coming back to the screen, since buyers may have joined meanwhile.
  useFocusEffect(
    useCallback(() => {
      void fetchStats();
    }, [fetchStats]),
  );

  const retry = () => {
    setNoticeError(false);
    setStatsError(undefined);
    setAttempt((a) => a + 1);
  };

  if (!id || notice === null) return { status: 'missing', retry };
  if (notice && stats) return { status: 'ready', notice, stats, statsError, retry };
  if (noticeError || (notice && statsError)) return { status: 'error', statsError, retry };
  return { status: 'loading', retry };
}
