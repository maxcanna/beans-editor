import { describe, expect, it } from 'vitest';
import type { BackupData, BackupRecord } from '../formats/backup/backup';
import {
  applyBeanForm,
  beanForm,
  beanFormFromShared,
  emptyOrigin,
  filterBeans,
  sharedFromBeanForm,
  isoFromLocalDay,
  localDay,
  newBean,
  validateBean,
} from './beans';
import { clearDraft, DRAFT_VERSION, loadDraft, saveDraft, type DraftStore } from './draft';
import { addRecord, brewsUsing, deleteRecord, findRecord, replaceRecord, setArchived } from './records';

const config = (uuid: string) => ({ uuid, unix_timestamp: 1_700_000_000 });
const bean = (uuid: string, extra: Record<string, unknown> = {}): BackupRecord => ({
  name: `Bean ${uuid}`,
  config: config(uuid),
  ...extra,
});

const backup = (): BackupData => ({
  BEANS: [bean('b1'), bean('b2')],
  MILL: [{ name: 'Grinder', config: config('m1') }],
  PREPARATION: [{ name: 'V60', config: config('p1') }],
  BREWS: [{ bean: 'b1', mill: 'm1', method_of_preparation: 'p1', config: config('r1') }],
  BARISTAMODE_BREWS: [{ bean: 'b1', config: config('r2') }],
  SETTINGS: [{ bean_rating: 5 }],
});

describe('records', () => {
  it('counts the brews that use a record, barista brews included', () => {
    const data = backup();
    expect(brewsUsing(data, 'BEANS', 'b1')).toBe(2);
    expect(brewsUsing(data, 'MILL', 'm1')).toBe(1);
    expect(brewsUsing(data, 'PREPARATION', 'p1')).toBe(1);
    expect(brewsUsing(data, 'BEANS', 'b2')).toBe(0);
  });

  it('blocks deleting a record that brews use, and deletes the others', () => {
    const data = backup();
    expect(deleteRecord(data, 'BEANS', 'b1')).toEqual({ ok: false, brews: 2 });
    const result = deleteRecord(data, 'BEANS', 'b2');
    expect(result.ok && result.data.BEANS?.map((b) => b.config.uuid)).toEqual(['b1']);
    expect(data.BEANS).toHaveLength(2);
  });

  it('adds, replaces and archives without touching the input', () => {
    const data = backup();
    const added = addRecord(data, 'BEANS', bean('b3'));
    expect(added.BEANS).toHaveLength(3);
    const replaced = replaceRecord(added, 'BEANS', bean('b3', { name: 'Renamed' }));
    expect(findRecord(replaced, 'BEANS', 'b3')?.['name']).toBe('Renamed');
    const archived = setArchived(replaced, 'BEANS', 'b1', true);
    expect(findRecord(archived, 'BEANS', 'b1')?.['finished']).toBe(true);
    expect(data.BEANS).toHaveLength(2);
    expect(findRecord(data, 'BEANS', 'b1')?.['finished']).toBeUndefined();
    expect(archived.SETTINGS).toBe(data.SETTINGS);
  });
});

