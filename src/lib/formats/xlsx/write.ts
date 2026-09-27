import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { columnLetters, parseRef } from './cells';
import { attributes, encodeXml } from './xml';

/** A value to write. Dates are written as Excel serials in the column's date style. */
export type WriteValue = string | number | boolean | { serial: number } | null | undefined;

export interface FillOptions {
  /** Sheet to fill. */
  sheet: string;
  /** 1-based row where data starts; rows above (headers) are kept untouched. */
  firstRow?: number;
}

function sheetPath(files: Record<string, Uint8Array>, name: string): string {
  const workbook = strFromU8(files['xl/workbook.xml'] ?? new Uint8Array());
  const rels = strFromU8(files['xl/_rels/workbook.xml.rels'] ?? new Uint8Array());
  const sheetTag = [...workbook.matchAll(/<sheet\b[^>]*>/g)]
    .map((m) => attributes(m[0]))
    .find((a) => a['name'] === name);
  const relId = sheetTag?.['r:id'];
  const rel = [...rels.matchAll(/<Relationship\b[^>]*>/g)]
    .map((m) => attributes(m[0]))
    .find((a) => a['Id'] === relId);
  const target = rel?.['Target'];
  if (!target) throw new Error(`Sheet "${name}" not found`);
  return target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
}

class SharedStrings {
  #xml: string;
  #index = new Map<string, number>();
  #added: string[] = [];
  #count: number;

  constructor(xml: string | undefined) {
    this.#xml =
      xml ??
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="0" uniqueCount="0"></sst>';
    this.#count = (this.#xml.match(/<si>|<si\/>/g) ?? []).length;
  }

  get existed() {
    return this.#count > 0 || this.#added.length > 0;
  }

  id(value: string): number {
    const known = this.#index.get(value);
    if (known !== undefined) return known;
    const id = this.#count + this.#added.length;
    this.#added.push(value);
    this.#index.set(value, id);
    return id;
  }

  serialize(): string {
    const total = this.#count + this.#added.length;
    const items = this.#added
      .map((s) => `<si><t${/^\s|\s$|\n/.test(s) ? ' xml:space="preserve"' : ''}>${encodeXml(s)}</t></si>`)
      .join('');
    const withItems = this.#xml
      .replace(/<\/sst>\s*$/, `${items}</sst>`)
      .replace(/<sst([^>]*)\/>\s*$/, `<sst$1>${items}</sst>`);
    return withItems
      .replace(/(<sst\b[^>]*?\s)uniqueCount="\d+"/, `$1uniqueCount="${total}"`)
      .replace(/(<sst\b[^>]*?\s)count="\d+"/, `$1count="${total}"`);
  }
}

/** Adds the shared string part to the content types and workbook relationships. */
function registerSharedStrings(files: Zippable) {
  const types = strFromU8(files['[Content_Types].xml'] as Uint8Array);
  files['[Content_Types].xml'] = strToU8(
    types.replace(
      '</Types>',
      '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>',
    ),
  );
  const rels = strFromU8(files['xl/_rels/workbook.xml.rels'] as Uint8Array);
  files['xl/_rels/workbook.xml.rels'] = strToU8(
    rels.replace(
      '</Relationships>',
      '<Relationship Id="rIdBeanEditorSst" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>',
    ),
  );
}

/**
 * Replaces a sheet's data rows while keeping everything else in the workbook
 * byte-for-byte: other sheets, styles, data validations, column widths.
 *
 * The first existing data row acts as the style prototype: each written cell
 * takes the style (`s`) of the prototype cell in the same column, so date
 * columns keep their date format. Strings go to the shared string table,
 * which every spreadsheet reader supports.
 */
