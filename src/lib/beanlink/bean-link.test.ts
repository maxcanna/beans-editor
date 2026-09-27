import protobuf from 'protobufjs';
import { describe, expect, it } from 'vitest';
import { beanLink, encodeBean, findSharedUrl, nameFromUrl, type SharedBean } from './bean-link';

// The fields of Beanconqueror's BeanProto that links carry, with the app's field numbers.
const root = protobuf.Root.fromJSON({
  nested: {
    BeanInformation: {
      fields: {
        country: { type: 'string', id: 1 },
        region: { type: 'string', id: 2 },
        farm: { type: 'string', id: 3 },
        farmer: { type: 'string', id: 4 },
        elevation: { type: 'string', id: 5 },
        harvest_time: { type: 'string', id: 6 },
        variety: { type: 'string', id: 7 },
        processing: { type: 'string', id: 8 },
        certification: { type: 'string', id: 9 },
        percentage: { type: 'double', id: 10 },
      },
    },
    BeanProto: {
      fields: {
        name: { type: 'string', id: 1 },
        roastingDate: { type: 'string', id: 3 },
        note: { type: 'string', id: 4 },
        roaster: { type: 'string', id: 5 },
        roast: { type: 'uint64', id: 7 },
        beanMix: { type: 'uint64', id: 9 },
        roast_custom: { type: 'string', id: 10 },
        aromatics: { type: 'string', id: 11 },
        weight: { type: 'double', id: 12 },
        cost: { type: 'double', id: 14 },
        cupping_points: { type: 'string', id: 16 },
        decaffeinated: { type: 'bool', id: 17 },
        url: { type: 'string', id: 18 },
        ean_article_number: { type: 'string', id: 19 },
        bean_information: { rule: 'repeated', type: 'BeanInformation', id: 21 },
        bean_roasting_type: { type: 'uint64', id: 22 },
        external_images: { rule: 'repeated', type: 'string', id: 29 },
      },
    },
  },
});
const BeanProto = root.lookupType('BeanProto');
const decode = (bytes: Uint8Array) => BeanProto.toObject(BeanProto.decode(bytes), { longs: Number });

/** What the app does with a link: collect the chunks, undo Android's "+" → " ", base64-decode. */
function readLink(link: string) {
  const params = new URL(link).searchParams;
  let payload = '';
  for (let i = 0; params.has(`shareUserBean${i}`); i++) payload += params.get(`shareUserBean${i}`);
  const bytes = Uint8Array.from(atob(payload.replace(/ /g, '+')), (c) => c.charCodeAt(0));
  return decode(bytes);
}

const bean: SharedBean = {
  name: 'Guji Natural – café',
  roaster: 'Example Roasters',
  roastingDate: '2026-09-01T00:00:00.000Z',
  note: 'Juicy',
  roast: 'CITY_PLUS_ROAST',
  beanMix: 'SINGLE_ORIGIN',
  bean_roasting_type: 'FILTER',
  aromatics: 'Blueberry, jasmine',
  weight: 250,
  cost: 18.5,
  cupping_points: '87.5',
  decaffeinated: true,
  url: 'https://example.com/guji',
  ean_article_number: '1234567890123',
  bean_information: [
    { country: 'Ethiopia', region: 'Guji', elevation: '2100', variety: '74110', percentage: 100 },
  ],
  external_images: ['https://example.com/guji.jpg'],
};

describe('bean links', () => {
  it('encodes every field with the app’s field numbers and enum values', () => {
    expect(decode(encodeBean(bean))).toEqual({
      ...bean,
      roast: 7,
      beanMix: 1,
      bean_roasting_type: 1,
    });
  });

  it('leaves out fields that are not set', () => {
    expect(decode(encodeBean({ name: 'Plain' }))).toEqual({ name: 'Plain' });
  });

  it('builds an ADD_USER_BEAN link the app can read back, in 400-character chunks', () => {
    const long = { ...bean, note: 'x'.repeat(1000) };
    const link = beanLink(long);
    expect(link.startsWith('beanconqueror://ADD_USER_BEAN?shareUserBean0=')).toBe(true);
    const params = new URL(link).searchParams;
    expect(params.get('shareUserBean0')).toHaveLength(400);
    expect(params.has('shareUserBean3')).toBe(true);
    expect(readLink(link)).toMatchObject({ name: long.name, note: long.note, roast: 7 });
  });

  it('names a bean after the product URL', () => {
    expect(nameFromUrl(new URL('https://shop.example/products/ethiopia-guji_natural?variant=1'))).toBe(
      'Ethiopia Guji Natural',
    );
    expect(nameFromUrl(new URL('https://shop.example/caf%C3%A9-honduras.html'))).toBe('Café Honduras');
    expect(nameFromUrl(new URL('https://www.shop.example/'))).toBe('shop.example');
  });

  it('finds the URL in shared text', () => {
    expect(findSharedUrl(null, 'Look at this https://shop.example/guji great', '')?.href).toBe(
      'https://shop.example/guji',
    );
    expect(findSharedUrl('no link here', undefined)).toBeUndefined();
  });
});
