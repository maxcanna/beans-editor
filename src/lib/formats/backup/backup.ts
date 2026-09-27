import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import * as v from 'valibot';

/**
 * Beanconqueror's backup zip, mirroring the app's own writer and reader
 * (src/services/uiExportImportHelper.ts in graphefruit/Beanconqueror):
 * `Beanconqueror.json` holds every storage key; large collections are split
 * into chunks, the first chunk stays in the main file and the rest go to
 * `Beanconqueror_<Name>_<n>.json` starting at n = 1.
 */
export const MAIN_FILE = 'Beanconqueror.json';

export const CHUNKING = [
  { key: 'BREWS', fileName: 'Brews', size: 500 },
  { key: 'BEANS', fileName: 'Beans', size: 500 },
  { key: 'BARISTAMODE_BREWS', fileName: 'Baristamode', size: 250 },
] as const;

/** Storage keys that hold lists of records with `config.uuid`. */
export const COLLECTIONS = [
  'BEANS',
  'GREEN_BEANS',
  'BREWS',
  'MILL',
  'PREPARATION',
  'WATER',
  'ROASTING_MACHINES',
  'GRAPH',
  'BARISTAMODE_BREWS',
] as const;
export type CollectionKey = (typeof COLLECTIONS)[number];

const RecordSchema = v.looseObject({
  config: v.looseObject({ uuid: v.string(), unix_timestamp: v.number() }),
});
export type BackupRecord = v.InferOutput<typeof RecordSchema>;

/** Everything in the backup, keyed like the app's storage. Unknown keys are kept verbatim. */
export type BackupData = Record<string, unknown> & Partial<Record<CollectionKey, BackupRecord[]>>;

export class BackupError extends Error {
  override name = 'BackupError';
}

const chunkFileName = (fileName: string, index: number) => `Beanconqueror_${fileName}_${index}.json`;

function parseJson(bytes: Uint8Array, file: string): unknown {
  try {
    return JSON.parse(strFromU8(bytes));
  } catch {
    throw new BackupError(`${file} is not valid JSON`);
  }
}

export function readBackup(bytes: Uint8Array): BackupData {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new BackupError('Not a zip file');
  }
  const main = files[MAIN_FILE];
  if (!main) throw new BackupError(`The zip has no ${MAIN_FILE}`);

  const data = parseJson(main, MAIN_FILE);
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new BackupError(`${MAIN_FILE} is not an object`);
  }
  const backup = data as BackupData;

  for (const { key, fileName } of CHUNKING) {
    for (let i = 1; ; i++) {
      const name = chunkFileName(fileName, i);
      const chunk = files[name];
      if (!chunk) break;
      const items = parseJson(chunk, name);
      if (!Array.isArray(items)) throw new BackupError(`${name} is not a list`);
      const target = backup[key];
      if (!Array.isArray(target)) throw new BackupError(`${name} exists but ${key} is missing`);
      target.push(...(items as BackupRecord[]));
    }
  }

  for (const key of COLLECTIONS) {
    const value = backup[key];
    if (value === undefined) continue;
    const result = v.safeParse(v.array(RecordSchema), value);
    if (!result.success) {
      const issue = result.issues[0];
      const where = v.getDotPath(issue) ?? '';
      throw new BackupError(`${key}${where ? `.${where}` : ''}: ${issue.message}`);
    }
  }
  return backup;
}

/** Writes a zip the app's Settings › Import restores, chunked exactly like the app does. */
export function writeBackup(data: BackupData): Uint8Array {
  const main: Record<string, unknown> = { ...data };
  const files: Zippable = {};
  const chunks: [string, unknown[]][] = [];

  for (const { key, fileName, size } of CHUNKING) {
    const list = data[key];
    if (!Array.isArray(list) || list.length === 0) continue;
    main[key] = list.slice(0, size);
    for (let start = size, i = 1; start < list.length; start += size, i++) {
      chunks.push([chunkFileName(fileName, i), list.slice(start, start + size)]);
    }
  }

  files[MAIN_FILE] = strToU8(JSON.stringify(main));
  for (const [name, items] of chunks) files[name] = strToU8(JSON.stringify(items));
  return zipSync(files, { level: 6 });
}
