import { describe, expect, it } from 'vitest';
import { audienceForTarget, audienceKeysFor, intersects } from '../src/audience.js';

describe('audienceKeysFor', () => {
  it('gives a buyer the project, tower and unit keys', () => {
    expect(audienceKeysFor({ towerId: 'A', unitId: 'A-1204' })).toEqual(['all', 'tower:A', 'unit:A-1204']);
  });
});

describe('audienceForTarget', () => {
  it('maps the whole project to all', () => {
    expect(audienceForTarget({ type: 'all' })).toEqual(['all']);
  });
  it('maps towers to tower keys without duplicates', () => {
    expect(audienceForTarget({ type: 'towers', towers: ['A', 'B', 'A'] })).toEqual(['tower:A', 'tower:B']);
  });
  it('maps units to unit keys', () => {
    expect(audienceForTarget({ type: 'units', unitIds: ['A-1204'] })).toEqual(['unit:A-1204']);
  });
  it('rejects an empty towers list', () => {
    expect(() => audienceForTarget({ type: 'towers', towers: [] })).toThrow();
  });
  it('rejects an empty units list', () => {
    expect(() => audienceForTarget({ type: 'units', unitIds: [] })).toThrow();
  });
});

describe('intersects', () => {
  it('is false when no key is shared', () => {
    expect(intersects(['tower:B'], ['all', 'tower:A', 'unit:A-1204'])).toBe(false);
  });
  it('is true when a key is shared', () => {
    expect(intersects(['tower:A', 'tower:B'], ['all', 'tower:A', 'unit:A-1204'])).toBe(true);
  });
});
