import { readFileSync } from 'node:fs';
import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { columnLetters } from '../xlsx/cells';
import { encodeXml } from '../xlsx/xml';
import { detectDateOrder, ExcelExportError, parseExportDate, readExcelExport } from './excel-export';
import { readBeanTemplate, writeBeanTemplate } from './template';

type Value = string | number | boolean | null;

/** Builds a workbook the way SheetJS's aoa_to_sheet + write does for the app's export. */
function workbook(sheets: Record<string, Value[][]>): Uint8Array {
  const names = Object.keys(sheets);
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
    ),
    'xl/workbook.xml': strToU8(
      `<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names
        .map((n, i) => `<sheet name="${encodeXml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
        .join('')}</sheets></workbook>`,
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `<Relationships>${names
        .map(
          (_, i) => `<Relationship Id="rId${i + 1}" Type="worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
        )
        .join('')}</Relationships>`,
    ),
  };
  names.forEach((name, i) => {
    const rows = (sheets[name] ?? [])
      .map((row, r) => {
        const cells = row
          .map((v, c) => {
            const ref = `${columnLetters(c)}${r + 1}`;
            if (v === null) return '';
            if (typeof v === 'string') return `<c r="${ref}" t="str"><v>${encodeXml(v)}</v></c>`;
            if (typeof v === 'boolean') return `<c r="${ref}" t="b"><v>${v ? 1 : 0}</v></c>`;
            return `<c r="${ref}"><v>${v}</v></c>`;
          })
          .join('');
        return `<row r="${r + 1}">${cells}</row>`;
      })
      .join('');
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(
      `<worksheet><sheetData>${rows}</sheetData></worksheet>`,
    );
  });
  return zipSync(files);
}

// Italian headers and sheet names, as a phone set to Italian writes them.
const BEAN_HEADER = [
  'Nome',
  'Torrefattore',
  'Data di tostatura',
  'Tipo di tostatura',
  'Grado di tostatura',
  'Tipo di tostatura',
  'Grado personalizzato',
  'Miscela',
  'Peso',
  'Costo',
  'Aromi',
  'Punteggio',
  'Decaffeinato',
  'URL',
  'EAN',
  'Note',
  'Valutazione',
  'Data di creazione',
  'ID',
  'Archiviato',
  ...['1', '2'].flatMap((n) =>
    [
      'Paese',
      'Regione',
      'Fattoria',
      'Coltivatore',
      'Altitudine',
      'Varietà',
      'Lavorazione',
      'Raccolto',
      'Percentuale',
      'Certificazione',
    ].map((h) => `${n}. ${h}`),
  ),
];

const beanRow = (overrides: Partial<Record<number, Value>>, origins: Value[][] = []): Value[] => {
  const row: Value[] = [
    'Finca Example',
    'Sample Roasters',
    '30.04.2025',
    'Espresso',
    55,
    'City+ Roast',
    '-',
    'Single Origin',
    250,
    14.5,
    'Cherry, cocoa',
    '86',
    false,
    'https://example.com/finca',
    '4000000000001',
    'Fresh',
    4,
    '01.05.2025 08:30:00',
    '8c1f3e2a-0000-4000-8000-000000000001',
    true,
    ...origins.flat(),
  ];
  for (const [i, v] of Object.entries(overrides)) row[Number(i)] = v ?? null;
  return row;
};

const exportFile = (beanRows: Value[][]) =>
  workbook({
    Preparazioni: [
      ['Macinatura', 'Dose'],
      ['12', 18],
    ],
    Caffè: [BEAN_HEADER, ...beanRows],
    Metodi: [
      ['Tipo', 'Nome'],
      ['V60', 'V60 home'],
    ],
    Macinacaffè: [['Nome'], ['Comandante']],
  });

describe('parseExportDate', () => {
  it.each([
    ['30.04.2025', 'dmy', '2025-04-30'],
    ['04-30-2025', 'dmy', '2025-04-30'],
    ['2025-04-30', 'dmy', '2025-04-30'],
    ['2025/04/30', 'mdy', '2025-04-30'],
    ['03/04/2025', 'dmy', '2025-04-03'],
    ['03/04/2025', 'mdy', '2025-03-04'],
    ['01.05.2025 08:30:00', 'dmy', '2025-05-01'],
    ['31.02.2025', 'dmy', undefined],
    ['Invalid date', 'dmy', undefined],
  ] as const)('%s (%s) → %s', (value, order, iso) => {
    expect(parseExportDate(value, order)).toBe(iso);
  });

  it('detects the slash order from unambiguous dates', () => {
    expect(detectDateOrder(['03/04/2025', '25/04/2025'])).toBe('dmy');
    expect(detectDateOrder(['04/25/2025 10:00:00'])).toBe('mdy');
    expect(detectDateOrder(['03/04/2025'])).toBe('ambiguous');
    expect(detectDateOrder(['30.04.2025', '2025/04/30'])).toBeUndefined();
  });
});

