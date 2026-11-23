import type { NoticeTarget } from './types.js';

/** The keys a buyer matches: whole project, their tower, their unit. */
export function audienceKeysFor(m: { towerId: string; unitId: string }): string[] {
  return ['all', `tower:${m.towerId}`, `unit:${m.unitId}`];
}

/** The keys a notice is stored with. Throws on an empty towers or units list. */
export function audienceForTarget(t: NoticeTarget): string[] {
  switch (t.type) {
    case 'all':
      return ['all'];
    case 'towers':
      if (t.towers.length === 0) throw new Error('Pick at least one tower');
      return [...new Set(t.towers)].map((towerId) => `tower:${towerId}`);
    case 'units':
      if (t.unitIds.length === 0) throw new Error('Pick at least one unit');
      return [...new Set(t.unitIds)].map((unitId) => `unit:${unitId}`);
  }
}

export function intersects(a: string[], b: string[]): boolean {
  const set = new Set(b);
  return a.some((key) => set.has(key));
}
