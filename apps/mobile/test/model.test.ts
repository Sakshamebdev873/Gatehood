import type { Notice } from '@gatehood/shared';
import { describe, expect, it } from 'vitest';

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
} from '../src/features/feed/model';

/** Notice n<i>, created at minute i (higher i = newer). */
function n(i: number, pinned = false): Notice {
  return {
    id: `n${i}`,
    title: `Notice ${i}`,
    body: '',
    pinned,
    createdAt: i * 60_000,
    target: { type: 'all' },
    audience: ['all'],
    readCount: 0,
  };
}

/** The cursor stands in for a Firestore snapshot; here it is just the id. */
const e = (notice: Notice): Entry<string> => ({ notice, cursor: notice.id });

/** Newest-first page of notices `from` down to `to`. */
function page(from: number, to: number): Entry<string>[] {
  const out: Entry<string>[] = [];
  for (let i = from; i >= to; i--) out.push(e(n(i)));
  return out;
}

const ids = (m: ReturnType<typeof initialModel<string>>) => itemsOf(m).map((x) => x.id);

describe('first page', () => {
  it('lists the live first page pinned first, then newest', () => {
    const m = applyFirstPage(initialModel<string>(), [e(n(5)), e(n(1, true)), e(n(3))], false);
    expect(ids(m)).toEqual(['n1', 'n5', 'n3']);
  });

  it('does not count the first server snapshot as new', () => {
    const m = applyFirstPage(initialModel<string>(), page(20, 6), false);
    expect(m.newCount).toBe(0);
  });

  it('counts notices that arrive live after the first server snapshot', () => {
    let m = applyFirstPage(initialModel<string>(), page(20, 6), false);
    m = applyFirstPage(m, page(21, 7), false);
    expect(m.newCount).toBe(1);
    m = applyFirstPage(m, page(23, 9), false);
    expect(m.newCount).toBe(3);
  });

  it('does not count a re-sent snapshot or an edited notice as new', () => {
    let m = applyFirstPage(initialModel<string>(), page(20, 6), false);
    m = applyFirstPage(m, page(20, 6), false);
    m = applyFirstPage(m, [e({ ...n(20), title: 'edited' }), ...page(19, 6)], false);
    expect(m.newCount).toBe(0);
    expect(itemsOf(m)[0]!.title).toBe('edited');
  });

  it('does not count what a cached snapshot showed before the server answered', () => {
    let m = applyFirstPage(initialModel<string>(), page(20, 16), true);
    expect(m.serverSeen).toBe(false);
    m = applyFirstPage(m, page(20, 6), false);
    expect(m.serverSeen).toBe(true);
    expect(m.newCount).toBe(0);
  });

  it('resets the new count on ack', () => {
    let m = applyFirstPage(initialModel<string>(), page(20, 6), false);
    m = applyFirstPage(m, page(22, 8), false);
    expect(ackNew(m).newCount).toBe(0);
  });

  it('does not count an old notice that moves into the first page as new', () => {
    let m = applyFirstPage(initialModel<string>(), page(20, 6), false);
    // n2 was just pinned, so it jumps to the top of the first page.
    m = applyFirstPage(m, [e(n(2, true)), ...page(20, 7)], false);
    expect(m.newCount).toBe(0);
  });

  it('does not count the same notices re-created under new ids as new', () => {
    let m = applyFirstPage(initialModel<string>(), page(20, 6), false);
    const recreated = page(20, 6).map((x) => e({ ...x.notice, id: `${x.notice.id}-again` }));
    m = applyFirstPage(m, recreated, false);
    expect(m.newCount).toBe(0);
  });

  it('reports ids that left the first page so they can be re-read', () => {
    let m = applyFirstPage(initialModel<string>(), page(20, 6), false);
    m = applyFirstPage(m, page(21, 7), false);
    expect(m.dropped).toEqual(['n6']);
  });
});

