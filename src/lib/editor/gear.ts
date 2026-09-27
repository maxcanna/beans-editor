import type { BackupRecord } from '../formats/backup/backup';
import { newConfig } from './records';

/** Grinders (MILL) and methods (PREPARATION) share the fields the editor shows. */
export type GearKey = 'MILL' | 'PREPARATION';

export interface GearForm {
  name: string;
  note: string;
  finished: boolean;
}

const text = (value: unknown) => (typeof value === 'string' ? value : '');

export function gearForm(record: BackupRecord): GearForm {
  const r = record as Record<string, unknown>;
  return { name: text(r['name']), note: text(r['note']), finished: r['finished'] === true };
}

export function applyGearForm(record: BackupRecord, form: GearForm): BackupRecord {
  const before = gearForm(record);
  const out: Record<string, unknown> = { ...record };
  for (const key of ['name', 'note', 'finished'] as const) {
    if (form[key] !== before[key]) out[key] = form[key];
  }
  return out as BackupRecord;
}

/**
 * A grinder as `new Mill()` creates it (src/classes/mill/mill.ts). Methods
 * aren't created here: the app builds them with brew-parameter settings that
 * only it knows how to fill in.
 */
export function newMill(now = Date.now()): BackupRecord {
  return {
    name: '',
    note: '',
    config: newConfig(now),
    finished: false,
    attachments: [],
    has_adjustable_speed: true,
    has_timer: true,
  };
}

export function filterGear(
  list: readonly BackupRecord[],
  query: string,
  showArchived: boolean,
): BackupRecord[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return list
    .filter((r) => {
      const f = gearForm(r);
      if (!showArchived && f.finished) return false;
      const haystack = `${f.name} ${f.note}`.toLowerCase();
      return words.every((w) => haystack.includes(w));
    })
    .sort((a, b) => gearForm(a).name.localeCompare(gearForm(b).name));
}
