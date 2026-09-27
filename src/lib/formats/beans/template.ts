import { readWorkbook, type Rows } from '../xlsx/read';
import { fillSheet, type WriteValue } from '../xlsx/write';
import { GREEN_COLUMNS, ORIGIN_COLUMNS, originHeader, ROASTED_COLUMNS, type Column } from './columns';
import { MAX_ORIGINS, type BeanRow, type Issue, type Origin } from './model';
import { parseCell, toCellValue } from './values';

export type TemplateKind = 'roasted' | 'green';

export const TEMPLATE_SHEET: Record<TemplateKind, string> = { roasted: 'Beans', green: 'Green Beans' };
const COLUMNS: Record<TemplateKind, readonly Column[]> = { roasted: ROASTED_COLUMNS, green: GREEN_COLUMNS };

export interface TemplateContent {
  kind: TemplateKind;
  beans: BeanRow[];
  issues: Issue[];
}

function headerIndex(rows: Rows): Map<string, number> {
  const index = new Map<string, number>();
  (rows[0] ?? []).forEach((cell, col) => {
    if (cell && cell.t === 's' && !index.has(cell.v.trim())) index.set(cell.v.trim(), col);
  });
  return index;
}

/**
 * Reads a roasted or green import template the way Beanconqueror's importer
 * does (columns by header name, rows without a name are skipped), and reports
 * values the importer would drop or misread.
 */
export function readBeanTemplate(bytes: Uint8Array, kind: TemplateKind): TemplateContent {
  const sheetName = TEMPLATE_SHEET[kind];
  const rows = readWorkbook(bytes).sheet(sheetName);
  if (!rows) throw new Error(`The file has no "${sheetName}" sheet`);

  const headers = headerIndex(rows);
  const issues: Issue[] = [];
  if (!headers.has('Name'))
    issues.push({ severity: 'error', row: 1, message: 'The "Name" column is missing' });

  const beans: BeanRow[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((c) => c === undefined)) continue;
    const rowNumber = r + 1;
    const bean: Partial<BeanRow> & { origins: Origin[] } = { origins: [] };
    const target = bean as Record<string, unknown>;

    for (const column of COLUMNS[kind]) {
      const col = headers.get(column.header);
      if (col === undefined) continue;
      const parsed = parseCell(row[col], column.type);
      if (parsed.ok) {
        if (parsed.value !== undefined) target[column.key] = parsed.value;
      } else {
        issues.push({ severity: 'error', row: rowNumber, column: column.header, message: parsed.message });
      }
    }

    for (let n = 1; n <= MAX_ORIGINS; n++) {
      const origin: Record<string, unknown> = {};
      for (const column of ORIGIN_COLUMNS) {
        const header = originHeader(n, column);
        const col = headers.get(header);
        if (col === undefined) continue;
        const parsed = parseCell(row[col], column.type);
        if (parsed.ok) {
          if (parsed.value !== undefined) origin[column.key] = parsed.value;
        } else {
          issues.push({ severity: 'error', row: rowNumber, column: header, message: parsed.message });
        }
      }
      if (Object.keys(origin).length > 0) bean.origins[n - 1] = origin as Origin;
    }
    bean.origins = bean.origins.filter(Boolean);

    if (!bean.name) {
      issues.push({
        severity: 'warning',
        row: rowNumber,
        message: 'This row has no name, so Beanconqueror will skip it',
      });
      continue;
    }
    beans.push(bean as BeanRow);
  }
  return { kind, beans, issues };
}

/**
 * Writes beans into the bundled official template (or any template with the
 * same sheet), adding "2." to "4." origin columns when a bean needs them.
 */
export function writeBeanTemplate(
  template: Uint8Array,
  kind: TemplateKind,
  beans: readonly BeanRow[],
): Uint8Array {
  const sheet = TEMPLATE_SHEET[kind];
  const rows = readWorkbook(template).sheet(sheet);
  if (!rows) throw new Error(`The template has no "${sheet}" sheet`);

  const headers = [...headerIndex(rows).keys()];
  const originCount = Math.min(MAX_ORIGINS, Math.max(1, ...beans.map((b) => b.origins.length)));
  const needed = [
    ...COLUMNS[kind].map((c) => c.header),
    ...Array.from({ length: originCount }, (_, i) =>
      ORIGIN_COLUMNS.map((c) => originHeader(i + 1, c)),
    ).flat(),
  ];
  const appendHeaders = needed.filter((h) => !headers.includes(h));
  const allHeaders = [...headers, ...appendHeaders];
  const col = new Map(allHeaders.map((h, i) => [h, i]));

  const data = beans.map((bean) => {
    const out: WriteValue[] = [];
    const values = bean as unknown as Record<string, unknown>;
    for (const column of COLUMNS[kind]) {
      const i = col.get(column.header);
      if (i !== undefined) out[i] = toCellValue(values[column.key], column.type);
    }
    bean.origins.slice(0, MAX_ORIGINS).forEach((origin, n) => {
      for (const column of ORIGIN_COLUMNS) {
        const i = col.get(originHeader(n + 1, column));
        if (i !== undefined) out[i] = toCellValue(origin[column.key], column.type);
      }
    });
    return Array.from(out, (v) => v ?? null);
  });

  return fillSheet(template, data, { sheet, appendHeaders });
}