export function fillSheet(
  template: Uint8Array,
  rows: readonly (readonly WriteValue[])[],
  options: FillOptions,
): Uint8Array {
  const firstRow = options.firstRow ?? 2;
  const files = unzipSync(template);
  const path = sheetPath(files, options.sheet);
  const sheetFile = files[path];
  if (!sheetFile) throw new Error(`Sheet part ${path} is missing`);
  const sheetXml = strFromU8(sheetFile);

  const dataMatch = /<sheetData\b[^>]*?(?:\/>|>([\s\S]*?)<\/sheetData>)/.exec(sheetXml);
  if (!dataMatch) throw new Error(`Sheet "${options.sheet}" has no sheetData`);
  const existingRows = [...(dataMatch[1] ?? '').matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)];

  const kept: string[] = [];
  let prototype: string | undefined;
  let prototypeAttrs = '';
  for (const m of existingRows) {
    const r = Number(attributes(m[1] ?? '')['r']);
    if (r < firstRow) kept.push(m[0]);
    else if (r === firstRow) {
      prototype = m[2] ?? '';
      prototypeAttrs = (m[1] ?? '').replace(/\s*\br="\d+"/, '');
    }
  }

  const styleByColumn = new Map<number, string>();
  for (const c of (prototype ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>)/g)) {
    const a = attributes(c[1] ?? '');
    if (a['r'] && a['s'] !== undefined) styleByColumn.set(parseRef(a['r']).col, a['s']);
  }

  const sst = new SharedStrings(
    files['xl/sharedStrings.xml'] ? strFromU8(files['xl/sharedStrings.xml']) : undefined,
  );
  let maxCol = 0;
  const written = rows.map((values, i) => {
    const r = firstRow + i;
    const cells = values
      .map((value, col) => {
        if (value === null || value === undefined || value === '') return '';
        maxCol = Math.max(maxCol, col);
        const ref = `${columnLetters(col)}${r}`;
        const style = styleByColumn.get(col);
        const s = style !== undefined ? ` s="${style}"` : '';
        if (typeof value === 'string') return `<c r="${ref}"${s} t="s"><v>${sst.id(value)}</v></c>`;
        if (typeof value === 'boolean') return `<c r="${ref}"${s} t="b"><v>${value ? 1 : 0}</v></c>`;
        const n = typeof value === 'number' ? value : value.serial;
        if (!Number.isFinite(n)) return '';
        return `<c r="${ref}"${s}><v>${n}</v></c>`;
      })
      .join('');
    return `<row r="${r}"${prototypeAttrs.replace(/\s*\bspans="[^"]*"/, '')}>${cells}</row>`;
  });

  // Keep an empty prototype row so the file can be filled again later.
  if (rows.length === 0 && prototype !== undefined) {
    const emptyCells = [...prototype.matchAll(/<c\b([^>]*?)(?:\/>|>[\s\S]*?<\/c>)/g)]
      .map((c) => `<c${(c[1] ?? '').replace(/\s*\bt="[^"]*"/, '')}/>`)
      .join('');
    written.push(`<row r="${firstRow}"${prototypeAttrs}>${emptyCells}</row>`);
  }

  for (const [, ref] of kept.join('').matchAll(/<c\b[^>]*?\br="([A-Z]+\d+)"/g)) {
    if (ref) maxCol = Math.max(maxCol, parseRef(ref).col);
  }
  const lastRow = Math.max(
    firstRow - 1,
    firstRow - 1 + Math.max(rows.length, rows.length === 0 && prototype ? 1 : 0),
    1,
  );

  const newSheet = sheetXml
    .replace(dataMatch[0], `<sheetData>${kept.join('')}${written.join('')}</sheetData>`)
    .replace(/<dimension\b[^>]*\/>/, `<dimension ref="A1:${columnLetters(maxCol)}${lastRow}"/>`);

  const out: Zippable = {};
  for (const [name, data] of Object.entries(files)) out[name] = data;
  out[path] = strToU8(newSheet);
  if (sst.existed) {
    if (!files['xl/sharedStrings.xml']) registerSharedStrings(out);
    out['xl/sharedStrings.xml'] = strToU8(sst.serialize());
  }
  return zipSync(out, { level: 6 });
}
