import { strFromU8, unzipSync } from 'fflate';
import { parseRef } from './cells';
import { attributes, decodeXml, textContent } from './xml';

export type Cell =
  | { t: 's'; v: string }
  | { t: 'n'; v: number }
  | { t: 'b'; v: boolean }
  /** Numeric cell with a date format; `v` is the Excel serial. */
  | { t: 'd'; v: number }
  | { t: 'e'; v: string };

/** Sparse rows: `rows[r][c]`, zero-based, holes for empty cells. */
export type Rows = (Cell | undefined)[][];

export interface Workbook {
  sheetNames: string[];
  /** Parses a sheet on demand; `undefined` when the workbook has no sheet with that name. */
  sheet(name: string): Rows | undefined;
}

const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

function isDateFormatCode(code: string): boolean {
  // Drop quoted text, escapes, colours/conditions and locale blocks before looking for date tokens.
  const cleaned = code.replace(/"[^"]*"|\\.|\[[^\]]*\]/g, '');
  return /[dmyhs]/i.test(cleaned) && !/^[#0.,%\s]*$/.test(cleaned);
}

function resolveTarget(target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const parts = `xl/${target}`.split('/');
  const out: string[] = [];
  for (const part of parts) {
    if (part === '..') out.pop();
    else if (part !== '.') out.push(part);
  }
  return out.join('/');
}

export function readWorkbook(bytes: Uint8Array): Workbook {
  const files = unzipSync(bytes);
  const text = (path: string) => {
    const file = files[path];
    return file ? strFromU8(file) : undefined;
  };

  const workbookXml = text('xl/workbook.xml');
  if (!workbookXml) throw new Error('Not an xlsx file: xl/workbook.xml is missing');

  const rels = new Map<string, string>();
  for (const m of (text('xl/_rels/workbook.xml.rels') ?? '').matchAll(/<Relationship\b[^>]*>/g)) {
    const a = attributes(m[0]);
    if (a['Id'] && a['Target']) rels.set(a['Id'], resolveTarget(a['Target']));
  }

  const sheets = new Map<string, string>();
  for (const m of workbookXml.matchAll(/<sheet\b[^>]*>/g)) {
    const a = attributes(m[0]);
    const path = a['r:id'] ? rels.get(a['r:id']) : undefined;
    if (a['name'] && path) sheets.set(a['name'], path);
  }

  const date1904 = /<workbookPr\b[^>]*\bdate1904="(1|true)"/.test(workbookXml);

  const sharedStrings = [
    ...(text('xl/sharedStrings.xml') ?? '').matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g),
  ].map((m) => textContent(m[1] ?? ''));

  const dateStyles = new Set<number>();
  const stylesXml = text('xl/styles.xml') ?? '';
  const customFormats = new Map<number, string>();
  for (const m of stylesXml.matchAll(/<numFmt\b[^>]*>/g)) {
    const a = attributes(m[0]);
    customFormats.set(Number(a['numFmtId']), a['formatCode'] ?? '');
  }
  const cellXfs = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(stylesXml)?.[1] ?? '';
  [...cellXfs.matchAll(/<xf\b[^>]*>/g)].forEach((m, index) => {
    const id = Number(attributes(m[0])['numFmtId'] ?? 0);
    const custom = customFormats.get(id);
    if (BUILTIN_DATE_FORMATS.has(id) || (custom !== undefined && isDateFormatCode(custom)))
      dateStyles.add(index);
  });

  const cache = new Map<string, Rows>();

  function parseSheet(xml: string): Rows {
    const rows: Rows = [];
    for (const m of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const a = attributes(m[1] ?? '');
      const body = m[2] ?? '';
      if (!a['r']) continue;
      const { col, row } = parseRef(a['r']);
      const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let cell: Cell | undefined;
      switch (a['t']) {
        case 's':
          if (raw !== undefined) cell = { t: 's', v: sharedStrings[Number(raw)] ?? '' };
          break;
        case 'inlineStr':
          cell = { t: 's', v: textContent(/<is>([\s\S]*?)<\/is>/.exec(body)?.[1] ?? '') };
          break;
        case 'str':
          if (raw !== undefined) cell = { t: 's', v: decodeXml(raw) };
          break;
        case 'b':
          if (raw !== undefined) cell = { t: 'b', v: raw === '1' || raw === 'true' };
          break;
        case 'e':
          if (raw !== undefined) cell = { t: 'e', v: decodeXml(raw) };
          break;
        case 'd':
          if (raw !== undefined) {
            const ms = Date.parse(raw);
            if (!Number.isNaN(ms)) cell = { t: 'd', v: ms / 86_400_000 + 25569 };
          }
          break;
        default:
          if (raw !== undefined && raw !== '') {
            const n = Number(raw);
            const serial = date1904 ? n + 1462 : n;
            cell = dateStyles.has(Number(a['s'] ?? 0)) ? { t: 'd', v: serial } : { t: 'n', v: n };
          }
      }
      if (cell) (rows[row - 1] ??= [])[col] = cell;
    }
    return rows;
  }

  return {
    sheetNames: [...sheets.keys()],
    sheet(name) {
      const cached = cache.get(name);
      if (cached) return cached;
      const path = sheets.get(name);
      const xml = path ? text(path) : undefined;
      if (xml === undefined) return undefined;
      const rows = parseSheet(xml);
      cache.set(name, rows);
      return rows;
    },
  };
}

/** Plain value of a cell: strings, numbers, booleans; dates as Excel serials. */
export function cellValue(cell: Cell | undefined): string | number | boolean | undefined {
  return cell?.v;
}
