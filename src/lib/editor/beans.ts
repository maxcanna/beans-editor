import type { BackupRecord } from '../formats/backup/backup';
import type { Blend, RoastingType, Roast } from '../formats/beans/enums';
import { newConfig } from './records';

/**
 * The bean fields the editor shows, under Beanconqueror's own names
 * (src/classes/bean/bean.ts). Everything else on the record is kept as is.
 */
export interface BeanOrigin {
  country: string;
  region: string;
  farm: string;
  farmer: string;
  elevation: string;
  variety: string;
  processing: string;
  harvest_time: string;
  certification: string;
  percentage: number | null;
}

export interface BeanForm {
  name: string;
  roaster: string;
  /** Local date, `YYYY-MM-DD`, or empty. */
  roastingDate: string;
  bean_roasting_type: RoastingType;
  roast: Roast;
  roast_custom: string;
  beanMix: Blend;
  weight: number | null;
  cost: number | null;
  aromatics: string;
  cupping_points: string;
  decaffeinated: boolean;
  url: string;
  ean_article_number: string;
  note: string;
  rating: number | null;
  finished: boolean;
  bean_information: BeanOrigin[];
}

const ORIGIN_TEXT = [
  'country',
  'region',
  'farm',
  'farmer',
  'elevation',
  'variety',
  'processing',
  'harvest_time',
  'certification',
] as const;