describe('more pages', () => {
  it('has more when the last page was full', () => {
    expect(hasMore(applyFirstPage(initialModel<string>(), page(30, 16), false))).toBe(true);
    expect(hasMore(applyFirstPage(initialModel<string>(), page(10, 1), false))).toBe(false);
  });

  it('pages after the last loaded notice and merges without duplicates', () => {
    let m = applyFirstPage(initialModel<string>(), page(40, 26), false);
    expect(cursorForMore(m)).toBe('n26');
    m = applyNextPage(m, page(25, 11));
    expect(ids(m)).toHaveLength(30);
    expect(cursorForMore(m)).toBe('n11');
    expect(hasMore(m)).toBe(true);
    m = applyNextPage(m, page(10, 3));
    expect(ids(m)).toHaveLength(38);
    expect(hasMore(m)).toBe(false);
  });

  it('keeps a notice pushed off the live first page when later pages are loaded', () => {
    let m = applyFirstPage(initialModel<string>(), page(40, 26), false);
    m = applyNextPage(m, page(25, 11));
    m = applyFirstPage(m, page(41, 27), false); // n26 is pushed to page 2's range
    expect(ids(m)).toContain('n26');
    expect(new Set(ids(m)).size).toBe(ids(m).length);
  });

  it('a page that repeats a live notice does not duplicate it', () => {
    let m = applyFirstPage(initialModel<string>(), page(40, 26), false);
    m = applyNextPage(m, page(26, 12));
    expect(ids(m).filter((x) => x === 'n26')).toHaveLength(1);
  });

  it('counts the next page as the last page even when page 1 changes later', () => {
    let m = applyFirstPage(initialModel<string>(), page(40, 26), false);
    m = applyNextPage(m, page(25, 20)); // short page: the end
    m = applyFirstPage(m, page(41, 27), false);
    expect(hasMore(m)).toBe(false);
  });
});

describe('refreshed notice', () => {
  it('replaces a notice with its fresh copy, e.g. after unpinning', () => {
    let m = applyFirstPage(initialModel<string>(), [e(n(1, true)), ...page(20, 7)], false);
    m = applyRefreshed(m, 'n1', null);
    expect(ids(m)).not.toContain('n1');
    m = applyFirstPage(initialModel<string>(), [e(n(1, true)), ...page(10, 2)], false);
    m = applyRefreshed(m, 'n1', e(n(1)));
    expect(itemsOf(m).at(-1)!.id).toBe('n1');
    expect(itemsOf(m).at(-1)!.pinned).toBe(false);
  });

  it('drops a fresh copy that now sorts past the loaded range, so paging does not skip notices', () => {
    let m = applyFirstPage(initialModel<string>(), [e(n(1, true)), ...page(30, 17)], false);
    expect(hasMore(m)).toBe(true);
    m = applyRefreshed(m, 'n1', e(n(1)));
    expect(ids(m)).not.toContain('n1');
    expect(cursorForMore(m)).toBe('n17');
  });
});

describe('feedStatus', () => {
  const base = { serverSeen: false, items: 0, hasCache: false, netOffline: false, failed: false };

  it('is loading before anything arrives', () => {
    expect(feedStatus(base)).toBe('loading');
  });

  it('is ready or empty once the server answered', () => {
    expect(feedStatus({ ...base, serverSeen: true, items: 3 })).toBe('ready');
    expect(feedStatus({ ...base, serverSeen: true, items: 0 })).toBe('empty');
  });

  it('shows cached items at once while the server is still loading', () => {
    expect(feedStatus({ ...base, hasCache: true, items: 15 })).toBe('ready');
  });

  it('is offline when the phone is offline and something is saved', () => {
    expect(feedStatus({ ...base, hasCache: true, items: 15, netOffline: true })).toBe('offline');
    expect(feedStatus({ ...base, serverSeen: true, items: 15, hasCache: true, netOffline: true })).toBe('offline');
  });

  it('is offline when the server cannot be reached but a saved feed exists', () => {
    expect(feedStatus({ ...base, hasCache: true, items: 15, failed: true })).toBe('offline');
  });

  it('is an error when it failed or is offline with nothing saved', () => {
    expect(feedStatus({ ...base, failed: true })).toBe('error');
    expect(feedStatus({ ...base, netOffline: true })).toBe('error');
  });

  it('stays ready after the server answered, even if a later listen fails', () => {
    expect(feedStatus({ ...base, serverSeen: true, items: 4, failed: true, hasCache: true })).toBe('ready');
  });
});
