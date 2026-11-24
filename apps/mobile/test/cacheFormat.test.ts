import type { Notice } from '@gatehood/shared';
import { describe, expect, it } from 'vitest';

import { encodeFeed, decodeFeed, feedKey } from '../src/features/feed/cacheFormat';

const notice: Notice = {
  id: 'n1',
  title: 'Water off Thu',
  body: '10am to 2pm',
  pinned: false,
  createdAt: 1_700_000_000_000,
  target: { type: 'towers', towers: ['A'] },
  audience: ['tower:A'],
  readCount: 3,
};

describe('feed cache format', () => {
  it('uses one key per user and filter', () => {
    expect(feedKey('u1', 'tower')).toBe('feed:v1:u1:tower');
  });

  it('round-trips the items and the time they were saved', () => {
    expect(decodeFeed(encodeFeed([notice], 1234))).toEqual({ items: [notice], savedAt: 1234 });
  });

  it('keeps an empty feed, so "nothing for you yet" also works offline', () => {
    expect(decodeFeed(encodeFeed([], 99))).toEqual({ items: [], savedAt: 99 });
  });

  it('keeps the feed total when there is one, and ignores a bad one', () => {
    expect(decodeFeed(encodeFeed([], 99, 34))).toEqual({ items: [], savedAt: 99, total: 34 });
    expect(decodeFeed('{"items":[],"savedAt":1,"total":"many"}')).toEqual({ items: [], savedAt: 1 });
  });

  it('ignores missing, corrupt or wrongly shaped data', () => {
    expect(decodeFeed(null)).toBeNull();
    expect(decodeFeed('not json')).toBeNull();
    expect(decodeFeed('{"items":"x","savedAt":1}')).toBeNull();
    expect(decodeFeed('{"items":[],"savedAt":"yesterday"}')).toBeNull();
    expect(decodeFeed('{"items":[{"id":"n1"}],"savedAt":1}')).toBeNull();
  });
});
