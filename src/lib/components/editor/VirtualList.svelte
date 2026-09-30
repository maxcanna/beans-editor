<script lang="ts" generics="T">
  import type { Snippet } from 'svelte';
  import { visibleRange } from '../../editor/virtual';

  interface Props {
    items: readonly T[];
    /** Every row has this height in pixels, which keeps the maths trivial. */
    rowHeight: number;
    /** Items side by side in each row, filling it left to right. */
    columns?: number;
    /** No frame or dividers: the rows draw their own cards. */
    plain?: boolean;
    key: (item: T) => string;
    label: string;
    /** `index` is the item's place in `items`, which tells its column. */
    row: Snippet<[T, number]>;
  }

  let { items, rowHeight, columns = 1, plain = false, key, label, row }: Props = $props();

  // Only the rows in view (plus a few either side) are in the DOM, so thousands of brews stay smooth.
  let scrollTop = $state(0);
  let viewport = $state(0);
  const rows = $derived(Math.ceil(items.length / columns));
  const range = $derived(visibleRange(scrollTop, viewport, rowHeight, rows));
  const first = $derived(range.start * columns);
  const visible = $derived(items.slice(first, range.end * columns));
</script>

<div
  class={['max-h-[70dvh] overflow-y-auto', !plain && 'rounded-2xl border border-border bg-surface']}
  bind:clientHeight={viewport}
  onscroll={(e) => (scrollTop = e.currentTarget.scrollTop)}
>
  <ul aria-label={label} class="relative" style:height="{rows * rowHeight}px">
    {#each visible as item, i (key(item))}
      {@const index = first + i}
      <li
        class={['absolute', !plain && 'border-b border-border', columns === 1 && 'inset-x-0']}
        style:top="{Math.floor(index / columns) * rowHeight}px"
        style:height="{rowHeight}px"
        style:left={columns > 1 ? `${((index % columns) * 100) / columns}%` : undefined}
        style:width={columns > 1 ? `${100 / columns}%` : undefined}
        aria-setsize={items.length}
        aria-posinset={index + 1}
      >
        {@render row(item, index)}
      </li>
    {/each}
  </ul>
</div>
