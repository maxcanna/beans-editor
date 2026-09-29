import { describe, expect, it } from 'vitest';
import { extractBean, labelledFields, parsePrice, parseRoastingType, parseWeight } from './parse';

// Synthetic pages shaped like what Jina Reader returns for real roaster sites.
const LABELLED_EN = `Title: Colombia Motta Red Bourbon – Guido

URL Source: https://example.com/en/shop/colombia-motta/

Markdown Content:
Free shipping over €50

# Colombia Motta Red Bourbon

€ 18,50

**COUNTRY:** Colombia
**REGION:** Huila
**FARM:** Finca Motta
**ALTITUDE:** 1750 masl
**VARIETY:** Red Bourbon
**PROCESSING METHOD:** Washed
Notes: Red apple, panela, orange

Roasting profile – Omni
Weight 250g
`;

const ACCORDION_IT = `Title: Elda | Bonacchi Caffè

Markdown Content:
## Elda

Origine

Honduras

Regione

Las Capucas

Produttore

Finca Platanares

Varietà

Parainema

Lavorazione

Natural

Note di degustazione

Frutti rossi, cioccolato fondente, frutta tropicale

Tostatura

Filtro

Peso netto 250 g
Prezzo: 18,00 €
`;

const TABLE_DE = `Title: Natural SL14/SL28 – Sandbox

Markdown Content:
| Herkunft | Uganda |
| --- | --- |
| Höhe | 1900 m |
| Sorte | SL14, SL28 |
| Aufbereitung | Natural |
`;

describe('parseWeight', () => {
  it('reads grams and kilos', () => {
    expect(parseWeight('250g')).toBe(250);
    expect(parseWeight('Peso netto 250 gr')).toBe(250);
    expect(parseWeight('1 kg')).toBe(1000);
    expect(parseWeight('1,5kg bag')).toBe(1500);
    expect(parseWeight('Size: 200g, 1kg')).toBe(200);
    expect(parseWeight('1kg / 250g')).toBe(1000);
  });

  it('ignores numbers that are not bag sizes', () => {
    expect(parseWeight('Altitude 1800 m')).toBeUndefined();
    expect(parseWeight('9g dose')).toBeUndefined();
    expect(parseWeight(undefined)).toBeUndefined();
  });
});

describe('parsePrice', () => {
  it('reads prices with the currency before or after', () => {
    expect(parsePrice('€ 18,50')).toBe(18.5);
    expect(parsePrice('18.00 EUR')).toBe(18);
    expect(parsePrice('£12')).toBe(12);
    expect(parsePrice('Prezzo: 18,00 €')).toBe(18);
  });

  it('skips shipping thresholds', () => {
    expect(parsePrice('Free shipping over €50')).toBeUndefined();
    expect(parsePrice('Spedizione gratuita sopra 40 €')).toBeUndefined();
  });
});

describe('parseRoastingType', () => {
  it('maps brew words to the roast type', () => {
    expect(parseRoastingType('Filtro')).toBe('FILTER');
    expect(parseRoastingType('Espresso roast')).toBe('ESPRESSO');
    expect(parseRoastingType('Omni')).toBe('OMNI');
    expect(parseRoastingType('Filter & Espresso')).toBe('OMNI');
    expect(parseRoastingType('Light')).toBeUndefined();
  });
});

describe('labelledFields', () => {
  it('reads bold labels with colons', () => {
    const fields = labelledFields(LABELLED_EN);
    expect(fields).toMatchObject({
      country: 'Colombia',
      region: 'Huila',
      farm: 'Finca Motta',
      elevation: '1750 masl',
      variety: 'Red Bourbon',
      processing: 'Washed',
      aromatics: 'Red apple, panela, orange',
      roastingType: 'Omni',
    });
  });

  it('reads a label line followed by its value line', () => {
    expect(labelledFields(ACCORDION_IT)).toMatchObject({
      country: 'Honduras',
      region: 'Las Capucas',
      farmer: 'Finca Platanares',
      variety: 'Parainema',
      processing: 'Natural',
      aromatics: 'Frutti rossi, cioccolato fondente, frutta tropicale',
      roastingType: 'Filtro',
    });
  });

  it('reads several labels on one line', () => {
    const line =
      '**COUNTRY:** Columbia | **REGION:** Acevedo, Huila | **FARM:** Motta | **ALTITUDE:** 1650 masl | **VARIETY:** Red Bourbon | **PROCESSING METHOD:** Washed';
    expect(labelledFields(line)).toEqual({
      country: 'Columbia',
      region: 'Acevedo, Huila',
      farm: 'Motta',
      elevation: '1650 masl',
      variety: 'Red Bourbon',
      processing: 'Washed',
    });
    expect(labelledFields('Country: Kenya Region: Nyeri Process: Washed')).toEqual({
      country: 'Kenya',
      region: 'Nyeri',
      processing: 'Washed',
    });
  });

  it('reads table rows', () => {
    expect(labelledFields(TABLE_DE)).toMatchObject({
      country: 'Uganda',
      elevation: '1900 m',
      variety: 'SL14, SL28',
      processing: 'Natural',
    });
  });

  it('ignores long prose after a label', () => {
    const prose = `Notes: ${'a very long sentence '.repeat(20)}`;
    expect(labelledFields(prose).aromatics).toBeUndefined();
  });
});

