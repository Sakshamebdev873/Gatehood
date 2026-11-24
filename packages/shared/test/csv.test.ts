import { describe, expect, it } from 'vitest';
import { parseBuyersCsv } from '../src/csv.js';

// line 1 header (odd case and spaces), 2 ok, 3 blank, 4 missing phone,
// 5 ok, 6 duplicate of line 2 (phone written differently), 7 ok with config
const fixture =
  '﻿Tower , Unit,NAME,phone , Config\r\n' +
  'A,1204,Ravi Kumar,98765 43210,\r\n' +
  '\r\n' +
  'A,1205,Meera Shah,,\r\n' +
  'b,302,Arjun Rao,+91 99887 76655,\r\n' +
  'A,1204,Ravi Kumar,9876543210,\r\n' +
  'C,101,Priya Nair,9000011111,2BHK\r\n';

describe('parseBuyersCsv', () => {
  it('imports valid rows and reports bad ones by line', () => {
    const { rows, errors } = parseBuyersCsv(fixture);
    expect(rows.map((r) => r.unitId)).toEqual(['A-1204', 'B-0302', 'C-0101']);
    expect(rows[2]?.config).toBe('2BHK');
    expect(rows[0]?.config).toBeUndefined();
    expect(rows[0]).toMatchObject({ line: 2, tower: 'A', unit: '1204', name: 'Ravi Kumar', phone: '98765 43210' });
    expect(rows[1]).toMatchObject({ line: 5, tower: 'B', unit: '302' });
    expect(errors).toEqual([
      { line: 4, reason: 'Missing phone' },
      { line: 6, reason: 'Duplicate of line 2' },
    ]);
  });

  it('reports a missing required column', () => {
    expect(parseBuyersCsv('name,phone\nRavi,99').errors[0]?.reason).toMatch(/Missing column: tower/);
  });

  it('works with LF endings and no BOM', () => {
    const { rows, errors } = parseBuyersCsv('tower,unit,name,phone\nA,1204,Ravi,9876543210\n');
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
  });

  it('rejects a unit that is not a number', () => {
    const { rows, errors } = parseBuyersCsv('tower,unit,name,phone\nA,12x4,Ravi,9876543210');
    expect(rows).toEqual([]);
    expect(errors).toEqual([{ line: 2, reason: 'Unit must be a number' }]);
  });

  it('keeps line numbers right after a quoted field with a line break', () => {
    const { rows, errors } = parseBuyersCsv('tower,unit,name,phone\nA,1204,"Ravi\nKumar",9876543210\nA,1205,Meera,');
    expect(rows).toHaveLength(1);
    expect(errors).toEqual([{ line: 4, reason: 'Missing phone' }]);
  });

  it('returns nothing for an empty file', () => {
    expect(parseBuyersCsv('').rows).toEqual([]);
  });
});
