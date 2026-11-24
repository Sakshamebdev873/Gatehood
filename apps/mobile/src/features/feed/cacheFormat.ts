import type { Notice } from '@gatehood/shared';

export type FeedFilter = 'all' | 'tower' | 'unit';

/** `total` is the server's count for the whole feed, so the unread badge stays right offline. */
export type SavedFeed = { items: Notice[]; savedAt: number; total?: number };

/** AsyncStorage key for one user's saved first page of one filter. */
export function feedKey(uid: string, filter: FeedFilter): string {
  return `feed:v1:${uid}:${filter}`;
}

export function encodeFeed(items: Notice[], savedAt: number, total?: number): string {
  return JSON.stringify(total === undefined ? { items, savedAt } : { items, savedAt, total });
}

function isNotice(x: unknown): x is Notice {
  if (typeof x !== 'object' || x === null) return false;
  const n = x as Record<string, unknown>;
  return (
    typeof n.id === 'string' &&
    typeof n.title === 'string' &&
    typeof n.body === 'string' &&
    typeof n.pinned === 'boolean' &&
    typeof n.createdAt === 'number' &&
    typeof n.target === 'object' &&
    n.target !== null &&
    Array.isArray(n.audience)
  );
}

/** Reads a saved feed. Anything missing, corrupt or from an older shape gives null. */
export function decodeFeed(raw: string | null): SavedFeed | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const { items, savedAt, total } = data as Record<string, unknown>;
  if (!Array.isArray(items) || typeof savedAt !== 'number' || !items.every(isNotice)) return null;
  // An older save has no total; that's fine, the badge then counts the saved page.
  return typeof total === 'number' && total >= 0 ? { items, savedAt, total } : { items, savedAt };
}