describe('beans', () => {
  it('converts between stored timestamps and local days', () => {
    const iso = isoFromLocalDay('2025-04-30');
    expect(localDay(iso)).toBe('2025-04-30');
    expect(localDay('')).toBe('');
    expect(localDay('not a date')).toBe('');
    expect(isoFromLocalDay('')).toBe('');
  });

  it('writes an unchanged bean back exactly as it was', () => {
    const stored = bean('b1', {
      roastingDate: '2025-04-29T22:00:00.000Z',
      roast: 'CITY_ROAST',
      weight: 250,
      bean_information: [{ country: 'Kenya', percentage: 100, extra: 'kept' }],
      unknownFutureField: { a: 1 },
    });
    const out = applyBeanForm(stored, beanForm(stored));
    expect(JSON.stringify(out)).toBe(JSON.stringify(stored));
  });

  it('writes only changed fields and keeps extra keys on origins', () => {
    const stored = bean('b1', {
      weight: 250,
      bean_information: [{ country: 'Kenya', percentage: 100, extra: 'kept' }],
      unknownFutureField: true,
    });
    const form = beanForm(stored);
    form.roaster = 'Sample Roasters';
    form.weight = null;
    form.roastingDate = '2025-05-01';
    form.bean_information[0]!.region = 'Nyeri';
    form.bean_information.push({ ...emptyOrigin(), country: 'Peru', percentage: null });
    const out = applyBeanForm(stored, form) as Record<string, unknown>;
    expect(out).toMatchObject({
      roaster: 'Sample Roasters',
      weight: 0,
      roastingDate: isoFromLocalDay('2025-05-01'),
      unknownFutureField: true,
      bean_information: [
        { country: 'Kenya', region: 'Nyeri', percentage: 100, extra: 'kept' },
        { country: 'Peru', percentage: 0, purchasing_price: 0, fob_price: 0 },
      ],
    });
  });

  it('creates beans like the app does', () => {
    const created = newBean(1_700_000_000_500);
    expect(created.config.unix_timestamp).toBe(1_700_000_000);
    expect(created.config.uuid).toMatch(/^[0-9a-f-]{36}$/);
    expect(beanForm(created)).toMatchObject({ name: '', beanMix: 'SINGLE_ORIGIN', weight: 0 });
  });

  it('turns a bean read from a product page into a new backup bean', () => {
    const form = beanFormFromShared({
      name: 'Colombia Motta',
      roaster: 'Guido',
      weight: 250,
      cost: 18.5,
      bean_roasting_type: 'FILTER',
      external_images: ['https://roaster.example/bag.jpg'],
      bean_information: [{ country: 'Colombia', processing: 'Washed' }],
    });
    const bean = applyBeanForm(newBean(1_700_000_000_500), form);
    expect(bean.config.unix_timestamp).toBe(1_700_000_000);
    expect(bean).toMatchObject({
      name: 'Colombia Motta',
      roaster: 'Guido',
      weight: 250,
      cost: 18.5,
      bean_roasting_type: 'FILTER',
      beanMix: 'SINGLE_ORIGIN',
      note: '',
      attachments: [],
    });
    expect(bean).not.toHaveProperty('external_images');
    expect(bean['bean_information']).toEqual([
      {
        ...emptyOrigin(),
        country: 'Colombia',
        processing: 'Washed',
        percentage: 0,
        purchasing_price: 0,
        fob_price: 0,
      },
    ]);
  });

  it('keeps dates and freezing details on a bean added to a backup', () => {
    const dates = {
      buyDate: '2026-09-20T00:00:00.000Z',
      roastingDate: '2026-09-15T00:00:00.000Z',
      bestDate: '2027-03-15T00:00:00.000Z',
      frozenDate: '2026-09-25T00:00:00.000Z',
      frozenStorageType: 'COFFEE_BAG',
      frozenNote: 'Top shelf',
    } as const;
    const add = (shared: Parameters<typeof beanFormFromShared>[0]) =>
      applyBeanForm(newBean(), beanFormFromShared(shared));
    const bean = add({ name: 'Frozen', ...dates });
    expect(bean).toMatchObject({
      ...dates,
      buyDate: isoFromLocalDay(localDay(dates.buyDate)),
      roastingDate: isoFromLocalDay(localDay(dates.roastingDate)),
      bestDate: isoFromLocalDay(localDay(dates.bestDate)),
      frozenDate: isoFromLocalDay(localDay(dates.frozenDate)),
      unfrozenDate: '',
    });
    expect(bean['frozenId']).toMatch(/^[0-9a-j]{6}$/);
    expect(add({ name: 'Fresh' })['frozenId']).toBe('');
  });

  it('edits the buy date, best before date and freezing details', () => {
    const stored = bean('b1', { buyDate: '2025-03-01T00:00:00.000Z', bestDate: '' });
    const form = beanForm(stored);
    expect(form.buyDate).toBe(localDay('2025-03-01T00:00:00.000Z'));
    form.buyDate = '2025-04-02';
    form.bestDate = '2026-01-31';
    form.frozenDate = '2025-05-01';
    form.frozenNote = 'Back shelf';
    const out = applyBeanForm(stored, form) as Record<string, unknown>;
    expect(out).toMatchObject({
      buyDate: isoFromLocalDay('2025-04-02'),
      bestDate: isoFromLocalDay('2026-01-31'),
      frozenDate: isoFromLocalDay('2025-05-01'),
      frozenNote: 'Back shelf',
    });
    expect(out['frozenId']).toMatch(/^[0-9a-j]{6}$/);
    form.buyDate = '';
    expect(applyBeanForm(stored, form)['buyDate' as never]).toBe('');
  });

  it('sends only what a link to Beanconqueror can carry', () => {
    const form = beanFormFromShared({
      name: ' Motta ',
      weight: 250,
      bean_information: [{ country: 'Colombia' }],
    });
    form.buyDate = '2026-09-20';
    form.bestDate = '2027-03-15';
    form.frozenDate = '2026-09-25';
    form.rating = 4;
    form.bean_information.push(emptyOrigin());
    expect(sharedFromBeanForm(form)).toEqual({
      name: 'Motta',
      beanMix: 'SINGLE_ORIGIN',
      weight: 250,
      bean_information: [{ country: 'Colombia' }],
    });
  });

  it('validates the form', () => {
    const form = beanForm(newBean());
    expect(validateBean(form)).toEqual({ name: 'required' });
    form.name = 'Ok';
    form.rating = 7;
    form.weight = -1;
    form.bean_information = [
      { ...emptyOrigin(), percentage: 60 },
      { ...emptyOrigin(), percentage: 60 },
    ];
    expect(validateBean(form)).toEqual({
      rating: 'range',
      weight: 'negative',
      bean_information: 'percentage',
    });
    expect(validateBean(form, 10).rating).toBeUndefined();
  });
});