describe('readExcelExport', () => {
  it('reads beans by position, whatever the language', () => {
    const content = readExcelExport(
      exportFile([
        beanRow({}, [
          ['Colombia', 'Huila', null, null, '1700', 'Caturra', 'Washed', '2024', 60, null],
          ['Ethiopia', null, null, null, null, null, null, null, 40, 'Organic'],
        ]),
      ]),
    );
    expect(content.issues).toEqual([]);
    expect(content.beans).toEqual([
      {
        name: 'Finca Example',
        roaster: 'Sample Roasters',
        roastDate: '2025-04-30',
        roastType: 'ESPRESSO',
        roastRange: 55,
        degreeOfRoast: 'CITY_PLUS_ROAST',
        blend: 'SINGLE_ORIGIN',
        weight: 250,
        cost: 14.5,
        flavourProfile: 'Cherry, cocoa',
        cuppingPoints: '86',
        decaffeinated: false,
        website: 'https://example.com/finca',
        ean: '4000000000001',
        notes: 'Fresh',
        rating: 4,
        created: '01.05.2025 08:30:00',
        uuid: '8c1f3e2a-0000-4000-8000-000000000001',
        archived: true,
        origins: [
          {
            country: 'Colombia',
            region: 'Huila',
            elevation: '1700',
            variety: 'Caturra',
            processing: 'Washed',
            harvested: '2024',
            percentage: 60,
          },
          { country: 'Ethiopia', percentage: 40, certification: 'Organic' },
        ],
      },
    ]);
  });

  it('keeps the other sheets as plain tables', () => {
    const content = readExcelExport(exportFile([]));
    expect(content.brews).toEqual({
      name: 'Preparazioni',
      headers: ['Macinatura', 'Dose'],
      rows: [['12', 18]],
    });
    expect(content.methods.rows).toEqual([['V60', 'V60 home']]);
    expect(content.grinders).toEqual({ name: 'Macinacaffè', headers: ['Nome'], rows: [['Comandante']] });
  });

  it('handles empty and ambiguous dates, and reports bad values', () => {
    const content = readExcelExport(
      exportFile([
        beanRow({ 2: 'Invalid date', 17: '03/04/2025 10:00:00' }),
        beanRow({ 0: 'Second', 2: '05/06/2025', 8: 'lots', 7: 'Mystery' }),
        beanRow({ 0: null }),
      ]),
    );
    expect(content.dateOrder).toBe('dmy');
    expect(content.beans.map((b) => [b.name, b.roastDate])).toEqual([
      ['Finca Example', undefined],
      ['Second', '2025-06-05'],
    ]);
    expect(content.issues.map((i) => [i.severity, i.row, i.column])).toEqual([
      ['warning', undefined, 'Data di tostatura'],
      ['error', 3, 'Miscela'],
      ['error', 3, 'Peso'],
      ['warning', 4, undefined],
    ]);
    expect(
      readExcelExport(exportFile([beanRow({ 2: '05/06/2025' })]), { dateOrder: 'mdy' }).beans[0]?.roastDate,
    ).toBe('2025-05-06');
  });

  it('converts its beans to a roasted template the importer reads', () => {
    const { beans } = readExcelExport(
      exportFile([
        beanRow({ 5: 'Custom', 6: 'Nordic' }, [
          ['Kenya', null, null, null, null, null, null, null, 100, null],
        ]),
      ]),
    );
    const template = new Uint8Array(readFileSync('src/assets/templates/roasted-beans.xlsx'));
    const content = readBeanTemplate(writeBeanTemplate(template, 'roasted', beans), 'roasted');
    expect(content.issues).toEqual([]);
    expect(content.beans[0]).toMatchObject({
      name: 'Finca Example',
      roastDate: '2025-04-30',
      roastType: 'ESPRESSO',
      degreeOfRoast: 'CUSTOM_ROAST',
      customDegreeOfRoast: 'Nordic',
      blend: 'SINGLE_ORIGIN',
      archived: true,
      origins: [{ country: 'Kenya', percentage: 100 }],
    });
    expect(content.beans[0]).not.toHaveProperty('uuid');
  });

  it('rejects workbooks that are not an export', () => {
    const notExport = workbook({ A: [['x']], B: [['y']], C: [], D: [] });
    expect(() => readExcelExport(notExport)).toThrow(ExcelExportError);
  });
});
