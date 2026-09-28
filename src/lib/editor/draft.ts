import { createStore, del, get, set } from 'idb-keyval';
import * as v from 'valibot';
import { COLLECTIONS } from '../formats/backup/backup';
import type { BackupData } from '../formats/backup/backup';

/**
 * The open backup, kept in IndexedDB so a reload or a closed tab doesn't lose
 * work. Stored drafts carry a version and are checked on load; a draft that
 * fails the check is handed back raw so the user can download it, never
 * dropped silently.
 */
export const DRAFT_VERSION = 1;

const RecordSchema = v.looseObject({
  config: v.looseObject({ uuid: v.string(), unix_timestamp: v.number() }),
});

const DraftSchema = v.object({
  version: v.literal(DRAFT_VERSION),
  fileName: v.string(),
  savedAt: v.number(),
  /** Edited since the file was opened or last downloaded. */
  dirty: v.boolean(),
  data: v.looseObject(Object.fromEntries(COLLECTIONS.map((key) => [key, v.optional(v.array(RecordSchema))]))),
});

export interface Draft {
  version: typeof DRAFT_VERSION;
  fileName: string;
  savedAt: number;
  dirty: boolean;
  data: BackupData;
}

export type LoadedDraft =
  { status: 'none' } | { status: 'ok'; draft: Draft } | { status: 'invalid'; raw: unknown };

/** The subset of idb-keyval the draft needs; tests pass an in-memory map. */
export interface DraftStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
}

const KEY = 'draft';

export function idbDraftStore(): DraftStore {
  const store = createStore('beans-editor', 'drafts');
  return {
    get: (key) => get(key, store),
    set: (key, value) => set(key, value, store),
    del: (key) => del(key, store),
  };
}

/** Converts older drafts forward. There's only one version so far. */
function migrate(raw: unknown): unknown {
  return raw;
}

export async function loadDraft(store: DraftStore): Promise<LoadedDraft> {
  const raw = await store.get(KEY);
  if (raw === undefined) return { status: 'none' };
  const result = v.safeParse(DraftSchema, migrate(raw));
  return result.success ? { status: 'ok', draft: result.output as Draft } : { status: 'invalid', raw };
}

export async function saveDraft(store: DraftStore, draft: Omit<Draft, 'version'>): Promise<void> {
  await store.set(KEY, { version: DRAFT_VERSION, ...draft });
}

export async function clearDraft(store: DraftStore): Promise<void> {
  await store.del(KEY);
}
