import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { classifySheets, detectFile, isZip, readSheetNames } from './detect';

const workbook = (...names: string[]) =>
  `<workbook><sheets>${names.map((n, i) => `<sheet name="${n}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`;

const xlsx = (...sheets: string[]) => zipSync({ 'xl/workbook.xml': strToU8(workbook(...sheets)) });

describe('isZip', () => {
  it('recognises the local file header', () => {
    expect(isZip(zipSync({ a: strToU8('x') }))).toBe(true);
    expect(isZip(strToU8('{"BEANS":[]}'))).toBe(false);
    expect(isZip(new Uint8Array())).toBe(false);
  });
});

describe('readSheetNames', () => {
  it('extracts and unescapes sheet names', () => {
    expect(readSheetNames(workbook('Beans', 'R&amp;D'))).toEqual(['Beans', 'R&D']);
  });
});

describe('classifySheets', () => {
  it.each([
    [['Readme_and_Consistency_Check', 'Beans', 'Bean_Information'], 'roasted-template'],
    [['Readme_and_Consistency_Check', 'Green Beans', 'Bean_Information'], 'green-template'],
    [['Brews', 'Beans', 'Methods', 'Grinders'], 'excel-export'],
    [['Preparazioni', 'Caffè', 'Metodi', 'Macinacaffè'], 'excel-export'],
    [['Bezüge', 'Bohnen', 'Brühmethode', 'Mühlen'], 'excel-export'],
    [['Sheet1'], 'unknown'],
  ] as const)('%j → %s', (sheets, kind) => {
    expect(classifySheets(sheets)).toBe(kind);
  });
});

describe('detectFile', () => {
  it('detects a backup zip by its main entry', () => {
    const bytes = zipSync({
      'Beanconqueror.json': strToU8('{}'),
      'Beanconqueror_Brews_1.json': strToU8('[]'),
    });
    expect(detectFile('whatever.bin', bytes)).toMatchObject({
      kind: 'backup',
      parts: ['Beanconqueror.json', 'Beanconqueror_Brews_1.json'],
    });
  });

  it('detects spreadsheets regardless of file name', () => {
    expect(detectFile('x', xlsx('Readme_and_Consistency_Check', 'Beans', 'Bean_Information')).kind).toBe(
      'roasted-template',
    );
    expect(detectFile('x', xlsx('Brews', 'Beans', 'Methods', 'Grinders')).kind).toBe('excel-export');
  });

  it('rejects non-zip and unrelated zips', () => {
    expect(detectFile('a.txt', strToU8('hello')).kind).toBe('unknown');
    expect(detectFile('a.zip', zipSync({ 'readme.txt': strToU8('hi') })).kind).toBe('unknown');
  });
});
