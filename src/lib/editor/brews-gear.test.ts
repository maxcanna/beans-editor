import { describe, expect, it } from 'vitest';
import type { BackupData, BackupRecord } from '../formats/backup/backup';
import {
  applyBrewForm,
  beanStates,
  brewForm,
  emptyBrewFilter,
  filterBrews,
  localDateTime,
  nameIndex,
  unixFromLocalDateTime,
  validateBrew,
} from './brews';
import { applyGearForm, filterGear, gearForm } from './gear';

const config = (uuid: string, unix_timestamp = 1_700_000_000) => ({ uuid, unix_timestamp });

const data: BackupData = {
  BEANS: [{ name: 'Finca', config: config('b1') }],
  MILL: [{ name: 'Comandante', config: config('m1') }],
  PREPARATION: [{ name: 'V60', config: config('p1') }],
  BREWS: [
    {
      bean: 'b1',
      mill: 'm1',
      method_of_preparation: 'p1',
      note: 'sweet',
      config: config('r1', 1_700_000_000),
    },
    { bean: 'b1', mill: '', method_of_preparation: 'p1', note: 'sour', config: config('r2', 1_700_100_000) },
    { bean: 'other', mill: 'm1', method_of_preparation: '', config: config('r3', 1_700_200_000) },
  ],
};

describe('brews', () => {
  it('writes an unchanged brew back exactly as it was, seconds included', () => {
    const brew: BackupRecord = {
      grind_size: '18',
      grind_weight: 15,
      rating: 4,
      flow_profile: 'FLOW_PROFILE/x.json',
      config: config('r9', 1_700_000_042),
    };
    expect(JSON.stringify(applyBrewForm(brew, brewForm(brew)))).toBe(JSON.stringify(brew));
  });

  it('writes changed fields and the new time', () => {
    const brew: BackupRecord = { grind_weight: 15, note: '', config: config('r9', 1_700_000_042) };
    const form = brewForm(brew);
    form.grind_weight = 16.5;
    form.note = 'better';
    form.brew_time = null;
    form.when = '2025-04-30T08:15';
    const out = applyBrewForm(brew, form) as Record<string, unknown>;
    expect(out).toMatchObject({ grind_weight: 16.5, note: 'better' });
    expect(out).not.toHaveProperty('brew_time');
    expect(out['config']).toEqual({ uuid: 'r9', unix_timestamp: unixFromLocalDateTime('2025-04-30T08:15') });
    expect(localDateTime(unixFromLocalDateTime('2025-04-30T08:15')!)).toBe('2025-04-30T08:15');
  });

  it('validates the form', () => {
    const form = brewForm({ config: config('x') });
    expect(validateBrew(form)).toEqual({});
    form.when = '';
    form.grind_weight = -1;
    form.rating = 6;
    expect(validateBrew(form)).toEqual({ when: 'required', grind_weight: 'negative', rating: 'range' });
    expect(validateBrew(form, 10).rating).toBeUndefined();
  });

  it('filters by record, text and date, newest first', () => {
    const brews = data.BREWS!;
    const names = nameIndex(data);
    const ids = (f: Partial<ReturnType<typeof emptyBrewFilter>>) =>
      filterBrews(brews, names, { ...emptyBrewFilter(), ...f }).map((b) => b.config.uuid);
    expect(ids({})).toEqual(['r3', 'r2', 'r1']);
    expect(ids({ bean: 'b1' })).toEqual(['r2', 'r1']);
    expect(ids({ mill: 'm1', method: 'p1' })).toEqual(['r1']);
    expect(ids({ query: 'finca sweet' })).toEqual(['r1']);
    expect(ids({ query: 'comandante' })).toEqual(['r3', 'r1']);
    const day = localDateTime(1_700_100_000).slice(0, 10);
    expect(ids({ from: day, to: day })).toEqual(['r2']);
  });

  it('hides brews of archived or frozen beans until asked, unless their bean is picked', () => {
    const withStates: BackupData = {
      ...data,
      BEANS: [
        { name: 'Old', finished: true, config: config('old') },
        { name: 'Ice', frozenDate: '2025-05-01T10:00:00.000Z', config: config('ice') },
        {
          name: 'Thawed',
          frozenDate: '2025-05-01T10:00:00.000Z',
          unfrozenDate: '2025-05-20T10:00:00.000Z',
          config: config('thawed'),
        },
        { name: 'Fresh', config: config('fresh') },
      ],
      BREWS: ['old', 'ice', 'thawed', 'fresh', 'gone'].map((bean, i) => ({
        bean,
        config: config(`br-${bean}`, 1_700_000_000 + i),
      })),
    };
    const states = beanStates(withStates);
    const ids = (f: Partial<ReturnType<typeof emptyBrewFilter>>) =>
      filterBrews(withStates.BREWS!, nameIndex(withStates), { ...emptyBrewFilter(), ...f }, states).map(
        (b) => b.config.uuid,
      );
    // A brew whose bean is missing stays visible.
    expect(ids({})).toEqual(['br-gone', 'br-fresh', 'br-thawed']);
    expect(ids({ showArchived: true })).toEqual(['br-gone', 'br-fresh', 'br-thawed', 'br-old']);
    expect(ids({ showFrozen: true })).toEqual(['br-gone', 'br-fresh', 'br-thawed', 'br-ice']);
    expect(ids({ bean: 'ice' })).toEqual(['br-ice']);
  });
});

describe('gear', () => {
  it('edits name, note and archived only when they change', () => {
    const mill: BackupRecord = { name: 'Old', config: config('m1'), has_timer: false };
    expect(applyGearForm(mill, gearForm(mill))).toEqual(mill);
    expect(applyGearForm(mill, { name: 'New', note: '', finished: true })).toEqual({
      ...mill,
      name: 'New',
      finished: true,
    });
  });

  it('sorts by name and hides archived unless asked', () => {
    const list = [
      { name: 'b', config: config('1') },
      { name: 'A', config: config('2') },
      { name: 'c', finished: true, config: config('3') },
    ];
    expect(filterGear(list, '', false).map((r) => r['name'])).toEqual(['A', 'b']);
    expect(filterGear(list, 'C', true).map((r) => r['name'])).toEqual(['c']);
  });
});
