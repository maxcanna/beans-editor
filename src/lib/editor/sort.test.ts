import { describe, expect, it } from 'vitest';
import type { BackupRecord } from '../formats/backup/backup';
import { sortBeans } from './beans';
import { sortBrews } from './brews';
import { nextSort, sortRecords } from './sort';

const config = (uuid: string, unix_timestamp = 1_700_000_000) => ({ uuid, unix_timestamp });
const ids = (list: BackupRecord[]) => list.map((r) => r.config.uuid);

describe('nextSort', () => {
  it('goes ascending, then descending, then back to the default order', () => {
    const asc = nextSort(null, 'name');
    expect(asc).toEqual({ key: 'name', direction: 'asc' });
    const desc = nextSort(asc, 'name');
    expect(desc).toEqual({ key: 'name', direction: 'desc' });
    expect(nextSort(desc, 'name')).toBeNull();
    expect(nextSort(desc, 'roaster')).toEqual({ key: 'roaster', direction: 'asc' });
  });
});

describe('sortRecords', () => {
  const value = (item: { v: string | number | null }) => item.v;
  const items = [{ v: 'b10' }, { v: null }, { v: 'B2' }, { v: 'a' }];

  it('keeps the given order without a sort', () => {
    expect(sortRecords(items, null, value)).toEqual(items);
  });

  it('compares text naturally and ignoring case, and numbers as numbers', () => {
    expect(sortRecords(items, { key: 'v', direction: 'asc' }, value).map(value)).toEqual([
      'a',
      'B2',
      'b10',
      null,
    ]);
    expect(
      sortRecords([{ v: 10 }, { v: 9 }, { v: 100 }], { key: 'v', direction: 'asc' }, value).map(value),
    ).toEqual([9, 10, 100]);
  });

  it('puts items with no value last in either direction and keeps equal items in order', () => {
    expect(sortRecords(items, { key: 'v', direction: 'desc' }, value).map(value)).toEqual([
      'b10',
      'B2',
      'a',
      null,
    ]);
    const same = [
      { v: 1, id: 'x' },
      { v: 1, id: 'y' },
    ];
    expect(sortRecords(same, { key: 'v', direction: 'desc' }, value).map((i) => i.id)).toEqual(['x', 'y']);
  });
});

describe('sortBeans', () => {
  const beans: BackupRecord[] = [
    {
      name: 'Zed',
      roaster: 'North',
      weight: 250,
      bean_roasting_type: 'ESPRESSO',
      rating: 0,
      config: config('z'),
    },
    {
      name: 'alpha',
      roaster: '',
      weight: 0,
      bean_roasting_type: 'FILTER',
      rating: 4,
      roastingDate: '2025-05-01T10:00:00.000Z',
      config: config('a'),
    },
    {
      name: 'Mid',
      roaster: 'South',
      weight: 1000,
      bean_roasting_type: 'UNKNOWN',
      rating: 5,
      roastingDate: '2025-04-01T10:00:00.000Z',
      buyDate: '2025-03-01T10:00:00.000Z',
      config: config('m'),
    },
  ];

  it('sorts by name, date, weight and rating, leaving empty values last', () => {
    expect(ids(sortBeans(beans, { key: 'name', direction: 'asc' }))).toEqual(['a', 'm', 'z']);
    expect(ids(sortBeans(beans, { key: 'roaster', direction: 'desc' }))).toEqual(['m', 'z', 'a']);
    expect(ids(sortBeans(beans, { key: 'roastingDate', direction: 'asc' }))).toEqual(['m', 'a', 'z']);
    expect(ids(sortBeans(beans, { key: 'buyDate', direction: 'desc' }))).toEqual(['m', 'z', 'a']);
    expect(ids(sortBeans(beans, { key: 'weight', direction: 'desc' }))).toEqual(['m', 'z', 'a']);
    expect(ids(sortBeans(beans, { key: 'rating', direction: 'desc' }))).toEqual(['m', 'a', 'z']);
  });

  it('sorts roast types in the app order, not by name, with unknown last', () => {
    expect(ids(sortBeans(beans, { key: 'bean_roasting_type', direction: 'asc' }))).toEqual(['a', 'z', 'm']);
  });
});

describe('sortBrews', () => {
  const names = new Map([
    ['b1', 'Finca'],
    ['b2', 'Alto'],
    ['m1', 'Comandante'],
  ]);
  const brews: BackupRecord[] = [
    { bean: 'b1', mill: 'm1', grind_weight: 15, brew_quantity: 250, rating: 3, config: config('r1', 100) },
    { bean: 'b2', mill: '', grind_weight: 18, brew_quantity: 0, rating: 0, config: config('r2', 300) },
    { bean: 'gone', mill: 'm1', config: config('r3', 200) },
  ];

  it('sorts by the columns of the table', () => {
    expect(ids(sortBrews(brews, names, { key: 'when', direction: 'desc' }))).toEqual(['r2', 'r3', 'r1']);
    expect(ids(sortBrews(brews, names, { key: 'bean', direction: 'asc' }))).toEqual(['r2', 'r1', 'r3']);
    expect(ids(sortBrews(brews, names, { key: 'mill', direction: 'asc' }))).toEqual(['r1', 'r3', 'r2']);
    expect(ids(sortBrews(brews, names, { key: 'dose', direction: 'desc' }))).toEqual(['r2', 'r1', 'r3']);
    expect(ids(sortBrews(brews, names, { key: 'water', direction: 'asc' }))).toEqual(['r1', 'r2', 'r3']);
    expect(ids(sortBrews(brews, names, { key: 'rating', direction: 'desc' }))).toEqual(['r1', 'r2', 'r3']);
  });
});
