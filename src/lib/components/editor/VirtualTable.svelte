<script lang="ts" generics="T">
  import type { Snippet } from 'svelte';
  import { visibleRange } from '../../editor/virtual';

  interface Props {
    items: readonly T[];
    /** Every row has this height in pixels. */
    rowHeight: number;
    /** How many columns `head` declares, for the spacer rows. */
    columns: number;
    /** The table's narrowest width in rem; below it the table scrolls sideways. */
    minWidth: number;
    key: (item: T) => string;
    label: string;
    /** A `<colgroup>` with the column widths, then a `<thead>` whose cells stick to the top. */
    head: Snippet;
    /** The cells of one row. */
    cells: Snippet<[T]>;
  }

  let { items, rowHeight, columns, minWidth, key, label, head, cells }: Props = $props();

  // A real table, so screen readers get columns and headers; only the rows in view are in the DOM,
  // with spacer rows standing in for the rest, and fixed column widths keep the columns from jumping.
  let scrollTop = $state(0);
  let viewport = $state(0);
  const range = $derived(visibleRange(scrollTop, viewport, rowHeight, items.length));
  const visible = $derived(items.slice(range.start, range.end));
</script>

<div
  class="max-h-[70dvh] overflow-auto rounded-2xl border border-border bg-surface"
  bind:clientHeight={viewport}
  onscroll={(e) => (scrollTop = e.currentTarget.scrollTop)}
>
  <table
    class="w-full table-fixed text-left text-sm"
    style:min-width="{minWidth}rem"
    aria-label={label}
    aria-rowcount={items.length + 1}
  >
    {@render head()}
    <tbody>
      {#if range.start > 0}
        <tr aria-hidden="true" style:height="{range.start * rowHeight}px"><td colspan={columns}></td></tr>
      {/if}
      {#each visible as item, i (key(item))}
        <tr
          class="border-b border-border hover:bg-border/20"
          style:height="{rowHeight}px"
          aria-rowindex={range.start + i + 2}
        >
          {@render cells(item)}
        </tr>
      {/each}
      {#if range.end < items.length}
        <tr aria-hidden="true" style:height="{(items.length - range.end) * rowHeight}px">
          <td colspan={columns}></td>
        </tr>
      {/if}
    </tbody>
  </table>
</div>
