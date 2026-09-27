import type { Blend, Roast, RoastingType } from '../formats/backup/enums';
import { ProtoWriter } from './proto';

/** An origin as BeanInformation carries it. */
export interface SharedOrigin {
  country?: string;
  region?: string;
  farm?: string;
  farmer?: string;
  elevation?: string;
  harvest_time?: string;
  variety?: string;
  processing?: string;
  certification?: string;
  percentage?: number;
}

/** The bean fields a link carries; everything is optional except the name. */
export interface SharedBean {
  name: string;
  roaster?: string;
  /** ISO date. */
  roastingDate?: string;
  note?: string;
  roast?: Roast;
  roast_custom?: string;
  beanMix?: Blend;
  bean_roasting_type?: RoastingType;
  aromatics?: string;
  /** Grams. */
  weight?: number;
  cost?: number;
  cupping_points?: string;
  decaffeinated?: boolean;
  url?: string;
  ean_article_number?: string;
  bean_information?: SharedOrigin[];
  /** Image URLs the app downloads as attachments. */
  external_images?: string[];
}

// Proto enum numbers, in bean.proto order.
const ROAST_NUMBERS: Record<Roast, number> = {
  UNKNOWN: 0,
  CINNAMON_ROAST: 1,
  AMERICAN_ROAST: 2,
  NEW_ENGLAND_ROAST: 3,
  HALF_CITY_ROAST: 4,
  MODERATE_LIGHT_ROAST: 5,
  CITY_ROAST: 6,
  CITY_PLUS_ROAST: 7,
  FULL_CITY_ROAST: 8,
  FULL_CITY_PLUS_ROAST: 9,
  ITALIAN_ROAST: 10,
  VIEANNA_ROAST: 11,
  FRENCH_ROAST: 12,
  CUSTOM_ROAST: 13,
};
const BLEND_NUMBERS: Record<Blend, number> = { UNKNOWN: 0, SINGLE_ORIGIN: 1, BLEND: 2 };
const ROASTING_TYPE_NUMBERS: Record<RoastingType, number> = { UNKNOWN: 0, FILTER: 1, ESPRESSO: 2, OMNI: 3 };

const ORIGIN_FIELDS = [
  'country',
  'region',
  'farm',
  'farmer',
  'elevation',
  'harvest_time',
  'variety',
  'processing',
  'certification',
] as const;

function encodeOrigin(origin: SharedOrigin): ProtoWriter {
  const w = new ProtoWriter();
  ORIGIN_FIELDS.forEach((key, i) => {
    const value = origin[key];
    if (value) w.string(i + 1, value);
  });
  if (origin.percentage !== undefined) w.double(10, origin.percentage);
  return w;
}

/** Encodes a bean as BeanProto bytes. */
export function encodeBean(bean: SharedBean): Uint8Array {
  const w = new ProtoWriter();
  const str = (field: number, value: string | undefined) => {
    if (value) w.string(field, value);
  };
  const num = (field: number, value: number | undefined) => {
    if (value !== undefined && Number.isFinite(value)) w.double(field, value);
  };
  str(1, bean.name);
  str(3, bean.roastingDate);
  str(4, bean.note);
  str(5, bean.roaster);
  if (bean.roast) w.uint(7, ROAST_NUMBERS[bean.roast]);
  if (bean.beanMix) w.uint(9, BLEND_NUMBERS[bean.beanMix]);
  str(10, bean.roast_custom);
  str(11, bean.aromatics);
  num(12, bean.weight);
  num(14, bean.cost);
  str(16, bean.cupping_points);
  if (bean.decaffeinated !== undefined) w.bool(17, bean.decaffeinated);
  str(18, bean.url);
  str(19, bean.ean_article_number);
  for (const origin of bean.bean_information ?? []) w.message(21, encodeOrigin(origin));
  if (bean.bean_roasting_type) w.uint(22, ROASTING_TYPE_NUMBERS[bean.bean_roasting_type]);
  for (const image of bean.external_images ?? []) str(29, image);
  return w.finish();
}

function base64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/** The app reads the payload in 400-character chunks (share-service.service.ts). */
const CHUNK = 400;

/**
 * A link that opens Beanconqueror's Add Bean screen filled in with `bean`
 * (intent-handler.service.ts, ADD_USER_BEAN). The app has no allow-list for these.
 */
export function beanLink(bean: SharedBean): string {
  const payload = base64(encodeBean(bean));
  const params = new URLSearchParams();
  for (let i = 0; i * CHUNK < payload.length; i++) {
    params.set(`shareUserBean${i}`, payload.slice(i * CHUNK, (i + 1) * CHUNK));
  }
  return `beanconqueror://ADD_USER_BEAN?${params.toString()}`;
}

/** A readable bean name from a product URL's last path segment ("ethiopia-guji_natural" → "Ethiopia Guji Natural"). */
export function nameFromUrl(url: URL): string {
  const segment = url.pathname.split('/').filter(Boolean).at(-1) ?? '';
  let slug = segment;
  try {
    slug = decodeURIComponent(segment);
  } catch {
    // Keep the raw segment.
  }
  const words = slug
    .replace(/\.[a-z0-9]+$/i, '')
    .split(/[-_+\s]+/)
    .filter(Boolean);
  if (words.length === 0) return url.hostname.replace(/^www\./, '');
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/** Finds the first http(s) URL in what an app shared (Android puts it in `text` more often than `url`). */
export function findSharedUrl(...fields: (string | null | undefined)[]): URL | undefined {
  for (const field of fields) {
    const match = field?.match(/https?:\/\/[^\s<>"']+/i);
    if (!match) continue;
    try {
      return new URL(match[0]);
    } catch {
      // Not a URL after all; try the next field.
    }
  }
  return undefined;
}
