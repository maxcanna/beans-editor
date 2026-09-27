import { BLENDS, FREEZING_STORAGE, ROASTING_TYPES, ROASTS } from './enums';
import type { BeanRow, Origin } from './model';

export type ColumnType =
  | { kind: 'text' }
  | { kind: 'number' }
  | { kind: 'date' }
  | { kind: 'bool' }
  | { kind: 'enum'; values: Readonly<Record<string, string>> };

type BeanKey = Exclude<keyof BeanRow, 'origins'>;

export interface Column {
  header: string;
  key: BeanKey;
  type: ColumnType;
}

export interface OriginColumn {
  /** Header without the "n. " prefix. */
  header: string;
  key: keyof Origin;
  type: ColumnType;
}

const text = { kind: 'text' } as const;
const number = { kind: 'number' } as const;
const date = { kind: 'date' } as const;
const bool = { kind: 'bool' } as const;

// Headers are the importer's keys (uiExcel.importBeansByExcel / importGreenBeansByExcel).
export const ROASTED_COLUMNS: readonly Column[] = [
  { header: 'Name', key: 'name', type: text },
  { header: 'Roaster', key: 'roaster', type: text },
  { header: 'Roast date', key: 'roastDate', type: date },
  { header: 'Roast type', key: 'roastType', type: { kind: 'enum', values: ROASTING_TYPES } },
  { header: 'Degree of Roast', key: 'degreeOfRoast', type: { kind: 'enum', values: ROASTS } },
  { header: 'Custom degree of Roast', key: 'customDegreeOfRoast', type: text },
  { header: 'Blend', key: 'blend', type: { kind: 'enum', values: BLENDS } },
  { header: 'Weight', key: 'weight', type: number },
  { header: 'Cost', key: 'cost', type: number },
  { header: 'Flavour profile', key: 'flavourProfile', type: text },
  { header: 'Cupping points', key: 'cuppingPoints', type: text },
  { header: 'Decaffeinated', key: 'decaffeinated', type: bool },
  { header: 'Website', key: 'website', type: text },
  { header: 'EAN / Articlenumber', key: 'ean', type: text },
  { header: 'Notes', key: 'notes', type: text },
  { header: 'Rating', key: 'rating', type: number },
  { header: 'Archived', key: 'archived', type: bool },
  { header: 'Frozen Date', key: 'frozenDate', type: date },
  { header: 'Unfrozen Date', key: 'unfrozenDate', type: date },
  {
    header: 'Freezing Storage Type',
    key: 'freezingStorageType',
    type: { kind: 'enum', values: FREEZING_STORAGE },
  },
  { header: 'Frozen Note', key: 'frozenNote', type: text },
];

export const GREEN_COLUMNS: readonly Column[] = [
  { header: 'Name', key: 'name', type: text },
  { header: 'Buy Date', key: 'buyDate', type: date },
  { header: 'Weight', key: 'weight', type: number },
  { header: 'Cost', key: 'cost', type: number },
  { header: 'Flavour profile', key: 'flavourProfile', type: text },
  { header: 'Cupping points', key: 'cuppingPoints', type: text },
  { header: 'Decaffeinated', key: 'decaffeinated', type: bool },
  { header: 'Website', key: 'website', type: text },
  { header: 'EAN / Articlenumber', key: 'ean', type: text },
  { header: 'Notes', key: 'notes', type: text },
  { header: 'Rating', key: 'rating', type: number },
  { header: 'Archived', key: 'archived', type: bool },
];

export const ORIGIN_COLUMNS: readonly OriginColumn[] = [
  { header: 'Country', key: 'country', type: text },
  { header: 'Region', key: 'region', type: text },
  { header: 'Farm', key: 'farm', type: text },
  { header: 'Farmer', key: 'farmer', type: text },
  { header: 'Elevation', key: 'elevation', type: text },
  { header: 'Variety', key: 'variety', type: text },
  { header: 'Processing', key: 'processing', type: text },
  { header: 'Harvested', key: 'harvested', type: text },
  { header: 'Percentage', key: 'percentage', type: number },
  { header: 'Bean certification', key: 'certification', type: text },
  { header: 'Fob Price', key: 'fobPrice', type: number },
  { header: 'Purchasing Price', key: 'purchasingPrice', type: number },
];

export const originHeader = (n: number, column: OriginColumn) => `${n}. ${column.header}`;
