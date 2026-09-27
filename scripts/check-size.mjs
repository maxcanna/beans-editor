// Fails when the JavaScript needed for first paint exceeds the budget (gzipped).
// Lazy chunks are excluded: they load on demand (and are precached by the service worker).
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = 100;
const html = readFileSync('dist/index.html', 'utf8');
const scripts = [
  ...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g),
  ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+\.js)"/g),
].map((m) => m[1]);

let total = 0;
for (const src of new Set(scripts)) {
  const size = gzipSync(readFileSync(`dist${src}`)).byteLength;
  total += size;
  console.log(`${(size / 1024).toFixed(1).padStart(7)} KB  ${src}`);
}
const totalKb = total / 1024;
console.log(`${totalKb.toFixed(1).padStart(7)} KB  initial JS (budget ${BUDGET_KB} KB gzipped)`);
if (totalKb > BUDGET_KB) {
  console.error('Initial JavaScript is over budget.');
  process.exit(1);
}
