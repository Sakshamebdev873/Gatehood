import Papa from 'papaparse';
import { unitIdOf } from './invite.js';
import type { BuyerRow, RowError } from './types.js';

const REQUIRED = ['tower', 'unit', 'name', 'phone'] as const;

export interface ParsedBuyers {
  rows: BuyerRow[];
  errors: RowError[];
}

interface RawRow {
  line: number;
  fields: string[];
}

/** Splits the file into rows, keeping the 1-based file line each row starts on. */
function readRows(text: string): RawRow[] {
  const rows: RawRow[] = [];
  let line = 1;
  let consumed = 0;
  Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: false,
    step: (result) => {
      rows.push({ line, fields: result.data });
      const end = result.meta.cursor;
      for (let i = consumed; i < end; i++) {
        if (text.charCodeAt(i) === 10) line++;
      }
      consumed = end;
      // The cursor stops before the row's line break, so skip past it here.
      if (text.charCodeAt(consumed) === 13) consumed++;
      if (text.charCodeAt(consumed) === 10) {
        consumed++;
        line++;
      }
    },
  });
  return rows;
}

function isBlank(fields: string[]): boolean {
  return fields.every((f) => f.trim() === '');
}

function digitsOf(phone: string): string {
  return phone.replace(/\D/g, '');
}

function validate(get: (col: string) => string): string | null {
  for (const col of REQUIRED) {
    if (get(col) === '') return `Missing ${col}`;
  }
  if (!/^[A-Za-z]{1,3}$/.test(get('tower'))) return 'Tower must be 1 to 3 letters, like A';
  if (!/^\d{1,6}$/.test(get('unit'))) return 'Unit must be a number';
  const digits = digitsOf(get('phone')).length;
  if (digits < 7 || digits > 15) return 'Phone must have 7 to 15 digits';
  return null;
}

/**
 * Reads a buyers CSV with columns tower, unit, name, phone and an optional config.
 * Handles a BOM, CRLF, header case and spaces, and blank lines. Bad rows come back
 * as errors with their line number; duplicates (same unit and phone digits) are skipped.
 */
export function parseBuyersCsv(text: string): ParsedBuyers {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const raw = readRows(source).filter((r) => !isBlank(r.fields));
  const rows: BuyerRow[] = [];
  const errors: RowError[] = [];

  const header = raw.shift();
  if (!header) return { rows, errors };

  const columns = header.fields.map((h) => h.trim().toLowerCase());
  const missing = REQUIRED.filter((col) => !columns.includes(col));
  if (missing.length > 0) {
    return { rows, errors: missing.map((col) => ({ line: header.line, reason: `Missing column: ${col}` })) };
  }
  const indexOf = (col: string) => columns.indexOf(col);

  const seen = new Map<string, number>();
  for (const { line, fields } of raw) {
    const get = (col: string) => {
      const i = indexOf(col);
      return i < 0 ? '' : (fields[i] ?? '').trim();
    };

    const reason = validate(get);
    if (reason) {
      errors.push({ line, reason });
      continue;
    }

    const unitId = unitIdOf(get('tower'), get('unit'));
    const key = `${unitId}|${digitsOf(get('phone'))}`;
    const first = seen.get(key);
    if (first !== undefined) {
      errors.push({ line, reason: `Duplicate of line ${first}` });
      continue;
    }
    seen.set(key, line);

    const row: BuyerRow = {
      line,
      tower: get('tower').toUpperCase(),
      unit: get('unit'),
      unitId,
      name: get('name'),
      phone: get('phone'),
    };
    const config = get('config');
    if (config !== '') row.config = config;
    rows.push(row);
  }

  return { rows, errors };
}
