import { m } from '$paraglide/messages';
import type { Blend, Roast, RoastingType } from '../formats/backup/enums';

/** Translatable labels for the codes Beanconqueror stores. */
export const ROAST_LABELS: Record<Roast, () => string> = {
  UNKNOWN: m.roast_UNKNOWN,
  CINNAMON_ROAST: m.roast_CINNAMON_ROAST,
  AMERICAN_ROAST: m.roast_AMERICAN_ROAST,
  NEW_ENGLAND_ROAST: m.roast_NEW_ENGLAND_ROAST,
  HALF_CITY_ROAST: m.roast_HALF_CITY_ROAST,
  MODERATE_LIGHT_ROAST: m.roast_MODERATE_LIGHT_ROAST,
  CITY_ROAST: m.roast_CITY_ROAST,
  CITY_PLUS_ROAST: m.roast_CITY_PLUS_ROAST,
  FULL_CITY_ROAST: m.roast_FULL_CITY_ROAST,
  FULL_CITY_PLUS_ROAST: m.roast_FULL_CITY_PLUS_ROAST,
  ITALIAN_ROAST: m.roast_ITALIAN_ROAST,
  VIEANNA_ROAST: m.roast_VIEANNA_ROAST,
  FRENCH_ROAST: m.roast_FRENCH_ROAST,
  CUSTOM_ROAST: m.roast_CUSTOM_ROAST,
};

export const ROASTING_TYPE_LABELS: Record<RoastingType, () => string> = {
  FILTER: m.roasting_type_FILTER,
  ESPRESSO: m.roasting_type_ESPRESSO,
  OMNI: m.roasting_type_OMNI,
  UNKNOWN: m.roasting_type_UNKNOWN,
};

export const BLEND_LABELS: Record<Blend, () => string> = {
  UNKNOWN: m.blend_UNKNOWN,
  SINGLE_ORIGIN: m.blend_SINGLE_ORIGIN,
  BLEND: m.blend_BLEND,
};

/** Label for a stored code, falling back to the raw value for codes from newer app versions. */
export function label<K extends string>(labels: Record<K, () => string>, code: unknown): string {
  return typeof code === 'string' && code in labels ? labels[code as K]() : String(code ?? '');
}

export const ERROR_LABELS = {
  required: m.error_required,
  negative: m.error_negative,
  range: m.error_range,
  percentage: m.error_percentage,
} as const;
