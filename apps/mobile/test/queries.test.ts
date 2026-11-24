import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';

import { filterKeys, toNotice } from '../src/features/feed/queries';

const me = { towerId: 'A', unitId: 'A-1204' };

describe('filterKeys', () => {
  it('matches all three of the buyer\'s keys for "All"', () => {
    expect(filterKeys('all', me)).toEqual(['all', 'tower:A', 'unit:A-1204']);
  });

  it('matches only the tower or the unit key for the narrower filters', () => {
    expect(filterKeys('tower', me)).toEqual(['tower:A']);
    expect(filterKeys('unit', me)).toEqual(['unit:A-1204']);
  });
});

describe('toNotice', () => {
  const data = {
    title: 'Lift installation starts Monday',
    body: 'Tower A lifts.',
    pinned: true,
    createdAt: 1_700_000_000_000,
    target: { type: 'towers', towers: ['A'] },
    audience: ['tower:A'],
    readCount: 4,
    createdBy: 'builder-uid',
  };

  it('copies the fields the app uses and takes the id from the document', () => {
    expect(toNotice('n1', data)).toEqual({
      id: 'n1',
      title: 'Lift installation starts Monday',
      body: 'Tower A lifts.',
      pinned: true,
      createdAt: 1_700_000_000_000,
      target: { type: 'towers', towers: ['A'] },
      audience: ['tower:A'],
      readCount: 4,
    });
  });

  it('turns a Firestore Timestamp into milliseconds', () => {
    expect(toNotice('n1', { ...data, createdAt: Timestamp.fromMillis(1_700_000_000_500) }).createdAt).toBe(
      1_700_000_000_500,
    );
  });

  it('fills safe defaults for missing fields', () => {
    expect(toNotice('n2', {})).toEqual({
      id: 'n2',
      title: '',
      body: '',
      pinned: false,
      createdAt: 0,
      target: { type: 'all' },
      audience: [],
      readCount: 0,
    });
  });
});