const text = (value: unknown) => (typeof value === 'string' ? value : '');
const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/** The app stores dates as ISO timestamps; the form shows the local calendar day. */
export function localDay(iso: unknown): string {
  if (typeof iso !== 'string' || iso === '') return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local midnight of a `YYYY-MM-DD` day as an ISO timestamp, like the app's date pickers. */
export function isoFromLocalDay(day: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return '';
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toISOString();
}

export const emptyOrigin = (): BeanOrigin => ({
  country: '',
  region: '',
  farm: '',
  farmer: '',
  elevation: '',
  variety: '',
  processing: '',
  harvest_time: '',
  certification: '',
  percentage: null,
});

export function beanForm(bean: BackupRecord): BeanForm {
  const b = bean as Record<string, unknown>;
  const origins = Array.isArray(b['bean_information'])
    ? (b['bean_information'] as Record<string, unknown>[])
    : [];
  return {
    name: text(b['name']),
    roaster: text(b['roaster']),
    roastingDate: localDay(b['roastingDate']),
    bean_roasting_type: (text(b['bean_roasting_type']) || 'UNKNOWN') as RoastingType,
    roast: (text(b['roast']) || 'UNKNOWN') as Roast,
    roast_custom: text(b['roast_custom']),
    beanMix: (text(b['beanMix']) || 'UNKNOWN') as Blend,
    weight: num(b['weight']),
    cost: num(b['cost']),
    aromatics: text(b['aromatics']),
    cupping_points: text(b['cupping_points']),
    decaffeinated: b['decaffeinated'] === true,
    url: text(b['url']),
    ean_article_number: text(b['ean_article_number']),
    note: text(b['note']),
    rating: num(b['rating']),
    finished: b['finished'] === true,
    bean_information: origins.map((o) => ({
      ...Object.fromEntries(ORIGIN_TEXT.map((k) => [k, text(o[k])])),
      percentage: num(o['percentage']),
    })) as BeanOrigin[],
  };
}

/**
 * Writes form values onto a bean record, touching only the fields that
 * changed. Everything else, including extra keys on each origin, stays as
 * stored, so an unchanged bean is written back exactly as it was read.
 */
export function applyBeanForm(bean: BackupRecord, form: BeanForm): BackupRecord {
  const before = beanForm(bean);
  const out: Record<string, unknown> = { ...bean };
  for (const key of Object.keys(form) as (keyof BeanForm)[]) {
    if (key === 'bean_information' || form[key] === before[key]) continue;
    const value = form[key];
    if (key === 'roastingDate') out[key] = isoFromLocalDay(form.roastingDate);
    else out[key] = value ?? 0; // The app stores 0 for empty numbers.
  }
  if (JSON.stringify(form.bean_information) !== JSON.stringify(before.bean_information)) {
    const b = bean as Record<string, unknown>;
    const old = Array.isArray(b['bean_information'])
      ? (b['bean_information'] as Record<string, unknown>[])
      : [];
    out['bean_information'] = form.bean_information.map((origin, i) => ({
      // New origins start from the app's defaults (IBeanInformation).
      purchasing_price: 0,
      fob_price: 0,
      ...old[i],
      ...origin,
      percentage: origin.percentage ?? 0,
    }));
  }
  return out as BackupRecord;
}

/** A bean as `new Bean()` creates it (src/classes/bean/bean.ts), with fresh ids. */
export function newBean(now = Date.now()): BackupRecord {
  return {
    name: '',
    buyDate: '',
    roastingDate: '',
    note: '',
    roaster: '',
    config: newConfig(now),
    roast: 'UNKNOWN',
    roast_range: 0,
    roast_custom: '',
    beanMix: 'SINGLE_ORIGIN',
    aromatics: '',
    weight: 0,
    finished: false,
    cost: 0,
    attachments: [],
    decaffeinated: false,
    cupping_points: '',
    bean_roasting_type: 'UNKNOWN',
    bean_information: [],
    url: '',
    ean_article_number: '',
    bean_roast_information: {},
    rating: 0,
    qr_code: '',
    internal_share_code: '',
    favourite: false,
    shared: false,
    cupping: {
      body: 0,
      brightness: 0,
      clean_cup: 0,
      complexity: 0,
      cuppers_correction: 0,
      dry_fragrance: 0,
      finish: 0,
      flavor: 0,
      sweetness: 0,
      uniformity: 0,
      wet_aroma: 0,
      notes: '',
    },
    cupped_flavor: { predefined_flavors: {}, custom_flavors: [] },
    frozenDate: '',
    unfrozenDate: '',
    frozenId: '',
    frozenGroupId: '',
    frozenStorageType: 'UNKNOWN',
    frozenNote: '',
    bestDate: '',
    openDate: '',
    co2e_kg: 0,
  };
}

export type BeanErrors = Partial<Record<keyof BeanForm, 'required' | 'negative' | 'range' | 'percentage'>>;

/** Problems that stop a bean form from saving. `maxRating` is the backup's SETTINGS.bean_rating (default 5). */
export function validateBean(form: BeanForm, maxRating = 5): BeanErrors {
  const errors: BeanErrors = {};
  if (form.name.trim() === '') errors.name = 'required';
  for (const key of ['weight', 'cost'] as const) {
    const value = form[key];
    if (value !== null && value < 0) errors[key] = 'negative';
  }
  if (form.rating !== null && (form.rating < 0 || form.rating > maxRating)) errors.rating = 'range';
  const total = form.bean_information.reduce((sum, o) => sum + (o.percentage ?? 0), 0);
  if (total > 100) errors.bean_information = 'percentage';
  return errors;
}

export interface BeanFilter {
  query: string;
  showArchived: boolean;
}

/** Beans matching a search over name, roaster, origins and notes, newest first like the app. */
export function filterBeans(beans: readonly BackupRecord[], filter: BeanFilter): BackupRecord[] {
  const words = filter.query.toLowerCase().split(/\s+/).filter(Boolean);
  return beans
    .filter((bean) => {
      const b = bean as Record<string, unknown>;
      if (!filter.showArchived && b['finished'] === true) return false;
      if (words.length === 0) return true;
      const origins = Array.isArray(b['bean_information'])
        ? (b['bean_information'] as Record<string, unknown>[])
        : [];
      const haystack = [b['name'], b['roaster'], b['aromatics'], b['note'], ...origins.flatMap(Object.values)]
        .filter((x) => typeof x === 'string')
        .join(' ')
        .toLowerCase();
      return words.every((w) => haystack.includes(w));
    })
    .sort((a, b) => b.config.unix_timestamp - a.config.unix_timestamp);
}
