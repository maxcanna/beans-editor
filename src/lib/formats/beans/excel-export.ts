import { cellValue, readWorkbook, type Cell, type Rows } from '../xlsx/read';
import { ORIGIN_COLUMNS, type ColumnType, type OriginColumn } from './columns';
import { BLENDS, ROASTING_TYPES, ROASTS } from './enums';
import { MAX_ORIGINS, type BeanRow, type Issue, type Origin } from './model';
import { isoFromSerial, parseCell, serialFromIso } from './values';

/**
 * Reads Beanconqueror's Excel export (Settings › Excel export).
 *
 * The export is written for people, not for re-import (uiExcel.exportBeans):
 * sheet names and headers are in the app's language, enums are English labels,
 * dates are strings in the user's date format, and the header row is shifted
 * against the data ("Degree of Roast" sits above the roast range). So the bean
 * sheet is read by column position, and its beans convert to template rows.
 */

/** A bean from the export: a template row plus the fields the template can't hold. */
export interface ExportBean extends BeanRow {
  uuid?: string;
  /** The roast slider value (0–100). */
  roastRange?: number;
  /** When the bean was added, as written in the export (date format plus time). */
  created?: string;
}

/** A sheet shown as-is: header row plus plain values. */
export interface ExportTable {
  name: string;
  headers: string[];
  rows: (string | number | boolean | null)[][];
}

/** Order of day, month and year in the export's date strings. */
export type DateOrder = 'dmy' | 'mdy';

export interface ExcelExportContent {
  beans: ExportBean[];
  brews: ExportTable;
  methods: ExportTable;
  grinders: ExportTable;
  /** Order used for dates like `03/04/2025`; `undefined` when no such date was found. */
  dateOrder: DateOrder | undefined;
  issues: Issue[];
}

export interface ReadExportOptions {
  /** Forces the order of slash dates; by default it's detected, falling back to day/month. */
  dateOrder?: DateOrder;
}

export class ExcelExportError extends Error {
  override name = 'ExcelExportError';
}

// Sheet order in uiExcel.write(): brews, beans, methods, grinders.
const SHEETS = { brews: 0, beans: 1, methods: 2, grinders: 3 } as const;

// Data columns of the bean sheet (uiExcel.exportBeans); origins follow in groups of ten.
const COL = {
  name: 0,
  roaster: 1,
  roastDate: 2,
  roastType: 3,
  roastRange: 4,
  degreeOfRoast: 5,
  customDegreeOfRoast: 6,
  blend: 7,
  weight: 8,
  cost: 9,
  flavourProfile: 10,
  cuppingPoints: 11,
  decaffeinated: 12,
  website: 13,
  ean: 14,
  notes: 15,
  rating: 16,
  created: 17,
  uuid: 18,
  archived: 19,
} as const;
const FIRST_ORIGIN_COL = 20;
// The export writes ten origin fields; it has no Fob or purchasing price.
const EXPORT_ORIGIN_COLUMNS: readonly OriginColumn[] = ORIGIN_COLUMNS.slice(0, 10);

const text: ColumnType = { kind: 'text' };
const number: ColumnType = { kind: 'number' };
const bool: ColumnType = { kind: 'bool' };
const BEAN_FIELDS: readonly [keyof typeof COL, ColumnType][] = [
  ['name', text],
  ['roaster', text],
  ['roastType', { kind: 'enum', values: ROASTING_TYPES }],
  ['roastRange', number],
  ['degreeOfRoast', { kind: 'enum', values: ROASTS }],
  ['customDegreeOfRoast', text],
  ['blend', { kind: 'enum', values: BLENDS }],
  ['weight', number],
  ['cost', number],
  ['flavourProfile', text],
  ['cuppingPoints', text],
  ['decaffeinated', bool],
  ['website', text],
  ['ean', text],
  ['notes', text],
  ['rating', number],
  ['created', text],
  ['uuid', text],
  ['archived', bool],
];

// moment().format() output for the date_format setting, optionally followed by a time.
const DATE_STRING = /^(\d{1,4})([./-])(\d{1,2})\2(\d{1,4})(?:[ ,T].*)?$/;

/** Finds the day/month order from slash dates where one part is above 12. */
export function detectDateOrder(values: readonly string[]): DateOrder | 'ambiguous' | undefined {
  let found = false;
  for (const value of values) {
    const m = DATE_STRING.exec(value.trim());
    if (!m || m[2] !== '/' || (m[1] ?? '').length === 4) continue;
    found = true;
    if (Number(m[1]) > 12) return 'dmy';
    if (Number(m[3]) > 12) return 'mdy';
  }
  return found ? 'ambiguous' : undefined;
}

/**
 * Parses a date written with one of Beanconqueror's date formats
 * (DD.MM.YYYY, DD/MM/YYYY, MM-DD-YYYY, MM/DD/YYYY, YYYY-MM-DD, YYYY/MM/DD) to ISO.
 */
