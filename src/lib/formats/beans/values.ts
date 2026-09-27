import { dateToSerial, serialToDate } from '../xlsx/cells';
import type { Cell } from '../xlsx/read';
import type { WriteValue } from '../xlsx/write';
import type { ColumnType } from './columns';
import { toCode } from './enums';

export type Parsed =
  { ok: true; value: string | number | boolean | undefined } | { ok: false; message: string };

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isoFromSerial(serial: number): string {
  return serialToDate(Math.floor(serial)).toISOString().slice(0, 10);
}

export function serialFromIso(iso: string): number | undefined {
  const m = ISO_DATE.exec(iso);
  if (!m) return undefined;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return date.toISOString().slice(0, 10) === iso ? dateToSerial(date) : undefined;
}

function cellText(cell: Cell): string {
  if (cell.t === 'd') return isoFromSerial(cell.v);
  return String(cell.v);
}

/** Converts a spreadsheet cell to the model value for a column type. */
export function parseCell(cell: Cell | undefined, type: ColumnType): Parsed {
  if (!cell || (cell.t === 's' && cell.v.trim() === '')) return { ok: true, value: undefined };
  if (cell.t === 'e') return { ok: false, message: `contains the error ${cell.v}` };

  switch (type.kind) {
    case 'text':
      return { ok: true, value: cellText(cell).trim() };
    case 'number': {
      const n = cell.t === 'n' || cell.t === 'd' ? cell.v : Number(String(cell.v).trim().replace(',', '.'));
      return Number.isFinite(n)
        ? { ok: true, value: n }
        : { ok: false, message: `"${cell.v}" is not a number` };
    }
    case 'date': {
      if (cell.t === 'd' || cell.t === 'n') return { ok: true, value: isoFromSerial(cell.v) };
      const s = String(cell.v).trim();
      return serialFromIso(s) !== undefined
        ? { ok: true, value: s }
        : { ok: false, message: `"${s}" is not a date (Beanconqueror needs a real Excel date)` };
    }
    case 'bool': {
      if (cell.t === 'b') return { ok: true, value: cell.v };
      const s = String(cell.v).trim().toLowerCase();
      if (['true', 'yes', '1'].includes(s)) return { ok: true, value: true };
      if (['false', 'no', '0'].includes(s)) return { ok: true, value: false };
      return { ok: false, message: `"${cell.v}" is not yes/no` };
    }
    case 'enum': {
      const code = toCode(type.values, String(cell.v));
      return code !== undefined
        ? { ok: true, value: code }
        : { ok: false, message: `"${cell.v}" is not one of ${Object.keys(type.values).join(', ')}` };
    }
  }
}

/** Converts a model value to what the importer expects in the cell. */
export function toCellValue(value: unknown, type: ColumnType): WriteValue {
  if (value === undefined || value === null || value === '') return null;
  switch (type.kind) {
    case 'date': {
      const serial = typeof value === 'string' ? serialFromIso(value) : undefined;
      return serial === undefined ? null : { serial };
    }
    case 'bool':
      return value === true;
    case 'number':
      return typeof value === 'number' && Number.isFinite(value) ? value : null;
    default:
      return String(value);
  }
}
