import * as v from 'valibot';

/**
 * The shape of a backup, apart from the zip code: the draft stored in the browser needs it at start-up, and
 * keeping it out of `backup.ts` lets the zip library load only when a file is opened.
 */

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

export const RecordSchema = v.looseObject({
  config: v.looseObject({ uuid: v.string(), unix_timestamp: v.number() }),
});
export type BackupRecord = v.InferOutput<typeof RecordSchema>;

/** Everything in the backup, keyed like the app's storage. Unknown keys are kept verbatim. */
export type BackupData = Record<string, unknown> & Partial<Record<CollectionKey, BackupRecord[]>>;
