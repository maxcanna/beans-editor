import type { BackupData, BackupRecord, CollectionKey } from '../formats/backup/backup';

/**
 * Immutable edits on a backup. Each function returns a new BackupData and
 * leaves the input untouched, so reactive state can hold it as a raw value.
 * Records keep every field the editor doesn't know about.
 */

export const records = (data: BackupData, key: CollectionKey): readonly BackupRecord[] => data[key] ?? [];

export function findRecord(data: BackupData, key: CollectionKey, uuid: string): BackupRecord | undefined {
  return records(data, key).find((r) => r.config.uuid === uuid);
}

/** Beanconqueror's own ids: `crypto.randomUUID()` and seconds since the epoch (StorageClass.add). */
export function newConfig(now = Date.now()): BackupRecord['config'] {
  return { uuid: crypto.randomUUID(), unix_timestamp: Math.floor(now / 1000) };
}

export function addRecord(data: BackupData, key: CollectionKey, record: BackupRecord): BackupData {
  return { ...data, [key]: [...records(data, key), record] };
}

export function replaceRecord(data: BackupData, key: CollectionKey, record: BackupRecord): BackupData {
  const list = records(data, key);
  const index = list.findIndex((r) => r.config.uuid === record.config.uuid);
  if (index < 0) throw new Error(`No ${key} record ${record.config.uuid}`);
  return { ...data, [key]: list.with(index, record) };
}

/** Brew fields that point at other records (Brew.bean, Brew.mill, Brew.method_of_preparation). */
const BREW_REFERENCE: Partial<Record<CollectionKey, string>> = {
  BEANS: 'bean',
  MILL: 'mill',
  PREPARATION: 'method_of_preparation',
};

/** Number of brews that point at a record; those records can't be deleted. */
export function brewsUsing(data: BackupData, key: CollectionKey, uuid: string): number {
  const field = BREW_REFERENCE[key];
  if (!field) return 0;
  const brews = [...records(data, 'BREWS'), ...records(data, 'BARISTAMODE_BREWS')];
  return brews.filter((b) => (b as Record<string, unknown>)[field] === uuid).length;
}

export type DeleteResult = { ok: true; data: BackupData } | { ok: false; brews: number };

/** Deletes a record unless brews use it (spec: offer archiving instead). */
export function deleteRecord(data: BackupData, key: CollectionKey, uuid: string): DeleteResult {
  const brews = brewsUsing(data, key, uuid);
  if (brews > 0) return { ok: false, brews };
  return { ok: true, data: { ...data, [key]: records(data, key).filter((r) => r.config.uuid !== uuid) } };
}

/** Beans, grinders and methods are archived through their `finished` flag. */
export function setArchived(
  data: BackupData,
  key: CollectionKey,
  uuid: string,
  archived: boolean,
): BackupData {
  const record = findRecord(data, key, uuid);
  if (!record) throw new Error(`No ${key} record ${uuid}`);
  return replaceRecord(data, key, { ...record, finished: archived });
}
