import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { BackupError, readBackup, writeBackup, type BackupRecord } from './backup';

const record = (i: number, extra: Record<string, unknown> = {}): BackupRecord => ({
  name: `r${i}`,
  config: { uuid: `uuid-${i}`, unix_timestamp: 1_700_000_000 + i },
  ...extra,
});
const many = (n: number) => Array.from({ length: n }, (_, i) => record(i));

describe('writeBackup', () => {
  it('chunks like the app: first chunk in the main file, the rest in numbered files', () => {
    const files = unzipSync(writeBackup({ BREWS: many(1234), BEANS: many(3), VERSION: [{ x: 1 }] }));
    expect(Object.keys(files).sort()).toEqual([
      'Beanconqueror.json',
      'Beanconqueror_Brews_1.json',
      'Beanconqueror_Brews_2.json',
    ]);
    const main = JSON.parse(strFromU8(files['Beanconqueror.json']!));
    expect(main.BREWS).toHaveLength(500);
    expect(main.BEANS).toHaveLength(3);
    expect(JSON.parse(strFromU8(files['Beanconqueror_Brews_2.json']!))).toHaveLength(234);
  });

  it('keeps key order and unknown keys', () => {
    const data = {
      VERSION: [{ a: 1 }],
      FUTURE_THING: { deep: [1, 2] },
      BEANS: [record(1, { newField: 'x' })],
    };
    const main = strFromU8(unzipSync(writeBackup(data))['Beanconqueror.json']!);
    expect(main).toBe(JSON.stringify(data));
  });

  it('does not mutate its input', () => {
    const data = { BREWS: many(600) };
    writeBackup(data);
    expect(data.BREWS).toHaveLength(600);
  });
});

describe('readBackup', () => {
  it('round-trips a chunked backup', () => {
    const data = {
      BEANS: many(1001),
      BREWS: many(501),
      BARISTAMODE_BREWS: many(251),
      SETTINGS: [{ language: 'en' }],
    };
    expect(readBackup(writeBackup(data))).toEqual(data);
  });

  it('merges chunks in index order and stops at the first gap', () => {
    const bytes = zipSync({
      'Beanconqueror.json': strToU8(JSON.stringify({ BREWS: [record(0)] })),
      'Beanconqueror_Brews_1.json': strToU8(JSON.stringify([record(1)])),
      'Beanconqueror_Brews_3.json': strToU8(JSON.stringify([record(3)])),
    });
    expect(readBackup(bytes).BREWS?.map((b) => b.config.uuid)).toEqual(['uuid-0', 'uuid-1']);
  });

  it.each([
    ['not a zip', strToU8('hello'), /Not a zip/],
    ['no main file', zipSync({ 'x.json': strToU8('{}') }), /no Beanconqueror.json/],
    ['broken JSON', zipSync({ 'Beanconqueror.json': strToU8('{') }), /not valid JSON/],
    ['main is a list', zipSync({ 'Beanconqueror.json': strToU8('[]') }), /not an object/],
    [
      'record without uuid',
      zipSync({
        'Beanconqueror.json': strToU8(JSON.stringify({ BEANS: [{ config: { unix_timestamp: 1 } }] })),
      }),
      /BEANS\.0\.config\.uuid/,
    ],
    [
      'orphan chunk',
      zipSync({
        'Beanconqueror.json': strToU8('{}'),
        'Beanconqueror_Beans_1.json': strToU8('[]'),
      }),
      /BEANS is missing/,
    ],
  ])('rejects %s', (_, bytes, message) => {
    expect(() => readBackup(bytes)).toThrow(BackupError);
    expect(() => readBackup(bytes)).toThrow(message);
  });

  it('tells files that are not backups apart from damaged backups', () => {
    const notBackup = (bytes: Uint8Array) => {
      try {
        readBackup(bytes);
      } catch (error) {
        return error instanceof BackupError && error.notBackup;
      }
      return undefined;
    };
    expect(notBackup(strToU8('hello'))).toBe(true);
    expect(notBackup(zipSync({ 'x.json': strToU8('{}') }))).toBe(true);
    expect(notBackup(zipSync({ 'Beanconqueror.json': strToU8('{') }))).toBe(false);
  });
});
