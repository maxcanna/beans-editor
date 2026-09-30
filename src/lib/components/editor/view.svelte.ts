/** How a list of records is shown: a card for each, or a table. */
export type View = 'cards' | 'grid';

const KEY = 'beans-editor:view';

function load(): View {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'cards' || saved === 'grid') return saved;
  } catch {
    // Storage can be blocked; use the default.
  }
  // A table needs room: phones start with cards.
  return matchMedia('(min-width: 48rem)').matches ? 'grid' : 'cards';
}

let current = $state<View>(load());

/** The layout shared by Beans and Brews, remembered across visits. */
export const layout = {
  get view(): View {
    return current;
  },
  set view(next: View) {
    current = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Not remembered, which is fine.
    }
  },
};
