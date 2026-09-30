/** The rows to render for a scrolled list of equal-height rows, with a few either side so scrolling never shows a gap. */
export function visibleRange(
  scrollTop: number,
  viewport: number,
  rowHeight: number,
  rows: number,
  overscan = 8,
): { start: number; end: number } {
  return {
    start: Math.max(0, Math.floor(scrollTop / rowHeight) - overscan),
    end: Math.min(rows, Math.ceil((scrollTop + (viewport || 800)) / rowHeight) + overscan),
  };
}