describe('extractBean', () => {
  it('builds a bean from a labelled page', () => {
    const url = new URL('https://example.com/en/shop/colombia-motta/');
    expect(extractBean(url, { markdown: LABELLED_EN })).toEqual({
      name: 'Colombia Motta Red Bourbon',
      roaster: 'Guido',
      url: url.href,
      weight: 250,
      cost: 18.5,
      aromatics: 'Red apple, panela, orange',
      bean_roasting_type: 'OMNI',
      bean_information: [
        {
          country: 'Colombia',
          region: 'Huila',
          farm: 'Finca Motta',
          elevation: '1750 masl',
          variety: 'Red Bourbon',
          processing: 'Washed',
        },
      ],
    });
  });

  it('builds a bean from an Italian page', () => {
    const bean = extractBean(new URL('https://example.it/pages/Elda'), { markdown: ACCORDION_IT });
    expect(bean).toMatchObject({
      name: 'Elda',
      roaster: 'Bonacchi Caffè',
      weight: 250,
      cost: 18,
      bean_roasting_type: 'FILTER',
    });
    expect(bean.bean_information?.[0]?.country).toBe('Honduras');
  });

  it('leaves the dates to the user', () => {
    const markdown = `Title: Kenya Kiambu – Roaster

Markdown Content:
# Kenya Kiambu

Roasted on 15 September 2026, shipped the next day.

| Best before | 15/03/2027 |
`;
    const bean = extractBean(new URL('https://example.com/kenya'), { markdown });
    expect(bean.roastingDate).toBeUndefined();
    expect(bean.bestDate).toBeUndefined();
  });

  it('prefers Shopify data, then fills the rest from the description and the page', () => {
    const url = new URL('https://shop.example/en/products/kigoma?variant=2');
    const bean = extractBean(url, {
      markdown:
        'Title: Kigoma – Café Example\n\nMarkdown Content:\nAltitude: 1800 m\nCountry: Burundi (page)\n',
      shopify: {
        title: 'Kigoma',
        vendor: 'Cayo',
        body_html:
          '<p>Juicy and sweet.</p><ul><li><strong>Country:</strong> Burundi</li><li>Process: Washed</li></ul>',
        tags: 'filter, burundi',
        options: [{ name: 'Size', values: ['250g', '1kg'] }],
        variants: [
          { id: 1, title: '250g', price: '16.00', barcode: '' },
          { id: 2, title: '1kg', price: '52.00', barcode: '' },
        ],
      },
    });
    expect(bean).toMatchObject({
      name: 'Kigoma',
      roaster: 'Cayo',
      weight: 1000,
      cost: 52,
      bean_roasting_type: 'FILTER',
      bean_information: [{ country: 'Burundi', processing: 'Washed', elevation: '1800 m' }],
    });
  });

  it('falls back to the URL for the name and the host for the roaster', () => {
    const url = new URL('https://www.roaster.example/coffee/ethiopia-guji-natural');
    expect(extractBean(url, { markdown: 'Markdown Content:\nNothing useful here.' })).toEqual({
      name: 'Ethiopia Guji Natural',
      roaster: 'Roaster',
      url: url.href,
    });
  });

  it('marks decaf beans', () => {
    const bean = extractBean(new URL('https://example.com/p/x'), {
      markdown: 'Title: Colombia Decaf – Shop\n',
    });
    expect(bean.decaffeinated).toBe(true);
  });
});