export function parseExportDate(value: string, slashOrder: DateOrder): string | undefined {
  const m = DATE_STRING.exec(value.trim());
  if (!m) return undefined;
  const [, a = '', sep, b = '', c = ''] = m;
  let year: string, month: string, day: string;
  if (a.length === 4) [year, month, day] = [a, b, c];
  else if (c.length !== 4) return undefined;
  else if (sep === '.' || (sep === '/' && slashOrder === 'dmy')) [day, month, year] = [a, b, c];
  else [month, day, year] = [a, b, c];
  const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  return serialFromIso(iso) === undefined ? undefined : iso;
}

function toTable(name: string, rows: Rows | undefined): ExportTable {
  const [header = [], ...data] = rows ?? [];
  const width = Math.max(header.length, ...data.map((r) => r?.length ?? 0));
  const headers = Array.from({ length: width }, (_, i) => String(cellValue(header[i]) ?? ''));
  return {
    name,
    headers,
    rows: data
      .filter((r) => r?.some((c) => c !== undefined))
      .map((r) => Array.from({ length: width }, (_, i) => cellValue(r[i]) ?? null)),
  };
}

const isBlank = (cell: Cell | undefined) => !cell || (cell.t === 's' && cell.v.trim() === '');

export function readExcelExport(bytes: Uint8Array, options: ReadExportOptions = {}): ExcelExportContent {
  const workbook = readWorkbook(bytes);
  const names = workbook.sheetNames;
  const sheet = (i: number) => {
    const name = names[i];
    return { name: name ?? '', rows: name === undefined ? undefined : workbook.sheet(name) };
  };

  const beansSheet = sheet(SHEETS.beans);
  const header = beansSheet.rows?.[0] ?? [];
  if (names.length !== 4 || header.length < FIRST_ORIGIN_COL) {
    throw new ExcelExportError("This doesn't look like a Beanconqueror Excel export");
  }

  const issues: Issue[] = [];
  const dataRows = (beansSheet.rows ?? []).slice(1);
  const dateTexts = dataRows.flatMap((row) =>
    [row[COL.roastDate], row[COL.created]].flatMap((c) => (c?.t === 's' ? [c.v] : [])),
  );
  const detected = detectDateOrder(dateTexts);
  const dateOrder = options.dateOrder ?? (detected === 'ambiguous' ? 'dmy' : detected);
  if (detected === 'ambiguous' && !options.dateOrder) {
    issues.push({
      severity: 'warning',
      column: header[COL.roastDate]?.v.toString(),
      message: 'Dates like 03/04/2025 could be day/month or month/day; they were read as day/month',
    });
  }

  const beans: ExportBean[] = [];
  dataRows.forEach((row, i) => {
    if (!row || row.every(isBlank)) return;
    const rowNumber = i + 2;
    const bean: Record<string, unknown> = {};
    const report = (col: number, message: string) =>
      issues.push({
        severity: 'error',
        row: rowNumber,
        column: String(cellValue(header[col]) ?? ''),
        message,
      });

    for (const [key, type] of BEAN_FIELDS) {
      const parsed = parseCell(row[COL[key]], type);
      if (!parsed.ok) report(COL[key], parsed.message);
      else if (parsed.value !== undefined) bean[key] = parsed.value;
    }
    // getCustomRoastName() writes '-' when the roast isn't custom.
    if (bean['customDegreeOfRoast'] === '-') delete bean['customDegreeOfRoast'];

    const roastDate = row[COL.roastDate];
    if (roastDate?.t === 'n' || roastDate?.t === 'd') bean['roastDate'] = isoFromSerial(roastDate.v);
    else if (roastDate?.t === 's' && roastDate.v.trim() !== '' && roastDate.v !== 'Invalid date') {
      const iso = parseExportDate(roastDate.v, dateOrder ?? 'dmy');
      if (iso) bean['roastDate'] = iso;
      else report(COL.roastDate, `"${roastDate.v}" is not a date`);
    }

    const origins: Origin[] = [];
    for (let start = FIRST_ORIGIN_COL; start < row.length; start += EXPORT_ORIGIN_COLUMNS.length) {
      const origin: Record<string, unknown> = {};
      EXPORT_ORIGIN_COLUMNS.forEach((column, offset) => {
        const parsed = parseCell(row[start + offset], column.type);
        if (!parsed.ok) report(start + offset, parsed.message);
        else if (parsed.value !== undefined) origin[column.key] = parsed.value;
      });
      if (Object.keys(origin).length > 0) origins.push(origin as Origin);
    }
    if (origins.length > MAX_ORIGINS) {
      issues.push({
        severity: 'warning',
        row: rowNumber,
        message: `This bean has ${origins.length} origins; the import template holds ${MAX_ORIGINS}`,
      });
    }

    if (typeof bean['name'] !== 'string') {
      issues.push({
        severity: 'warning',
        row: rowNumber,
        message: 'This row has no name, so it was skipped',
      });
      return;
    }
    beans.push({ ...(bean as Omit<ExportBean, 'origins'>), name: bean['name'], origins });
  });

  const brews = sheet(SHEETS.brews);
  const methods = sheet(SHEETS.methods);
  const grinders = sheet(SHEETS.grinders);
  return {
    beans,
    brews: toTable(brews.name, brews.rows),
    methods: toTable(methods.name, methods.rows),
    grinders: toTable(grinders.name, grinders.rows),
    dateOrder,
    issues,
  };
}
