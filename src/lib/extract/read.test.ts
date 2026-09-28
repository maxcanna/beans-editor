import { describe, expect, it, vi } from 'vitest';
import { JINA, ReadError, parseShopifyJson, readBean, shopifyJsonUrl } from './read';

const respond = (body: string, status = 200) => new Response(body, { status });

describe('shopifyJsonUrl', () => {
  it('finds product pages, with or without a locale or collection prefix', () => {
    expect(shopifyJsonUrl(new URL('https://a.example/products/kigoma'))).toBe(
      'https://a.example/products/kigoma.json',
    );
    expect(shopifyJsonUrl(new URL('https://a.example/en/collections/c/products/x/?variant=1'))).toBe(
      'https://a.example/en/collections/c/products/x.json',
    );
    expect(shopifyJsonUrl(new URL('https://a.example/shop/x/'))).toBeUndefined();
  });
});

describe('parseShopifyJson', () => {
  it('reads the product even inside Jina’s header', () => {
    const text = 'Title: x\n\nURL Source: y\n\nMarkdown Content:\n{"product":{"title":"Kigoma"}}';
    expect(parseShopifyJson(text)).toEqual({ title: 'Kigoma' });
    expect(parseShopifyJson('not json')).toBeUndefined();
  });
});

describe('readBean', () => {
  it('reads the page through Jina', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () =>
      respond('Title: Elda – Bonacchi\n\nMarkdown Content:\nCountry: Honduras'),
    );
    const bean = await readBean(new URL('https://a.example/pages/Elda'), fetchFn);
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(fetchFn.mock.calls[0]![0]).toBe(`${JINA}https://a.example/pages/Elda`);
    expect(bean).toMatchObject({ name: 'Elda', roaster: 'Bonacchi' });
  });

  it('also reads the Shopify product JSON on product pages', async () => {
    const fetchFn = vi.fn(async (input: string | URL | Request) =>
      String(input).endsWith('.json')
        ? respond('{"product":{"title":"Kigoma","vendor":"Cayo"}}')
        : respond('Markdown Content:\nAltitude: 1800 m'),
    );
    const bean = await readBean(new URL('https://a.example/products/kigoma?variant=3'), fetchFn);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(bean).toMatchObject({
      name: 'Kigoma',
      roaster: 'Cayo',
      bean_information: [{ elevation: '1800 m' }],
    });
  });

  it('reports a page that is gone even though Jina answers 200', async () => {
    const fetchFn = vi.fn(async () => respond('Warning: Target URL returned error 404: Not Found'));
    await expect(readBean(new URL('https://a.example/p/x'), fetchFn)).rejects.toEqual(new ReadError('dead'));
  });

  it('reports rate limiting and network failures', async () => {
    await expect(
      readBean(new URL('https://a.example/p/x'), async () => respond('', 429)),
    ).rejects.toMatchObject({
      kind: 'rate-limited',
    });
    await expect(
      readBean(new URL('https://a.example/p/x'), async () => {
        throw new TypeError('Failed to fetch');
      }),
    ).rejects.toMatchObject({ kind: 'unreachable' });
  });
});
