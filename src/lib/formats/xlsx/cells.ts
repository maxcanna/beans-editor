/** Column letters ↔ zero-based indexes, and cell references. */

export function columnIndex(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function columnLetters(index: number): string {
  let n = index + 1;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

export function parseRef(ref: string): { col: number; row: number } {
  const [, letters, digits] = /^([A-Z]+)(\d+)$/i.exec(ref) ?? [];
  if (!letters || !digits) throw new Error(`Invalid cell reference: ${ref}`);
  return { col: columnIndex(letters), row: Number(digits) };
}

// Excel's 1900 date system (with its fictitious 29 Feb 1900) maps serial 25569 to 1970-01-01.
const UNIX_EPOCH_SERIAL = 25569;
const DAY_MS = 86_400_000;

export function serialToDate(serial: number): Date {
  return new Date(Math.round((serial - UNIX_EPOCH_SERIAL) * DAY_MS));
}

export function dateToSerial(date: Date): number {
  return date.getTime() / DAY_MS + UNIX_EPOCH_SERIAL;
}
