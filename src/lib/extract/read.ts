/**
 * Reads a product page through Jina Reader (r.jina.ai), which is the CORS bridge: keyless,
 * and it answers the browser's preflight. Shopify product pages also get the shop's own
 * product JSON, which is more reliable than the page text for name, roaster, price and size.
 */
import { extractBean, type ShopifyProduct } from './parse';
import type { SharedBean } from '../beanlink/bean-link';

export const JINA = 'https://r.jina.ai/';

export type ReadErrorKind = 'dead' | 'rate-limited' | 'unreachable';

export class ReadError extends Error {
  constructor(readonly kind: ReadErrorKind) {
    super(kind);
    this.name = 'ReadError';
  }
}

/** Jina answers 200 even when the shop's page is gone, with this warning in the body. */
const DEAD = /Warning: Target URL returned error 4\d\d/;

/** `/products/<handle>` with an optional locale or collection prefix: Shopify's product JSON is at `<path>.json`. */
export function shopifyJsonUrl(url: URL): string | undefined {
  if (!/\/products\/[^/]+\/?$/.test(url.pathname)) return undefined;
  return `${url.origin}${url.pathname.replace(/\/$/, '')}.json`;
}

/** Pulls `{"product": …}` out of Jina's text, which may wrap it in a Title/URL header. */
export function parseShopifyJson(text: string): ShopifyProduct | undefined {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return undefined;
  try {
    const data = JSON.parse(text.slice(start, end + 1)) as { product?: ShopifyProduct };
    return data.product && typeof data.product === 'object' ? data.product : undefined;
  } catch {
    return undefined;
  }
}

async function get(
  target: string,
  headers: Record<string, string>,
  fetchFn: typeof fetch,
  signal?: AbortSignal,
): Promise<string> {
  let response: Response;
  try {
    response = await fetchFn(JINA + target, { headers, signal });
  } catch (error) {
    if (signal?.aborted) throw error;
    // Jina's 429 may come without CORS headers, so the browser reports it as a network error.
    throw new ReadError('unreachable');
  }
  if (response.status === 429) throw new ReadError('rate-limited');
  if (!response.ok) throw new ReadError('unreachable');
  return response.text();
}

/** Reads the page at `url` and extracts a bean. Throws `ReadError`, or an `AbortError` when `signal` fires. */
export async function readBean(
  url: URL,
  fetchFn: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<SharedBean> {
  const jsonUrl = shopifyJsonUrl(url);
  const shopify = jsonUrl
    ? get(jsonUrl, { 'X-Respond-With': 'text' }, fetchFn, signal).then(parseShopifyJson, () => undefined)
    : Promise.resolve(undefined);
  const page = get(url.href, { 'X-Retain-Images': 'none' }, fetchFn, signal).then(
    (markdown) => ({ markdown }),
    (error: unknown) => ({ error }),
  );
  const [product, read] = await Promise.all([shopify, page]);
  if ('error' in read) {
    // The product JSON alone is enough to fill the bean.
    if (product) return extractBean(url, { shopify: product });
    throw read.error;
  }
  if (DEAD.test(read.markdown)) {
    if (product) return extractBean(url, { shopify: product });
    throw new ReadError('dead');
  }
  return extractBean(url, { markdown: read.markdown, shopify: product });
}
