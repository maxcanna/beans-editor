import { unzipSync } from 'fflate';

export type FileKind = 'backup' | 'roasted-template' | 'green-template' | 'excel-export' | 'unknown';

export interface DetectedFile {
  kind: FileKind;
  name: string;
  size: number;
  /** Worksheet names for xlsx files, entry names for backups. */
  parts: string[];
}

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];
const BACKUP_MAIN = 'Beanconqueror.json';
const WORKBOOK = 'xl/workbook.xml';

export function isZip(bytes: Uint8Array): boolean {
  return ZIP_MAGIC.every((b, i) => bytes[i] === b);
}

/** Reads `<sheet name="…">` entries from workbook.xml without a DOM (works in workers). */
export function readSheetNames(workbookXml: string): string[] {
  return [...workbookXml.matchAll(/<sheet\b[^>]*\bname="([^"]*)"/g)].map((m) => decodeXml(m[1] ?? ''));
}

function decodeXml(value: string): string {
  return value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&');
}

export function classifySheets(sheets: readonly string[]): FileKind {
  const has = (name: string) => sheets.includes(name);
  if (has('Green Beans') && has('Bean_Information')) return 'green-template';
  if (has('Beans') && has('Bean_Information')) return 'roasted-template';
  if (has('Brews') && has('Beans')) return 'excel-export';
  return 'unknown';
}

/**
 * Identifies a Beanconqueror file by its contents, never by its name or MIME type
 * (Android share intents are inconsistent about both).
 */
export function detectFile(name: string, bytes: Uint8Array): DetectedFile {
  const base = { name, size: bytes.byteLength };
  if (!isZip(bytes)) return { ...base, kind: 'unknown', parts: [] };

  const entries: string[] = [];
  const files = unzipSync(bytes, {
    filter: (file) => {
      entries.push(file.name);
      return file.name === WORKBOOK;
    },
  });

  if (entries.includes(BACKUP_MAIN)) {
    return { ...base, kind: 'backup', parts: entries.filter((e) => e.endsWith('.json')) };
  }

  const workbook = files[WORKBOOK];
  if (workbook) {
    const sheets = readSheetNames(new TextDecoder().decode(workbook));
    return { ...base, kind: classifySheets(sheets), parts: sheets };
  }

  return { ...base, kind: 'unknown', parts: entries };
}
