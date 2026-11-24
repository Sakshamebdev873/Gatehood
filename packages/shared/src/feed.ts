import type { Notice } from './types.js';

export const FEED_PAGE_SIZE = 15;

/** Pinned first, then newest. Ties break on id so the order is stable. */
export function compareNotices(a: Notice, b: Notice): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Joins feed pages into one list with no duplicates. A later copy of a notice replaces an earlier one. */
export function mergeNoticePages(pages: Notice[][]): Notice[] {
  const byId = new Map<string, Notice>();
  for (const page of pages) {
    for (const notice of page) byId.set(notice.id, notice);
  }
  return [...byId.values()].sort(compareNotices);
}

const DAY_MS = 24 * 60 * 60 * 1000;

function utcDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Whole UTC days from `now` until `date`. Never below 0. */
export function daysUntil(date: Date, now: Date): number {
  return Math.max(0, Math.ceil((utcDay(date) - utcDay(now)) / DAY_MS));
}
