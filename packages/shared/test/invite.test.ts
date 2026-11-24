import { describe, expect, it } from 'vitest';
import { INVITE_SUFFIX_ALPHABET, generateInviteCode, normalizeInviteCode, unitIdOf } from '../src/invite.js';

describe('unitIdOf', () => {
  it('trims and upper-cases the tower', () => {
    expect(unitIdOf(' a ', '1204')).toBe('A-1204');
  });
  it('pads the unit number to four digits', () => {
    expect(unitIdOf('B', '302')).toBe('B-0302');
  });
});

describe('generateInviteCode', () => {
  it('is deterministic with a fixed random source', () => {
    expect(generateInviteCode('A', '1204', () => 0)).toBe('A1204-AAA');
  });
  it('uses the last alphabet character at the top of the range', () => {
    expect(generateInviteCode('A', '1204', () => 0.9999)).toBe('A1204-999');
  });
  it('has a random suffix with no 0, O, 1 or I', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateInviteCode('A', '1204')).toMatch(/^A1204-[A-HJ-NP-Z2-9]{3}$/);
    }
  });
  it('pads short unit numbers', () => {
    expect(generateInviteCode('b', '302', () => 0)).toBe('B0302-AAA');
  });
  it('has the documented alphabet', () => {
    expect(INVITE_SUFFIX_ALPHABET).toBe('ABCDEFGHJKLMNPQRSTUVWXYZ23456789');
  });
});

describe('normalizeInviteCode', () => {
  it('cleans lowercase and spaces', () => {
    expect(normalizeInviteCode(' a1204 7kq ')).toBe('A1204-7KQ');
  });
  it('adds a missing dash', () => {
    expect(normalizeInviteCode('A12047KQ')).toBe('A1204-7KQ');
  });
  it('keeps a correct code as it is', () => {
    expect(normalizeInviteCode('A1204-7KQ')).toBe('A1204-7KQ');
  });
  it('returns null for garbage', () => {
    expect(normalizeInviteCode('hello')).toBeNull();
    expect(normalizeInviteCode('')).toBeNull();
    expect(normalizeInviteCode('A1204-7K')).toBeNull();
  });
  it('returns null when the suffix uses a banned character', () => {
    expect(normalizeInviteCode('A1204-7KO')).toBeNull();
  });
});
