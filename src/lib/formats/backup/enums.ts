/**
 * Beanconqueror bean enums (src/enums/beans/*.ts in graphefruit/Beanconqueror):
 * the keys are the codes the app stores in a backup, the values its English labels.
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

export type RoastingType = keyof typeof ROASTING_TYPES;
export type Roast = keyof typeof ROASTS;
export type Blend = keyof typeof BLENDS;

/** How a frozen bean is stored (src/enums/beans/beanFreezingStorage.ts). */
export const FREEZING_STORAGES = {
  UNKNOWN: 'Unknown',
  COFFEE_BAG: 'Coffee bag',
  COFFEE_JAR: 'Coffee jar',
  ZIP_LOCK: 'Zip lock',
  VACUUM_SEALED: 'Vacuum sealed',
  TUBE: 'Tube',
} as const;

export type FreezingStorage = keyof typeof FREEZING_STORAGES;
