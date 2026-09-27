import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readWorkbook } from '../xlsx/read';
import { fillSheet } from '../xlsx/write';
import { toCode, ROASTS } from './enums';
import type { BeanRow } from './model';
import { readBeanTemplate, writeBeanTemplate } from './template';

const template = (name: string) => new Uint8Array(readFileSync(`src/assets/templates/${name}.xlsx`));

const roastedBean: BeanRow = {
  name: 'Finca Example',
  roaster: 'Sample Roasters',
  roastDate: '2025-04-30',
  roastType: 'ESPRESSO',
  degreeOfRoast: 'CUSTOM_ROAST',
  customDegreeOfRoast: 'Nordic light',
  blend: 'BLEND',
  weight: 250,
  cost: 14.5,
  flavourProfile: 'Cherry, cocoa',
  cuppingPoints: '86',
  decaffeinated: false,
  website: 'https://example.com/finca',
  ean: '4000000000001',
  notes: 'Line one\nline two & <more>',
  rating: 4,
  archived: true,
  frozenDate: '2025-05-02',
  unfrozenDate: '2025-06-01',
  freezingStorageType: 'VACUUM_SEALED',
  frozenNote: 'Bottom drawer',
  origins: [
    { country: 'Colombia', region: 'Huila', percentage: 60, fobPrice: 4.2 },
    { country: 'Ethiopia', variety: 'Heirloom', percentage: 30 },
    { country: 'Kenya', processing: 'Washed', percentage: 5 },
    { country: 'Brazil', farm: 'Fazenda Test', percentage: 5, purchasingPrice: 7 },
  ],
};

const greenBean: BeanRow = {
  name: 'Green lot 7',
  buyDate: '2024-12-31',
  weight: 1000,
  cost: 22,
  decaffeinated: true,
  rating: 3.5,
  origins: [{ country: 'Peru', elevation: '1800 masl', harvested: '2024' }],
};

describe('bean templates', () => {
  it('reads the empty bundled templates without beans or errors', () => {
    for (const kind of ['roasted', 'green'] as const) {
      const content = readBeanTemplate(template(`${kind}-beans`), kind);
      expect(content.beans).toEqual([]);
      expect(content.issues.filter((i) => i.severity === 'error')).toEqual([]);
    }
  });

  it('round-trips a roasted bean with four origins', () => {
    const bytes = writeBeanTemplate(template('roasted-beans'), 'roasted', [
      roastedBean,
      { name: 'Minimal', origins: [] },
    ]);
    const content = readBeanTemplate(bytes, 'roasted');
    expect(content.issues).toEqual([]);
    expect(content.beans).toEqual([roastedBean, { name: 'Minimal', origins: [] }]);

    const header = readWorkbook(bytes).sheet('Beans')?.[0] ?? [];
    expect(header.at(-1)).toEqual({ t: 's', v: '4. Purchasing Price' });
    expect(header).toHaveLength(21 + 4 * 12);
  });

  it('round-trips a green bean and keeps the other sheets', () => {
    const bytes = writeBeanTemplate(template('green-beans'), 'green', [greenBean]);
    expect(readBeanTemplate(bytes, 'green').beans).toEqual([greenBean]);
    const wb = readWorkbook(bytes);
    expect(wb.sheetNames).toEqual(['Readme_and_Consistency_Check', 'Green Beans', 'Bean_Information']);
    // Only one origin: no extra columns.
    expect(wb.sheet('Green Beans')?.[0]).toHaveLength(12 + 12);
  });

  it('writes what the importer expects: serial dates, real booleans, raw codes', () => {
    const rows = readWorkbook(writeBeanTemplate(template('roasted-beans'), 'roasted', [roastedBean])).sheet(
      'Beans',
    );
    const row = rows?.[1] ?? [];
    expect(row[2]).toEqual({ t: 'd', v: 45777 }); // Roast date, in the template's date style
    expect(row[3]).toEqual({ t: 's', v: 'ESPRESSO' });
    expect(row[4]).toEqual({ t: 's', v: 'CUSTOM_ROAST' });
    expect(row[11]).toEqual({ t: 'b', v: false });
    expect(row[16]).toEqual({ t: 'b', v: true });
  });

  it('reports invalid values and skips nameless rows', () => {
    const bytes = fillSheet(
      template('roasted-beans'),
      [
        [
          'Bad bean',
          null,
          'yesterday',
          'Espresso',
          'UNKOWN',
          null,
          'Mixed',
          'heavy',
          null,
          null,
          null,
          'maybe',
        ],
        [null, 'Roaster only'],
      ],
      { sheet: 'Beans' },
    );
    const content = readBeanTemplate(bytes, 'roasted');
    expect(content.beans).toEqual([
      { name: 'Bad bean', roastType: 'ESPRESSO', degreeOfRoast: 'UNKNOWN', origins: [] },
    ]);
    expect(content.issues.map((i) => [i.severity, i.row, i.column])).toEqual([
      ['error', 2, 'Roast date'],
      ['error', 2, 'Blend'],
      ['error', 2, 'Weight'],
      ['error', 2, 'Decaffeinated'],
      ['warning', 3, undefined],
    ]);
  });

  it('throws when the sheet is missing', () => {
    expect(() => readBeanTemplate(template('green-beans'), 'roasted')).toThrow(/"Beans" sheet/);
  });
});

describe('enums', () => {
  it('accepts codes, labels and the template typo', () => {
    expect(toCode(ROASTS, 'CITY_PLUS_ROAST')).toBe('CITY_PLUS_ROAST');
    expect(toCode(ROASTS, 'city+ roast')).toBe('CITY_PLUS_ROAST');
    expect(toCode(ROASTS, 'UNKOWN')).toBe('UNKNOWN');
    expect(toCode(ROASTS, 'Burnt')).toBeUndefined();
  });
});
