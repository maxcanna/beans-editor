/** How a list of records is shown: a card for each, or a table. */
export type View = 'cards' | 'grid';

/** The layout remembered for a list, or what `fallback` says when nothing is stored or storage is blocked. */
export function loadView(key: string, fallback: () => View): View {
  try {
    const saved = localStorage.getItem(key);
    if (saved === 'cards' || saved === 'grid') return saved;
  } catch {
    // Storage can be blocked; use the fallback.
  }
  return fallback();
}

export function saveView(key: string, view: View) {
  try {
    localStorage.setItem(key, view);
  } catch {
    // Not remembered, which is fine.
  }
}
