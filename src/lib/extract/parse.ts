/**
 * Rule-based extraction of a bean from a roaster's product page, as Jina Reader returns it
 * (Markdown), plus Shopify's product JSON when the shop has one. Pure functions, no network.
 */
import type { RoastingType } from '../formats/backup/enums';
import { nameFromUrl, type SharedBean, type SharedOrigin } from '../beanlink/bean-link';

/** The subset of Shopify's `/products/<handle>.json` the extractor reads. */
export interface ShopifyProduct {
  title?: string;
  vendor?: string;
  body_html?: string;
  tags?: string | string[];
  options?: { name?: string; values?: string[] }[];
  variants?: {
    id?: number;
    title?: string;
    price?: string | number;
    barcode?: string | null;
    available?: boolean;
  }[];
}

type OriginKey = Exclude<keyof SharedOrigin, 'percentage'>;
type Field = OriginKey | 'aromatics' | 'weight' | 'cost' | 'roastingType' | 'roaster' | 'name' | 'ean';

/** Labels seen on roaster pages, in English, Italian, German, French, Spanish and Portuguese. */
const LABELS: Record<Field, string[]> = {
  name: ['coffee name', 'nome'],
  roaster: ['roaster', 'roastery', 'torrefazione', 'rösterei'],
  country: [
    'country',
    'country of origin',
    'origin',
    'origine',
    'paese',
    'provenienza',
    'herkunft',
    'land',
    'ursprung',
    'pays',
    'país',
    'pais',
    'origen',
    'origem',
  ],
  region: [
    'region',
    'regione',
    'région',
    'región',
    'regiao',
    'região',
    'area',
    'zona',
    'department',
    'departamento',
    'province',
    'provincia',
  ],
  farm: [
    'farm',
    'finca',
    'fazenda',
    'estate',
    'hacienda',
    'azienda',
    'azienda agricola',
    'fattoria',
    'farm name',
    'washing station',
    'stazione di lavaggio',
    'mill',
    'cooperative',
    'cooperativa',
    'kooperative',
    'coopérative',
    'plantage',
    'domaine',
  ],
  farmer: [
    'farmer',
    'producer',
    'producers',
    'produttore',
    'produttori',
    'coltivatore',
    'produzent',
    'produzenten',
    'bauer',
    'farmer name',
    'productor',
    'productores',
    'producteur',
    'producteurs',
    'produtor',
    'grower',
  ],
  elevation: ['altitude', 'elevation', 'altitudine', 'höhe', 'anbauhöhe', 'altitud', 'altura', 'masl'],
  variety: [
    'variety',
    'varietal',
    'varietals',
    'varieties',
    'varietà',
    'varieta',
    'varietà botanica',
    'cultivar',
    'cultivars',
    'sorte',
    'sorten',
    'varietät',
    'variedad',
    'variedades',
    'variété',
    'variétés',
    'variedade',
    'botanical variety',
  ],
  processing: [
    'process',
    'processing',
    'processing method',
    'process method',
    'processo',
    'lavorazione',
    'metodo di lavorazione',
    'processo di lavorazione',
    'trattamento',
    'aufbereitung',
    'verarbeitung',
    'proceso',
    'procesamiento',
    'procédé',
    'traitement',
    'processamento',
    'post-harvest',
    'fermentation',
  ],
  harvest_time: [
    'harvest',
    'harvest time',
    'harvested',
    'harvest period',
    'raccolto',
    'raccolta',
    'ernte',
    'erntezeit',
    'cosecha',
    'récolte',
    'colheita',
    'crop year',
  ],
  certification: [
    'certification',
    'certifications',
    'certificazione',
    'certificazioni',
    'zertifizierung',
    'certificación',
    'certificat',
  ],
  aromatics: [
    'notes',
    'tasting notes',
    'taste notes',
    'flavour notes',
    'flavor notes',
    'flavours',
    'flavors',
    'flavour',
    'flavor',
    'flavour profile',
    'flavor profile',
    'cup profile',
    'cupping notes',
    'we taste',
    'in the cup',
    'note',
    'note aromatiche',
    'note di degustazione',
    'note gustative',
    'profilo aromatico',
    'profilo sensoriale',
    'aromi',
    'sentori',
    'geschmack',
    'geschmacksnoten',
    'aromen',
    'notas',
    'notas de cata',
    'notas de sabor',
    'notes de dégustation',
    'arômes',
    'notas de prova',
  ],
  weight: [
    'weight',
    'net weight',
    'size',
    'bag size',
    'peso',
    'peso netto',
    'formato',
    'gewicht',
    'nettogewicht',
    'poids',
    'poids net',
    'contenuto',
  ],
  cost: ['price', 'prezzo', 'preis', 'prix', 'precio', 'preço', 'regular price', 'sale price'],
  roastingType: [
    'roast',
    'roast type',
    'roasted for',
    'roast profile',
    'roasting profile',
    'roasting',
    'roast level',
    'tostatura',
    'profilo di tostatura',
    'tostato per',
    'röstung',
    'röstprofil',
    'geröstet für',
    'torréfaction',
    'tueste',
    'tostado',
    'torra',
    'ideal for',
    'suitable for',
    'recommended for',
    'brew method',
    'brewing method',
    'brew',
    'ideale per',
    'consigliato per',
    'metodo di estrazione',
    'estrazione',
    'zubereitung',
    'empfohlen für',
  ],
  ean: ['ean', 'barcode', 'gtin', 'ean code', 'codice ean'],
};

