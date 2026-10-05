import type { BackupData, BackupRecord } from '../formats/backup/backup';
import { localDay } from './beans';
import { records } from './records';
import { sortRecords, type Sort } from './sort';

/**
 * The brew fields the editor shows, under Beanconqueror's names
 * (src/classes/brew/brew.ts). Brews are recorded in the app, so the editor
 * corrects and deletes them but doesn't create them.
 */
export interface BrewForm {
  /** Local date and time, `YYYY-MM-DDTHH:mm`; stored as `config.unix_timestamp` in seconds. */
  when: string;
  bean: string;
  method_of_preparation: string;
  mill: string;
  grind_size: string;
  /** Dose in grams. */
  grind_weight: number | null;
  /** Water in grams or ml. */
  brew_quantity: number | null;
  brew_beverage_quantity: number | null;
  brew_temperature: number | null;
  /** Seconds. */
  brew_time: number | null;
  tds: number | null;
  rating: number | null;
  note: string;
}

const NUMBER_FIELDS = [
  'grind_weight',
  'brew_quantity',
  'brew_beverage_quantity',
  'brew_temperature',
  'brew_time',
  'tds',
  'rating',
] as const;
const TEXT_FIELDS = ['bean', 'method_of_preparation', 'mill', 'grind_size', 'note'] as const;

const field = (record: BackupRecord, key: string) => (record as Record<string, unknown>)[key];
const pad = (n: number) => String(n).padStart(2, '0');

