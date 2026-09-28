import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type Rule = { pattern: RegExp; detach: string[]; set: [string, string][] };

// Parses public/_headers the way Cloudflare static assets do, for plain paths and `*` splats.
function parseHeaders(text: string): Rule[] {
  const rules: Rule[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      const source = line
        .trim()
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replaceAll('*', '.*');
      rules.push({ pattern: new RegExp(`^${source}$`), detach: [], set: [] });
    } else if (line.trim().startsWith('!')) {
      rules.at(-1)!.detach.push(line.trim().slice(1).trim().toLowerCase());
    } else {
      const colon = line.indexOf(':');
      rules.at(-1)!.set.push([line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim()]);
    }
  }
  return rules;
}

function headersFor(rules: Rule[], path: string): Map<string, string> {
  const headers = new Map<string, string>();
  for (const rule of rules.filter((r) => r.pattern.test(path))) {
    for (const name of rule.detach) headers.delete(name);
    for (const [name, value] of rule.set) {
      const current = headers.get(name);
      headers.set(name, current ? `${current}, ${value}` : value);
    }
  }
  return headers;
}

const rules = parseHeaders(readFileSync(new URL('../../../public/_headers', import.meta.url), 'utf8'));
const cacheControl = (path: string) => headersFor(rules, path).get('cache-control');

describe('_headers cache policy', () => {
  it.each(['/', '/some/spa/route', '/sw.js', '/manifest.webmanifest'])(
    'revalidates %s on every load',
    (path) => {
      expect(cacheControl(path)).toBe('no-cache');
    },
  );

  it('caches hashed build assets for a year', () => {
    expect(cacheControl('/assets/index-CWgA7IF7.js')).toBe('public, max-age=31536000, immutable');
    expect(cacheControl('/assets/inter-latin-wght-normal-Dx4kXJAl.woff2')).toBe(
      'public, max-age=31536000, immutable',
    );
  });

  it.each(['/icons/icon-192.png', '/favicon.ico', '/apple-touch-icon.png'])('caches %s for a day', (path) => {
    expect(cacheControl(path)).toBe('public, max-age=86400, stale-while-revalidate=604800');
  });

  it('sends the security headers everywhere', () => {
    for (const path of ['/', '/assets/index.js', '/icons/icon-192.png']) {
      expect(headersFor(rules, path).get('content-security-policy')).toContain("default-src 'self'");
    }
  });
});