const LABEL_TO_FIELD = new Map<string, Field>();
for (const [field, labels] of Object.entries(LABELS) as [Field, string[]][]) {
  for (const label of labels) if (!LABEL_TO_FIELD.has(label)) LABEL_TO_FIELD.set(label, field);
}

const ORIGIN_KEYS: OriginKey[] = [
  'country',
  'region',
  'farm',
  'farmer',
  'elevation',
  'variety',
  'processing',
  'harvest_time',
  'certification',
];

/** Normalizes a label for lookup: lower case, no markup, no trailing colon. */
function labelKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[*_#`>]/g, '')
    .replace(/\s*[:：]\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Strips Markdown emphasis, images and links (keeping link text) from a line. */
function plain(line: string): string {
  return line
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[*_`]+/g, '')
    .replace(/^\s*(?:#{1,6}|[-+•·>]|\d+\.)\s+/, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A value worth keeping: short enough to be a fact, not a paragraph. */
function cleanValue(value: string): string | undefined {
  const v = value
    .replace(/^[\s:：\-–—|]+/, '')
    .replace(/[\s|.;,]+$/, '')
    .trim();
  if (!v || v.length > 160) return undefined;
  return v;
}

/** Splits `Label: value`, `Label – value` or a `| Label | value |` table row. */
function splitLabelled(line: string): [string, string] | undefined {
  const cells = line
    .split('|')
    .map((c) => plain(c))
    .filter(Boolean);
  if (line.trim().startsWith('|') && cells.length >= 2) return [cells[0] ?? '', cells.slice(1).join(', ')];
  const text = plain(line);
  const match =
    text.match(/^([^:：]{2,40}?)\s*[:：]\s*(.+)$/) ?? text.match(/^([^–—]{2,40}?)\s+[–—]\s+(.+)$/);
  if (match?.[1] && match[2]) return [match[1], match[2]];
  return undefined;
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Any known label followed by a colon, anywhere in a line. */
const LABEL_RUN = new RegExp(
  String.raw`(?<![\p{L}\p{N}])(?:${[...LABEL_TO_FIELD.keys()]
    .sort((x, y) => y.length - x.length)
    .map(escapeRegExp)
    .join('|')})\s*[:：]`,
  'giu',
);

/**
 * Splits a line holding several labels ("COUNTRY: Colombia | REGION: Huila | FARM: Motta")
 * into one line per label. Table rows are left to `splitLabelled`.
 */
function splitRun(line: string): string[] {
  if (line.trim().startsWith('|')) return [line];
  const text = plain(line);
  const starts = [...text.matchAll(LABEL_RUN)].map((match) => match.index);
  if (starts.length < 2) return [line];
  return starts.map((start, i) => text.slice(start, starts[i + 1]));
}

/** Collects `field → value` pairs from labelled lines, and label-only lines followed by a value line. */
export function labelledFields(text: string): Partial<Record<Field, string>> {
  const found: Partial<Record<Field, string>> = {};
  const set = (field: Field, raw: string) => {
    const value = cleanValue(raw);
    if (value && found[field] === undefined) found[field] = value;
  };
  const lines = text.split(/\r?\n/).flatMap(splitRun);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (!line.trim() || /^\s*\|?\s*:?-{3,}/.test(line)) continue;
    const pair = splitLabelled(line);
    if (pair) {
      const field = LABEL_TO_FIELD.get(labelKey(pair[0]));
      if (field) {
        set(field, pair[1]);
        continue;
      }
    }
    // "Origin" on one line, "Ethiopia" on the next (accordions, definition lists).
    const field = LABEL_TO_FIELD.get(labelKey(plain(line)));
    if (field) {
      let j = i + 1;
      while (j < lines.length && !lines[j]?.trim()) j++;
      const next = lines[j];
      if (next === undefined) continue;
      const nextPlain = plain(next);
      if (LABEL_TO_FIELD.has(labelKey(nextPlain))) continue;
      set(field, nextPlain);
      i = j;
    }
  }
  return found;
}

/** Grams from a text like "250g", "250 gr", "1 kg", "1,5kg"; bag sizes only. */
export function parseWeight(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const kg = text.match(/(\d+(?:[.,]\d+)?)\s*(?:kg|kilo)\b/i);
  if (kg) {
    const grams = Math.round(parseFloat((kg[1] ?? '').replace(',', '.')) * 1000);
    if (grams >= 100 && grams <= 5000) return grams;
  }
  const g = text.match(/(\d{2,4})\s*(?:g|gr|grams?|grammi|gramm|gramos|grammes)\b/i);
  if (g) {
    const grams = Number(g[1]);
    if (grams >= 50 && grams <= 5000) return grams;
  }
  return undefined;
}

const PRICE =
  /(?:[€$£]|EUR|USD|GBP|CHF|RON|lei|kr)\s?(\d{1,4}(?:[.,]\d{1,2})?)|(\d{1,4}(?:[.,]\d{1,2})?)\s?(?:[€$£]|EUR|USD|GBP|CHF|RON|lei|kr)(?![a-z])/i;
/** Lines whose amounts aren't the product's price. */
const NOT_A_PRICE =
  /shipping|spedizion|versand|livraison|envío|envio|gratis|free|over|oltre|ab |dès|desde|save|risparmi|coupon|sconto|discount|compare|was /i;

/** A price from a text like "€ 18,00", "18.00 EUR", "£12". */
export function parsePrice(text: string | undefined): number | undefined {
  if (!text || NOT_A_PRICE.test(text)) return undefined;
  const match = text.match(PRICE);
  if (!match) return undefined;
  const value = parseFloat((match[1] ?? match[2] ?? '').replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

/** Filter, espresso or omni, from a label value, an option or a product name. */
export function parseRoastingType(text: string | undefined): RoastingType | undefined {
  if (!text) return undefined;
  const t = text.toLowerCase();
  if (/\bomni/.test(t)) return 'OMNI';
  const filter = /filt(er|ro|re)|pour[- ]?over|v60|chemex|aeropress|batch brew|drip/.test(t);
  const espresso = /espresso|moka|macchina|siebträger/.test(t);
  if (filter && espresso) return 'OMNI';
  if (filter) return 'FILTER';
  if (espresso) return 'ESPRESSO';
  return undefined;
}

const DECAF = /\bdecaf|decaffeinat|entkoffeiniert|descafeinado|décaféiné|deca\b/i;

function htmlToText(html: string): string {
  return html
    .replace(/<\s*(br|\/p|\/li|\/tr|\/h\d|\/div)\s*\/?>/gi, '\n')
    .replace(/<\s*\/t[dh]\s*>/gi, ' | ')
    .replace(/<\s*t[dh][^>]*>/gi, '')
    .replace(/<\s*tr[^>]*>/gi, '| ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;/g, "'");
}

/** Jina's header block: `Title: …`, `URL Source: …`, then `Markdown Content:`. */
function jinaTitle(markdown: string): string | undefined {
  return markdown.match(/^Title:\s*(.+)$/m)?.[1]?.trim();
}

/** "Colombia Motta – Guido" → name "Colombia Motta", site "Guido". */
function splitTitle(title: string): { name: string; site?: string } {
  const parts = title.split(/\s+[|–—]\s+|\s+-\s+(?=[^-]+$)/);
  if (parts.length < 2) return { name: title };
  return { name: (parts[0] ?? title).trim(), site: parts.at(-1)?.trim() };
}

/** "www.d612coffeeroasters.com" → "D612coffeeroasters". */
function siteName(url: URL): string {
  const host = url.hostname.replace(/^www\./, '').split('.')[0] ?? url.hostname;
  return host.charAt(0).toUpperCase() + host.slice(1);
}

function pickVariant(product: ShopifyProduct, url: URL) {
  const variants = product.variants ?? [];
  const wanted = url.searchParams.get('variant');
  return (
    variants.find((v) => wanted && String(v.id) === wanted) ??
    variants.find((v) => v.available !== false) ??
    variants[0]
  );
}

function fromShopify(product: ShopifyProduct, url: URL): { bean: Partial<SharedBean>; prose: string } {
  const bean: Partial<SharedBean> = {};
  if (product.title) bean.name = product.title.trim();
  if (product.vendor) bean.roaster = product.vendor.trim();
  const variant = pickVariant(product, url);
  // The variant title ("250g / Espresso") is right far more often than its `grams` field.
  const optionText = [variant?.title, ...(product.options ?? []).flatMap((o) => o.values ?? [])].join(' / ');
  bean.weight = parseWeight(variant?.title) ?? parseWeight(optionText);
  const price = Number(variant?.price);
  if (Number.isFinite(price) && price > 0) bean.cost = price;
  const tags = Array.isArray(product.tags) ? product.tags.join(', ') : (product.tags ?? '');
  bean.bean_roasting_type =
    parseRoastingType(variant?.title) ?? parseRoastingType(optionText) ?? parseRoastingType(tags);
  if (variant?.barcode && /^\d{8,14}$/.test(variant.barcode)) bean.ean_article_number = variant.barcode;
  return { bean, prose: htmlToText(product.body_html ?? '') };
}

function fromText(text: string): { bean: Partial<SharedBean>; origin: SharedOrigin } {
  const fields = labelledFields(text);
  const origin: SharedOrigin = {};
  for (const key of ORIGIN_KEYS) if (fields[key]) origin[key] = fields[key];
  const bean: Partial<SharedBean> = {
    name: fields.name,
    roaster: fields.roaster,
    aromatics: fields.aromatics,
    weight: parseWeight(fields.weight),
    cost: parsePrice(fields.cost),
    bean_roasting_type: parseRoastingType(fields.roastingType),
    ean_article_number: fields.ean && /^\d{8,14}$/.test(fields.ean) ? fields.ean : undefined,
  };
  return { bean, origin };
}

/** Fills only what `target` doesn't have yet. */
function fill<T extends object>(target: T, source: Partial<T>): void {
  for (const [key, value] of Object.entries(source) as [keyof T, T[keyof T]][]) {
    if (value !== undefined && value !== '' && (target[key] === undefined || target[key] === ''))
      target[key] = value;
  }
}

/** First price in the page body, skipping shipping thresholds and discounts. */
function firstPrice(markdown: string): number | undefined {
  for (const line of markdown.split('\n')) {
    const price = parsePrice(plain(line));
    if (price !== undefined) return price;
  }
  return undefined;
}

/**
 * Builds the bean from what was read. Each source only fills fields the ones before it left
 * empty: Shopify JSON, then its description, then labelled lines on the page, then guesses
 * from the title and the page body.
 */
export function extractBean(url: URL, page: { markdown?: string; shopify?: ShopifyProduct }): SharedBean {
  const bean: Partial<SharedBean> = {};
  const origin: SharedOrigin = {};
  const markdown = page.markdown ?? '';
  const body = markdown.split(/^Markdown Content:\s*$/m).at(-1) ?? markdown;

  if (page.shopify) {
    const shop = fromShopify(page.shopify, url);
    fill(bean, shop.bean);
    const prose = fromText(shop.prose);
    fill(bean, prose.bean);
    fill(origin, prose.origin);
  }
  const labelled = fromText(body);
  fill(bean, labelled.bean);
  fill(origin, labelled.origin);

  const title = jinaTitle(markdown);
  const split = title ? splitTitle(title) : undefined;
  if (!bean.name && split?.name) bean.name = split.name;
  if (!bean.roaster) bean.roaster = split?.site ?? siteName(url);
  if (bean.weight === undefined) bean.weight = parseWeight(bean.name) ?? parseWeight(body.slice(0, 4000));
  if (bean.cost === undefined) bean.cost = firstPrice(body.slice(0, 6000));
  if (!bean.bean_roasting_type) bean.bean_roasting_type = parseRoastingType(bean.name);

  const name = bean.name || nameFromUrl(url);
  // Only the fields that were found, so the link stays small.
  const found = Object.fromEntries(Object.entries(bean).filter(([, v]) => v !== undefined && v !== ''));
  const result: SharedBean = { ...found, name, url: url.href };
  if (DECAF.test(`${name} ${title ?? ''}`)) result.decaffeinated = true;
  if (Object.keys(origin).length > 0) result.bean_information = [origin];
  return result;
}