export function localDateTime(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function unixFromLocalDateTime(value: string): number | undefined {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? undefined : Math.floor(time / 1000);
}

export function brewForm(brew: BackupRecord): BrewForm {
  const text = (key: string) => {
    const value = field(brew, key);
    return typeof value === 'string' ? value : '';
  };
  const num = (key: string) => {
    const value = field(brew, key);
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  };
  return {
    when: localDateTime(brew.config.unix_timestamp),
    ...(Object.fromEntries(TEXT_FIELDS.map((k) => [k, text(k)])) as Pick<
      BrewForm,
      (typeof TEXT_FIELDS)[number]
    >),
    ...(Object.fromEntries(NUMBER_FIELDS.map((k) => [k, num(k)])) as Pick<
      BrewForm,
      (typeof NUMBER_FIELDS)[number]
    >),
  };
}

/** Writes only the fields that changed, so an untouched brew is written back as it was. */
export function applyBrewForm(brew: BackupRecord, form: BrewForm): BackupRecord {
  const before = brewForm(brew);
  const out: Record<string, unknown> = { ...brew };
  for (const key of [...TEXT_FIELDS, ...NUMBER_FIELDS]) {
    if (form[key] !== before[key]) out[key] = form[key] ?? 0; // The app stores 0 for empty numbers.
  }
  const unix = unixFromLocalDateTime(form.when);
  if (form.when !== before.when && unix !== undefined) {
    // Untouched, the time keeps the seconds the app recorded, which the form doesn't show.
    out['config'] = { ...brew.config, unix_timestamp: unix };
  }
  return out as BackupRecord;
}

export type BrewErrors = Partial<Record<keyof BrewForm, 'required' | 'negative' | 'range'>>;

export function validateBrew(form: BrewForm, maxRating = 5): BrewErrors {
  const errors: BrewErrors = {};
  if (unixFromLocalDateTime(form.when) === undefined) errors.when = 'required';
  for (const key of NUMBER_FIELDS) {
    const value = form[key];
    if (value !== null && value < 0) errors[key] = 'negative';
  }
  if (form.rating !== null && form.rating > maxRating) errors.rating = 'range';
  return errors;
}

export interface BrewFilter {
  query: string;
  bean: string;
  method: string;
  mill: string;
  /** Local days, `YYYY-MM-DD`, inclusive; empty for no limit. */
  from: string;
  to: string;
  /**
   * Brews of archived or frozen beans are hidden unless asked for; a brew takes its state from its bean. Frozen
   * means the bean was ever frozen, thawed or not: a bean is brewed after it's thawed.
   */
  showArchived: boolean;
  showFrozen: boolean;
}

export const emptyBrewFilter = (): BrewFilter => ({
  query: '',
  bean: '',
  method: '',
  mill: '',
  from: '',
  to: '',
  showArchived: false,
  showFrozen: false,
});

/**
 * Whether each bean is archived or has been frozen, by uuid, so brews can inherit it. Frozen means a frozen date,
 * even when it's thawed: a bean can't be brewed while it's in the freezer, so the app's thawed batches are the ones
 * brews point at.
 */
export function beanStates(data: BackupData): Map<string, { archived: boolean; frozen: boolean }> {
  const states = new Map<string, { archived: boolean; frozen: boolean }>();
  for (const bean of records(data, 'BEANS')) {
    states.set(bean.config.uuid, {
      archived: field(bean, 'finished') === true,
      frozen: localDay(field(bean, 'frozenDate')) !== '',
    });
  }
  return states;
}

/** Names of the records brews point at, for display and search. */
export function nameIndex(data: BackupData): Map<string, string> {
  const names = new Map<string, string>();
  for (const key of ['BEANS', 'MILL', 'PREPARATION'] as const) {
    for (const r of records(data, key)) {
      const name = field(r, 'name');
      names.set(r.config.uuid, typeof name === 'string' ? name : '');
    }
  }
  return names;
}

/** Brews matching the filter, newest first like the app. */
export function filterBrews(
  brews: readonly BackupRecord[],
  names: ReadonlyMap<string, string>,
  filter: BrewFilter,
  states: ReadonlyMap<string, { archived: boolean; frozen: boolean }> = new Map(),
): BackupRecord[] {
  const words = filter.query.toLowerCase().split(/\s+/).filter(Boolean);
  const start = filter.from ? new Date(`${filter.from}T00:00`).getTime() / 1000 : -Infinity;
  const end = filter.to ? new Date(`${filter.to}T00:00`).getTime() / 1000 + 86_400 : Infinity;
  return brews
    .filter((brew) => {
      if (filter.bean && field(brew, 'bean') !== filter.bean) return false;
      // Picking a bean outright shows its brews whatever its state.
      const state = filter.bean ? undefined : states.get(String(field(brew, 'bean')));
      if (!filter.showArchived && state?.archived) return false;
      if (!filter.showFrozen && state?.frozen) return false;
      if (filter.method && field(brew, 'method_of_preparation') !== filter.method) return false;
      if (filter.mill && field(brew, 'mill') !== filter.mill) return false;
      const t = brew.config.unix_timestamp;
      if (t < start || t >= end) return false;
      if (words.length === 0) return true;
      const haystack = [
        names.get(String(field(brew, 'bean'))),
        names.get(String(field(brew, 'method_of_preparation'))),
        names.get(String(field(brew, 'mill'))),
        field(brew, 'note'),
        field(brew, 'grind_size'),
      ]
        .filter((x) => typeof x === 'string')
        .join(' ')
        .toLowerCase();
      return words.every((w) => haystack.includes(w));
    })
    .sort((a, b) => b.config.unix_timestamp - a.config.unix_timestamp);
}

export type BrewSortKey = 'when' | 'bean' | 'method' | 'mill' | 'dose' | 'water' | 'rating';

/** Brews ordered by a table column; without a sort they stay as they are. */
export function sortBrews(
  brews: readonly BackupRecord[],
  names: ReadonlyMap<string, string>,
  sort: Sort<BrewSortKey> | null,
): BackupRecord[] {
  const name = (brew: BackupRecord, key: string) => {
    const uuid = field(brew, key);
    return typeof uuid === 'string' && uuid ? (names.get(uuid) ?? null) || null : null;
  };
  const amount = (brew: BackupRecord, key: string) => {
    const value = field(brew, key);
    return typeof value === 'number' && value > 0 ? value : null;
  };
  return sortRecords(brews, sort, (brew, key) => {
    switch (key) {
      case 'when':
        return brew.config.unix_timestamp;
      case 'bean':
        return name(brew, 'bean');
      case 'method':
        return name(brew, 'method_of_preparation');
      case 'mill':
        return name(brew, 'mill');
      case 'dose':
        return amount(brew, 'grind_weight');
      case 'water':
        return amount(brew, 'brew_quantity');
      case 'rating':
        return amount(brew, 'rating');
    }
  });
}