describe('draft', () => {
  const memory = (): DraftStore & { map: Map<string, unknown> } => {
    const map = new Map<string, unknown>();
    return {
      map,
      get: async (k) => structuredClone(map.get(k)),
      set: async (k, value) => void map.set(k, structuredClone(value)),
      del: async (k) => void map.delete(k),
    };
  };

  it('saves, loads and clears the open backup', async () => {
    const store = memory();
    expect(await loadDraft(store)).toEqual({ status: 'none' });
    await saveDraft(store, { fileName: 'b.zip', savedAt: 1, dirty: true, data: backup() });
    expect(await loadDraft(store)).toEqual({
      status: 'ok',
      draft: { version: DRAFT_VERSION, fileName: 'b.zip', savedAt: 1, dirty: true, data: backup() },
    });
    await clearDraft(store);
    expect(await loadDraft(store)).toEqual({ status: 'none' });
  });

  it('hands back invalid drafts instead of dropping them', async () => {
    const store = memory();
    const broken = {
      version: DRAFT_VERSION,
      fileName: 'b.zip',
      savedAt: 1,
      dirty: true,
      data: { BEANS: [{}] },
    };
    store.map.set('draft', broken);
    expect(await loadDraft(store)).toEqual({ status: 'invalid', raw: broken });
    store.map.set('draft', { version: 99 });
    expect((await loadDraft(store)).status).toBe('invalid');
  });
});

describe('filterBeans', () => {
  const beans = [
    bean('old', { roaster: 'North', config: { uuid: 'old', unix_timestamp: 1 } }),
    bean('new', {
      roaster: 'South',
      config: { uuid: 'new', unix_timestamp: 2 },
      bean_information: [{ country: 'Kenya' }],
    }),
    bean('gone', { finished: true, config: { uuid: 'gone', unix_timestamp: 3 } }),
  ];
  const ids = (list: BackupRecord[]) => list.map((b) => b.config.uuid);

  it('hides archived beans unless asked and sorts newest first', () => {
    expect(ids(filterBeans(beans, { query: '', showArchived: false }))).toEqual(['new', 'old']);
    expect(ids(filterBeans(beans, { query: '', showArchived: true }))).toEqual(['gone', 'new', 'old']);
  });

  it('limits beans to a buy date range, inclusive, leaving out beans without one', () => {
    const dated = [
      bean('mar', { buyDate: isoFromLocalDay('2025-03-10'), config: { uuid: 'mar', unix_timestamp: 1 } }),
      bean('apr', { buyDate: isoFromLocalDay('2025-04-10'), config: { uuid: 'apr', unix_timestamp: 2 } }),
      bean('none', { config: { uuid: 'none', unix_timestamp: 3 } }),
    ];
    const between = (from: string, to: string) =>
      ids(filterBeans(dated, { query: '', showArchived: false, from, to }));
    expect(between('', '')).toEqual(['none', 'apr', 'mar']);
    expect(between('2025-03-10', '2025-04-10')).toEqual(['apr', 'mar']);
    expect(between('2025-03-11', '')).toEqual(['apr']);
    expect(between('', '2025-03-31')).toEqual(['mar']);
    expect(between('2025-05-01', '')).toEqual([]);
  });

  it('matches every word across name, roaster and origins', () => {
    expect(ids(filterBeans(beans, { query: 'south kenya', showArchived: false }))).toEqual(['new']);
    expect(ids(filterBeans(beans, { query: 'north kenya', showArchived: false }))).toEqual([]);
  });
});

describe('EditorSession', () => {
  it('stores every change right away and reports storage failures', async () => {
    const { EditorSession } = await import('./session.svelte');
    const written: unknown[] = [];
    let fail = false;
    const store: DraftStore = {
      get: async () => undefined,
      set: async (_k, value) => {
        if (fail) throw new Error('quota');
        written.push(structuredClone(value));
      },
      del: async () => undefined,
    };
    const session = new EditorSession(store);
    session.open('b.zip', backup());
    session.update((d) => setArchived(d, 'BEANS', 'b2', true));
    await session.flush();
    expect(written).toHaveLength(3);
    expect(written[1]).toMatchObject({ dirty: true, data: { BEANS: [{}, { finished: true }] } });
    expect(session.storageFailed).toBe(false);

    fail = true;
    session.update((d) => setArchived(d, 'BEANS', 'b2', false));
    await session.flush();
    expect(session.storageFailed).toBe(true);
  });
});
