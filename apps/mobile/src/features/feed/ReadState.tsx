import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import type { Notice } from '@gatehood/shared';
import { collection, onSnapshot } from 'firebase/firestore';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { ApiError, api } from '@/lib/api';
import { db } from '@/lib/firebase';

export type ReadState = {
  isRead(id: string): boolean;
  /** Shows the notice as read at once, then tells the server. Retries later if that fails. */
  markRead(id: string): void;
  /**
   * Unread notices in a feed. Pass `total` (the server's count) only for the All feed: every
   * notice a buyer can read is in it, so total minus their reads is exact even before every page
   * has loaded. Without it, this counts the loaded notices only.
   */
  unreadCount(items: Notice[], total?: number): number;
};

const ReadStateContext = createContext<ReadState | null>(null);

const pendingKey = (uid: string) => `reads:pending:v1:${uid}`;
/** The server's receipts as last seen, so a cold start offline still knows what was read. */
const knownKey = (uid: string) => `reads:known:v1:${uid}`;

function parseIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const ids: unknown = JSON.parse(raw);
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

/** Worth trying again: no connection, rate limit or a server fault. A 403/404 never will succeed. */
function retryable(err: unknown): boolean {
  return !(err instanceof ApiError) || err.status === 0 || err.status === 429 || err.status >= 500;
}

/**
 * Read state for the signed-in buyer: their receipts from `members/{uid}/reads`, plus notices
 * marked read on this phone. Unsent marks are kept on the phone and retried when the app
 * comes back to the foreground or the connection returns, so a read made offline still counts.
 */
export function ReadStateProvider({ children }: { children: ReactNode }) {
  const { uid } = useAuth();
  const [serverIds, setServerIds] = useState<ReadonlySet<string>>(() => new Set());
  const [localIds, setLocalIds] = useState<ReadonlySet<string>>(() => new Set());
  const pending = useRef(new Set<string>());
  const inFlight = useRef(new Set<string>());
  const sendRef = useRef<((id: string) => void) | undefined>(undefined);

  useEffect(() => {
    if (!uid) return;
    let live = false;
    // Saved receipts first; the live listener replaces them as soon as the server answers.
    AsyncStorage.getItem(knownKey(uid))
      .then((raw) => {
        const saved = parseIds(raw);
        if (!live && saved.length > 0) setServerIds(new Set(saved));
      })
      .catch(() => undefined);
    const stop = onSnapshot(
      collection(db, 'members', uid, 'reads'),
      (snap) => {
        // Receipts are never removed, so a partial cached snapshot can only add to what was saved.
        if (snap.metadata.fromCache && snap.empty) return;
        live = true;
        const ids = snap.docs.map((d) => d.id);
        setServerIds(new Set(ids));
        if (!snap.metadata.fromCache) AsyncStorage.setItem(knownKey(uid), JSON.stringify(ids)).catch(() => undefined);
      },
      () => undefined, // Offline or denied: keep the last known reads.
    );
    return stop;
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    let active = true;

    const persist = () => AsyncStorage.setItem(pendingKey(uid), JSON.stringify([...pending.current])).catch(() => undefined);

    const send = async (id: string) => {
      if (inFlight.current.has(id)) return;
      inFlight.current.add(id);
      try {
        await api(`/api/notices/${encodeURIComponent(id)}/read`, { method: 'POST' });
        pending.current.delete(id);
        void persist();
      } catch (err) {
        if (!retryable(err)) {
          pending.current.delete(id);
          void persist();
        }
      } finally {
        inFlight.current.delete(id);
      }
    };

    const flush = () => {
      for (const id of pending.current) void send(id);
    };

    AsyncStorage.getItem(pendingKey(uid))
      .then((raw) => {
        if (!active || !raw) return;
        for (const id of parseIds(raw)) pending.current.add(id);
        setLocalIds((prev) => new Set([...prev, ...pending.current]));
        flush();
      })
      .catch(() => undefined);

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') flush();
    });
    // Back online with the app open: send what was read offline straight away.
    let wasOffline = false;
    const unsubNet = NetInfo.addEventListener((state) => {
      const offline = state.isConnected === false;
      if (wasOffline && !offline) flush();
      wasOffline = offline;
    });

    sendRef.current = (id: string) => {
      pending.current.add(id);
      void persist();
      void send(id);
    };

    return () => {
      active = false;
      sub.remove();
      unsubNet();
      sendRef.current = undefined;
    };
  }, [uid]);

  const isRead = (id: string) => serverIds.has(id) || localIds.has(id);

  const value: ReadState = {
    isRead,
    markRead: (id: string) => {
      if (serverIds.has(id)) return;
      if (!localIds.has(id)) setLocalIds((prev) => new Set(prev).add(id));
      sendRef.current?.(id);
    },
    unreadCount: (items: Notice[], total?: number) => {
      const loaded = items.reduce((n, item) => (isRead(item.id) ? n : n + 1), 0);
      if (total === undefined || total <= items.length) return loaded;
      const reads = new Set([...serverIds, ...localIds]).size;
      // Never below what is visibly unread on screen.
      return Math.max(loaded, total - reads);
    },
  };

  return <ReadStateContext.Provider value={value}>{children}</ReadStateContext.Provider>;
}

export function useReadState(): ReadState {
  const ctx = useContext(ReadStateContext);
  if (!ctx) throw new Error('useReadState must be used inside ReadStateProvider');
  return ctx;
}
