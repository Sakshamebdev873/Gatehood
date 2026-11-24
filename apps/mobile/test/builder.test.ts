import { describe, expect, it } from 'vitest';

import {
  buildNoticeRequest,
  parseUnitIds,
  pct,
  postedLabel,
  STATUS_LABEL,
  targetLabel,
} from '../src/features/builder/logic';

describe('pct', () => {
  it('rounds to a whole percent', () => {
    expect(pct(184, 240)).toBe(77);
    expect(pct(1, 3)).toBe(33);
  });

  it('is 0 when there is nothing to divide by, never NaN', () => {
    expect(pct(0, 0)).toBe(0);
  });

  it('stays within 0 to 100', () => {
    expect(pct(5, 4)).toBe(100);
    expect(pct(-1, 4)).toBe(0);
  });
});

describe('targetLabel', () => {
  it('names the whole project', () => {
    expect(targetLabel({ type: 'all' })).toBe('All towers');
  });

  it('names one or several towers', () => {
    expect(targetLabel({ type: 'towers', towers: ['A'] })).toBe('Tower A');
    expect(targetLabel({ type: 'towers', towers: ['A', 'B'] })).toBe('Towers A, B');
  });

  it('names a few units, and counts many', () => {
    expect(targetLabel({ type: 'units', unitIds: ['A-1204'] })).toBe('Unit A-1204');
    expect(targetLabel({ type: 'units', unitIds: ['A-1204', 'B-0302'] })).toBe('Units A-1204, B-0302');
    expect(targetLabel({ type: 'units', unitIds: ['A-0101', 'A-0102', 'A-0103', 'A-0104'] })).toBe('4 units');
  });
});

describe('postedLabel', () => {
  it('joins the audience and the post date, like the mockup', () => {
    const ms = new Date(2026, 10, 21, 9, 0).getTime();
    expect(postedLabel({ type: 'towers', towers: ['A', 'B'] }, ms)).toBe('Towers A, B · posted 21 Nov');
  });
});

describe('STATUS_LABEL', () => {
  it('has a chip label for every invite status', () => {
    expect(STATUS_LABEL).toEqual({ joined: 'Joined', pending: 'Pending', expired: 'Expired' });
  });
});

describe('parseUnitIds', () => {
  it('reads comma, space or newline separated unit ids', () => {
    expect(parseUnitIds('A-1204, B-0302\nC-2004  A-0101')).toEqual({
      ids: ['A-1204', 'B-0302', 'C-2004', 'A-0101'],
      bad: [],
    });
  });

  it('normalises loose typing: lower case, no dash, short unit numbers', () => {
    expect(parseUnitIds('a-1204, b302, c 2004')).toEqual({ ids: ['A-1204', 'B-0302'], bad: ['c', '2004'] });
    expect(parseUnitIds('b-302')).toEqual({ ids: ['B-0302'], bad: [] });
  });

  it('drops repeats', () => {
    expect(parseUnitIds('A-1204, a1204, A-1204')).toEqual({ ids: ['A-1204'], bad: [] });
  });

  it('lists what it could not read', () => {
    expect(parseUnitIds('A-1204, 1204, Tower-A, A-12345678')).toEqual({
      ids: ['A-1204'],
      bad: ['1204', 'Tower-A', 'A-12345678'],
    });
  });

  it('is empty for blank input', () => {
    expect(parseUnitIds('  ,, \n')).toEqual({ ids: [], bad: [] });
  });
});

describe('buildNoticeRequest', () => {
  const base = { title: ' Water off Thursday ', body: ' 10am to 2pm. ', pinned: false, towers: [], unitsText: '' };

  it('builds a whole-project notice with trimmed text', () => {
    expect(buildNoticeRequest({ ...base, mode: 'all' })).toEqual({
      ok: true,
      request: { title: 'Water off Thursday', body: '10am to 2pm.', target: { type: 'all' }, pinned: false },
    });
  });

  it('builds a towers notice from the picked towers, in order', () => {
    const r = buildNoticeRequest({ ...base, mode: 'towers', towers: ['B', 'A'], pinned: true });
    expect(r).toEqual({
      ok: true,
      request: { title: 'Water off Thursday', body: '10am to 2pm.', target: { type: 'towers', towers: ['A', 'B'] }, pinned: true },
    });
  });

  it('builds a units notice from the typed ids', () => {
    const r = buildNoticeRequest({ ...base, mode: 'units', unitsText: 'a-1204, B-0302' });
    expect(r.ok && r.request.target).toEqual({ type: 'units', unitIds: ['A-1204', 'B-0302'] });
  });

  it('says what is missing, per field', () => {
    expect(buildNoticeRequest({ ...base, title: ' ', body: '', mode: 'towers' })).toEqual({
      ok: false,
      errors: {
        title: 'Add a title.',
        body: 'Add the notice text.',
        audience: 'Pick at least one tower.',
      },
    });
    expect(buildNoticeRequest({ ...base, mode: 'units', unitsText: '' })).toEqual({
      ok: false,
      errors: { audience: 'Type at least one unit, like A-1204.' },
    });
  });

  it('names unit ids it could not read instead of quietly dropping them', () => {
    expect(buildNoticeRequest({ ...base, mode: 'units', unitsText: 'A-1204, 12O4' })).toEqual({
      ok: false,
      errors: { audience: "These aren't unit ids: 12O4. Use the form A-1204." },
    });
  });

  it('holds title and text to the server limits', () => {
    const r = buildNoticeRequest({ ...base, mode: 'all', title: 'x'.repeat(121), body: 'y'.repeat(4001) });
    expect(r).toEqual({
      ok: false,
      errors: { title: 'Keep the title under 120 characters.', body: 'Keep the text under 4000 characters.' },
    });
  });
});
