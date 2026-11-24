import { describe, expect, it } from 'vitest';

import { isGoneError } from '../src/features/feed/noticeLoad';

describe('isGoneError', () => {
  it('treats denied, missing and bad ids as gone for good', () => {
    expect(isGoneError({ code: 'permission-denied' })).toBe(true);
    expect(isGoneError({ code: 'not-found' })).toBe(true);
    expect(isGoneError({ code: 'invalid-argument' })).toBe(true);
  });

  it('treats offline and unknown failures as worth retrying', () => {
    expect(isGoneError({ code: 'unavailable' })).toBe(false);
    expect(isGoneError({ code: 'deadline-exceeded' })).toBe(false);
    expect(isGoneError(new Error('network'))).toBe(false);
    expect(isGoneError(null)).toBe(false);
    expect(isGoneError('permission-denied')).toBe(false);
  });
});
