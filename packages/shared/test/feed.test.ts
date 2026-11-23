import { describe, expect, it } from 'vitest';
import { daysUntil, mergeNoticePages } from '../src/feed.js';
import type { Notice } from '../src/types.js';

const p = (id: string, pinned: boolean, t: number): Notice => ({
  id,
  pinned,
  createdAt: t,
  title: '',
  body: '',
  target: { type: 'all' },
  audience: ['all'],
  readCount: 0,
});

describe('mergeNoticePages', () => {
  it('puts pinned first, then newest, with no duplicates', () => {
    const merged = mergeNoticePages([
      [p('a', false, 3), p('b', true, 1)],
      [p('a', false, 3), p('c', false, 5)],
    ]);
    expect(merged.map((n) => n.id)).toEqual(['b', 'c', 'a']);
  });
  it('keeps the latest copy of a duplicate', () => {
    const merged = mergeNoticePages([[p('a', false, 3)], [{ ...p('a', true, 3), readCount: 7 }]]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ pinned: true, readCount: 7 });
  });
});

describe('daysUntil', () => {
  it('counts whole days to possession', () => {
    expect(daysUntil(new Date('2028-01-15'), new Date('2026-11-23T10:00:00Z'))).toBe(418);
  });
  it('never goes below zero', () => {
    expect(daysUntil(new Date('2020-01-01'), new Date())).toBe(0);
  });
});
