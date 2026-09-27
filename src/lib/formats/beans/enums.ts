/**
 * Beanconqueror enums (src/enums/beans/*.ts in graphefruit/Beanconqueror):
 * codes are what the app stores and the template importer expects; labels
 * are what the Excel export writes.
 */

export const ROASTING_TYPES = {
  FILTER: 'Filter',
  ESPRESSO: 'Espresso',
  OMNI: 'Omni',
  UNKNOWN: 'Unknown',
} as const;

export const ROASTS = {
  UNKNOWN: 'Unknown',
  CINNAMON_ROAST: 'Cinnamon Roast',
  AMERICAN_ROAST: 'American Roast',
  NEW_ENGLAND_ROAST: 'New England Roast',
  HALF_CITY_ROAST: 'Half City Roast',
  MODERATE_LIGHT_ROAST: 'Moderate-Light Roast',
  CITY_ROAST: 'City roast',
  CITY_PLUS_ROAST: 'City+ Roast',
  FULL_CITY_ROAST: 'Full City Roast',
  FULL_CITY_PLUS_ROAST: 'Full City + Roast',
  ITALIAN_ROAST: 'Italian Roast',
  VIEANNA_ROAST: 'Vienna Roast',
  FRENCH_ROAST: 'French Roast',
  CUSTOM_ROAST: 'Custom',
} as const;

export const BLENDS = { UNKNOWN: 'Unknown', SINGLE_ORIGIN: 'Single Origin', BLEND: 'Blend' } as const;

// The app has no display labels for these; the export never writes them.
export const FREEZING_STORAGE = {
  UNKNOWN: 'UNKNOWN',
  COFFEE_BAG: 'COFFEE_BAG',
  COFFEE_JAR: 'COFFEE_JAR',
  ZIP_LOCK: 'ZIP_LOCK',
  VACUUM_SEALED: 'VACUUM_SEALED',
  TUBE: 'TUBE',
} as const;

export type RoastingType = keyof typeof ROASTING_TYPES;
export type Roast = keyof typeof ROASTS;
export type Blend = keyof typeof BLENDS;
export type FreezingStorage = keyof typeof FREEZING_STORAGE;

type EnumMap = Readonly<Record<string, string>>;

/**
 * Accepts a code (`ESPRESSO`), an English label (`Espresso`) or a known typo
 * (the official template's dropdown offers `UNKOWN`). Returns the code, or
 * undefined when the value isn't recognised.
 */
export function toCode<M extends EnumMap>(map: M, value: string): keyof M | undefined {
  const v = value.trim();
  if (v === '') return undefined;
  const upper = v.toUpperCase();
  if (upper === 'UNKOWN' && 'UNKNOWN' in map) return 'UNKNOWN';
  if (upper in map) return upper;
  const lower = v.toLowerCase();
  return Object.keys(map).find((code) => map[code]?.toLowerCase() === lower);
}
