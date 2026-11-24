import type { Notice, NoticeTarget } from '@gatehood/shared';
import { describe, expect, it } from 'vitest';

import { audienceLabel, relativeTime } from '../src/features/feed/labels';

const me = { towerId: 'A', unitId: 'A-1204' };

function notice(target: NoticeTarget, pinned = false): Notice {
  return { id: 'n', title: 't', body: 'b', pinned, createdAt: 0, target, audience: [], readCount: 0 };
}

describe('audienceLabel', () => {
  it('names a whole-project notice "All towers"', () => {
    expect(audienceLabel(notice({ type: 'all' }), me)).toBe('All towers');
  });

  it('names a pinned whole-project notice "Pinned · all towers"', () => {
    expect(audienceLabel(notice({ type: 'all' }, true), me)).toBe('Pinned · all towers');
  });

  it("names a tower notice by the buyer's own tower", () => {
    expect(audienceLabel(notice({ type: 'towers', towers: ['B', 'A'] }), me)).toBe('Tower A');
  });

  it('names a unit notice "Your unit · A-1204"', () => {
    expect(audienceLabel(notice({ type: 'units', unitIds: ['A-1204', 'B-0302'] }), me)).toBe('Your unit · A-1204');
  });

  it('keeps the audience after "Pinned ·" for targeted notices', () => {
    expect(audienceLabel(notice({ type: 'towers', towers: ['A'] }, true), me)).toBe('Pinned · Tower A');
    expect(audienceLabel(notice({ type: 'units', unitIds: ['A-1204'] }, true), me)).toBe('Pinned · your unit');
  });
});

describe('relativeTime', () => {
  const now = Date.UTC(2026, 10, 24, 12, 0, 0);
  const MIN = 60_000;

  it('says "now" for under a minute', () => {
    expect(relativeTime(now - 30_000, now)).toBe('now');
  });

  it('counts minutes, hours and days', () => {
    expect(relativeTime(now - 5 * MIN, now)).toBe('5m');
    expect(relativeTime(now - 2 * 60 * MIN, now)).toBe('2h');
    expect(relativeTime(now - 3 * 24 * 60 * MIN, now)).toBe('3d');
  });

  it('shows a date once it is a week or more old', () => {
    expect(relativeTime(Date.UTC(2026, 10, 12, 12), now)).toBe('12 Nov');
  });

  it('treats a clock slightly ahead of the phone as "now"', () => {
    expect(relativeTime(now + 90_000, now)).toBe('now');
  });
});
