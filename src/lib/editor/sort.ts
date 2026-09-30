export type SortDirection = 'asc' | 'desc';

/** The column a table is sorted by; `null` keeps the list's own order (newest first). */
export interface Sort<K extends string> {
  key: K;
  direction: SortDirection;
}

/** A click on a column header: ascending, then descending, then back to the default order. */
export function nextSort<K extends string>(current: Sort<K> | null, key: K): Sort<K> | null {
  if (current?.key !== key) return { key, direction: 'asc' };
  return current.direction === 'asc' ? { key, direction: 'desc' } : null;
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/**
 * Items ordered by one column. `value` gives a number, a string or `null` for
 * nothing; items with nothing always come last, whichever way the sort goes.
 * Equal items keep the order they came in.
 */
export function sortRecords<T, K extends string>(
  items: readonly T[],
  sort: Sort<K> | null,
  value: (item: T, key: K) => string | number | null,
): T[] {
  if (!sort) return [...items];
  const sign = sort.direction === 'asc' ? 1 : -1;
  const keyed = items.map((item) => ({ item, value: value(item, sort.key) }));
  keyed.sort((a, b) => {
    if (a.value === null || b.value === null) return a.value === b.value ? 0 : a.value === null ? 1 : -1;
    const order =
      typeof a.value === 'number' && typeof b.value === 'number'
        ? a.value - b.value
        : collator.compare(String(a.value), String(b.value));
    return order * sign;
  });
  return keyed.map((k) => k.item);
}
