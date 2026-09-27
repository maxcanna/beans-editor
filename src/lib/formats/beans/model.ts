import type { Blend, FreezingStorage, Roast, RoastingType } from './enums';

/** One origin ("1. Country" … "4. Purchasing Price"); the importer reads up to four. */
export interface Origin {
  country?: string;
  region?: string;
  farm?: string;
  farmer?: string;
  elevation?: string;
  variety?: string;
  processing?: string;
  harvested?: string;
  percentage?: number;
  certification?: string;
  fobPrice?: number;
  purchasingPrice?: number;
}

export const MAX_ORIGINS = 4;

/** A bean as the import templates describe it. Dates are ISO `YYYY-MM-DD`. */
export interface BeanRow {
  name: string;
  roaster?: string;
  roastDate?: string;
  roastType?: RoastingType;
  degreeOfRoast?: Roast;
  customDegreeOfRoast?: string;
  blend?: Blend;
  /** Green beans only. */
  buyDate?: string;
  weight?: number;
  cost?: number;
  flavourProfile?: string;
  cuppingPoints?: string;
  decaffeinated?: boolean;
  website?: string;
  ean?: string;
  notes?: string;
  rating?: number;
  archived?: boolean;
  frozenDate?: string;
  unfrozenDate?: string;
  freezingStorageType?: FreezingStorage;
  frozenNote?: string;
  origins: Origin[];
}

export type Severity = 'error' | 'warning';

/** A problem found while reading a file; `row` is the 1-based spreadsheet row. */
export interface Issue {
  severity: Severity;
  row?: number;
  column?: string;
  message: string;
}
