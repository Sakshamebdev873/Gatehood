import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { useAuth } from '@/auth/AuthProvider';
import { db } from '@/lib/firebase';

export type MyUnit = { unitId: string; number: string; config: string | null; areaSqft: number | null };
export type MyTower = { name: string; progressPct: number; possessionDate: Date | null };

type Saved = { unit: MyUnit; tower: { name: string; progressPct: number; possessionDate: number | null } };

/** No answer in this long: use the saved copy, or show the error. */
const STALL_MS = 10_000;

const unitKey = (uid: string) => `unit:v1:${uid}`;

function millis(v: unknown): number | null {
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && v !== null && typeof (v as { toMillis?: unknown }).toMillis === 'function') {
    return (v as { toMillis(): number }).toMillis();
  }
  return null;
}

/**
 * The buyer's unit and tower, live from `units/{unitId}` and `towers/{towerId}`.
 * The last good copy is saved on the phone so Home still shows the unit offline.
 */
export function useMyUnit(): {
  status: 'loading' | 'ready' | 'error';
  unit?: MyUnit;
  tower?: MyTower;
  retry(): void;
} {
  const { uid, towerId, unitId } = useAuth();
  const [unit, setUnit] = useState<MyUnit | undefined>();
  const [tower, setTower] = useState<Saved['tower'] | undefined>();
  const [attempt, setAttempt] = useState(0);
  // Which load failed; a retry or a new unit starts a new load, so the old failure no longer counts.
  const [failedLoad, setFailedLoad] = useState<string | null>(null);
  const load = `${unitId}|${towerId}|${attempt}`;
  const failed = failedLoad === load;

  // The saved copy first, so Home has something to show straight away.
  useEffect(() => {
    if (!uid) return;
    let active = true;
    AsyncStorage.getItem(unitKey(uid))
      .then((raw) => {
        if (!active || !raw) return;
        const saved = JSON.parse(raw) as Saved;
        if (saved?.unit?.unitId !== unitId) return;
        setUnit((u) => u ?? saved.unit);
        setTower((t) => t ?? saved.tower);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [uid, unitId]);

  useEffect(() => {
    if (!unitId || !towerId) return;
    const setFailed = () => setFailedLoad(load);
    let gotUnit = false;
    let gotTower = false;
    const stall = setTimeout(() => {
      if (!gotUnit || !gotTower) setFailed();
    }, STALL_MS);

    const stopUnit = onSnapshot(
      doc(db, 'units', unitId),
      { includeMetadataChanges: true },
      (s) => {
        if (!s.exists()) {
          // A cache miss while offline isn't an answer; a server "no such unit" is.
          if (!s.metadata.fromCache) setFailed();
          return;
        }
        const d = s.data();
        gotUnit = true;
        setUnit({
          unitId,
          number: typeof d.number === 'string' ? d.number : unitId.split('-')[1] ?? unitId,
          config: typeof d.config === 'string' ? d.config : null,
          areaSqft: typeof d.areaSqft === 'number' ? d.areaSqft : null,
        });
      },
      () => setFailed(),
    );
    const stopTower = onSnapshot(
      doc(db, 'towers', towerId),
      { includeMetadataChanges: true },
      (s) => {
        if (!s.exists()) {
          if (!s.metadata.fromCache) setFailed();
          return;
        }
        const d = s.data();
        gotTower = true;
        setTower({
          name: typeof d.name === 'string' ? d.name : `Tower ${towerId}`,
          progressPct: typeof d.progressPct === 'number' ? Math.max(0, Math.min(100, d.progressPct)) : 0,
          possessionDate: millis(d.possessionDate),
        });
      },
      () => setFailed(),
    );
    return () => {
      clearTimeout(stall);
      stopUnit();
      stopTower();
    };
  }, [unitId, towerId, load]);

  // Keep the saved copy current.
  useEffect(() => {
    if (!uid || !unit || !tower) return;
    const saved: Saved = { unit, tower };
    AsyncStorage.setItem(unitKey(uid), JSON.stringify(saved)).catch(() => undefined);
  }, [uid, unit, tower]);

  const ready = unit !== undefined && tower !== undefined;
  return {
    status: ready ? 'ready' : failed ? 'error' : 'loading',
    unit,
    tower: tower && {
      name: tower.name,
      progressPct: tower.progressPct,
      possessionDate: tower.possessionDate === null ? null : new Date(tower.possessionDate),
    },
    retry: () => setAttempt((a) => a + 1),
  };
}
