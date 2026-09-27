import { readFileSync } from 'node:fs';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { columnIndex, columnLetters, dateToSerial, serialToDate } from './cells';
import { readWorkbook } from './read';
import { fillSheet } from './write';
import { decodeXml, encodeXml } from './xml';

const roasted = () => new Uint8Array(readFileSync('src/assets/templates/roasted-beans.xlsx'));

describe('cells', () => {
  it.each([
    ['A', 0],
    ['Z', 25],
    ['AA', 26],
    ['AG', 32],
    ['XFD', 16383],
  ] as const)('%s ↔ %i', (letters, index) => {
    expect(columnIndex(letters)).toBe(index);
    expect(columnLetters(index)).toBe(letters);
  });

  it('converts Excel serials like Beanconqueror does', () => {
    // uiExcel.getJsDateFromExcel: (serial - 25569) days since the Unix epoch.
    expect(serialToDate(44593).toISOString()).toBe('2022-02-01T00:00:00.000Z');
    expect(dateToSerial(new Date('2025-04-30T00:00:00Z'))).toBe(45777);
  });
});

describe('xml', () => {
  it('round-trips special characters', () => {
    const value = 'Café & "Bar" <1> \u0001 tab\tline\n';
    expect(decodeXml(encodeXml(value))).toBe(value);
    expect(decodeXml('&#233;&#x1F600;')).toBe('é😀');
  });
});

describe('readWorkbook', () => {
  it('reads the bundled roasted template', () => {
    const wb = readWorkbook(roasted());
    expect(wb.sheetNames).toEqual(['Readme_and_Consistency_Check', 'Beans', 'Bean_Information']);
    const header = wb.sheet('Beans')![0]!.map((c) => c?.v);
    expect(header.slice(0, 4)).toEqual(['Name', 'Roaster', 'Roast date', 'Roast type']);
    expect(header).toContain('1. Purchasing Price');
    expect(wb.sheet('Beans')!.length).toBe(1);
    expect(wb.sheet('Missing')).toBeUndefined();
  });

  it('reads inline strings, booleans, errors and ISO dates', () => {
    const sheet =
      '<worksheet><sheetData><row r="1">' +
      '<c r="A1" t="inlineStr"><is><r><t>Hel</t></r><r><t>lo</t></r></is></c>' +
      '<c r="B1" t="b"><v>1</v></c><c r="C1" t="e"><v>#N/A</v></c>' +
      '<c r="D1" t="d"><v>2022-02-01T00:00:00Z</v></c><c r="F1"><v>3.5</v></c>' +
      '</row></sheetData></worksheet>';
    const bytes = zipSync({
      'xl/workbook.xml': strToU8('<workbook><sheets><sheet name="S" r:id="rId1"/></sheets></workbook>'),
      'xl/_rels/workbook.xml.rels': strToU8(
        '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
      ),
      'xl/worksheets/sheet1.xml': strToU8(sheet),
    });
    const row = readWorkbook(bytes).sheet('S')![0]!;
    expect(row[0]).toEqual({ t: 's', v: 'Hello' });
    expect(row[1]).toEqual({ t: 'b', v: true });
    expect(row[2]).toEqual({ t: 'e', v: '#N/A' });
    expect(row[3]).toEqual({ t: 'd', v: 44593 });
    expect(row[4]).toBeUndefined();
    expect(row[5]).toEqual({ t: 'n', v: 3.5 });
  });
});

describe('fillSheet', () => {
  const rows = [
    ['Boku', 'Nowhere', { serial: 45777 }, 'ESPRESSO', 'CITY_ROAST', null, 'SINGLE_ORIGIN', 250, 16.5],
    [
      'Sholi & "Kundwa" <Rwanda>',
      'Starbucks',
      null,
      'FILTER',
      undefined,
      '',
      'BLEND',
      150,
      10.5,
      'x',
      'y',
      true,
    ],
  ];

  it('writes values that read back identically', () => {
    const wb = readWorkbook(fillSheet(roasted(), rows, { sheet: 'Beans' }));
    const beans = wb.sheet('Beans')!;
    expect(beans).toHaveLength(3);
    expect(beans[0]![0]?.v).toBe('Name');
    expect(beans[1]!.map((c) => c?.v)).toEqual([
      'Boku',
      'Nowhere',
      45777,
      'ESPRESSO',
      'CITY_ROAST',
      undefined,
      'SINGLE_ORIGIN',
      250,
      16.5,
    ]);
    expect(beans[1]![2]?.t).toBe('d');
    expect(beans[2]![0]?.v).toBe('Sholi & "Kundwa" <Rwanda>');
    expect(beans[2]![11]).toEqual({ t: 'b', v: true });
  });

  it('keeps the other sheets, validations and the dimension consistent', () => {
    const before = unzipSync(roasted());
    const after = unzipSync(fillSheet(roasted(), rows, { sheet: 'Beans' }));
    expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort());
    for (const part of [
      'xl/worksheets/sheet1.xml',
      'xl/worksheets/sheet3.xml',
      'xl/styles.xml',
      '[Content_Types].xml',
    ]) {
      expect(strFromU8(after[part]!)).toBe(strFromU8(before[part]!));
    }
    const sheet = strFromU8(after['xl/worksheets/sheet2.xml']!);
    expect(sheet).toContain('<dimension ref="A1:AG3"/>');
    expect(sheet).toContain('x14:dataValidations');
    const sst = strFromU8(after['xl/sharedStrings.xml']!);
    const count = (sst.match(/<si>/g) ?? []).length;
    expect(sst).toContain(`uniqueCount="${count}"`);
  });

  it('is repeatable: refilling replaces previous data', () => {
    const once = fillSheet(roasted(), rows, { sheet: 'Beans' });
    const twice = fillSheet(once, [['Only']], { sheet: 'Beans' });
    const beans = readWorkbook(twice).sheet('Beans')!;
    expect(beans).toHaveLength(2);
    expect(beans[1]![0]?.v).toBe('Only');
  });

  it('adds a shared string table to workbooks without one', () => {
    const bytes = zipSync({
      '[Content_Types].xml': strToU8('<Types></Types>'),
      'xl/workbook.xml': strToU8('<workbook><sheets><sheet name="S" r:id="rId1"/></sheets></workbook>'),
      'xl/_rels/workbook.xml.rels': strToU8(
        '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
      ),
      'xl/worksheets/sheet1.xml': strToU8(
        '<worksheet><sheetData><row r="1"><c r="A1"><v>1</v></c></row></sheetData></worksheet>',
      ),
    });
    const filled = fillSheet(bytes, [['text']], { sheet: 'S' });
    expect(readWorkbook(filled).sheet('S')![1]![0]).toEqual({ t: 's', v: 'text' });
    expect(strFromU8(unzipSync(filled)['[Content_Types].xml']!)).toContain('sharedStrings');
  });

  it('rejects unknown sheets', () => {
    expect(() => fillSheet(roasted(), [], { sheet: 'Nope' })).toThrow(/not found/);
  });
});
