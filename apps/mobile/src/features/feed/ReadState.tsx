import AsyncStorage from '@react-native-async-storage/async-storage';
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
  unreadCount(items: Notice[]): number;
};

const ReadStateContext = createContext<ReadState | null>(null);

const pendingKey = (uid: string) => `reads:pending:v1:${uid}`;

/** Worth trying again: no connection, rate limit or a server fault. A 403/404 never will succeed. */
function retryable(err: unknown): boolean {
  return !(err instanceof ApiError) || err.status === 0 || err.status === 429 || err.status >= 500;
}

/**
 * Read state for the signed-in buyer: their receipts from `members/{uid}/reads`, plus notices
 * marked read on this phone. Unsent marks are kept on the phone and retried when the app
 * comes back to the foreground, so a read on a bad connection still counts.
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
    return onSnapshot(
      collection(db, 'members', uid, 'reads'),
      (snap) => setServerIds(new Set(snap.docs.map((d) => d.id))),
      () => undefined, // Offline or denied: keep the last known reads.
    );
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
        const ids: unknown = JSON.parse(raw);
        if (!Array.isArray(ids)) return;
        for (const id of ids) if (typeof id === 'string') pending.current.add(id);
        setLocalIds((prev) => new Set([...prev, ...pending.current]));
        flush();
      })
      .catch(() => undefined);

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') flush();
    });

    sendRef.current = (id: string) => {
      pending.current.add(id);
      void persist();
      void send(id);
    };

    return () => {
      active = false;
      sub.remove();
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
    unreadCount: (items: Notice[]) => items.reduce((n, item) => (isRead(item.id) ? n : n + 1), 0),
  };

  return <ReadStateContext.Provider value={value}>{children}</ReadStateContext.Provider>;
}

export function useReadState(): ReadState {
  const ctx = useContext(ReadStateContext);
  if (!ctx) throw new Error('useReadState must be used inside ReadStateProvider');
  return ctx;
}
