/**
 * Minimal, DOM-free XML helpers for the parts of SpreadsheetML we touch.
 * DOMParser isn't available in workers, and the files are machine-written,
 * so targeted regular expressions are enough and fast.
 */

const NAMED: Record<string, string> = { lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' };

export function decodeXml(value: string): string {
  return value
    .replace(/&(#x[0-9a-f]+|#\d+|lt|gt|quot|apos|amp);/gi, (_, ref: string) => {
      if (ref[0] === '#') {
        const code =
          ref[1] === 'x' || ref[1] === 'X' ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
        return String.fromCodePoint(code);
      }
      return NAMED[ref.toLowerCase()] ?? '';
    })
    .replace(/_x([0-9a-f]{4})_/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

export function encodeXml(value: string): string {
  return (
    value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      // Characters XML 1.0 can't carry are written with Excel's _xHHHH_ escape.
      .replace(
        // eslint-disable-next-line no-control-regex -- matching control characters is the point
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,
        (c) => `_x${c.charCodeAt(0).toString(16).padStart(4, '0')}_`,
      )
  );
}

/** Parses the attributes of a start tag (`<c r="A1" s="3" t="s">`). */
export function attributes(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [, name, value] of tag.matchAll(/([\w:]+)="([^"]*)"/g)) {
    if (name) out[name] = decodeXml(value ?? '');
  }
  return out;
}

/** Concatenates all `<t>` runs of a string item, skipping phonetic hints (`<rPh>`). */
export function textContent(xml: string): string {
  const withoutPhonetic = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
  let text = '';
  for (const m of withoutPhonetic.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g)) {
    text += decodeXml(m[1] ?? '');
  }
  return text;
}
