<script lang="ts" generics="T">
  import type { Snippet } from 'svelte';

  interface Props {
    items: readonly T[];
    /** Every row has this height in pixels, which keeps the maths trivial. */
    rowHeight: number;
    key: (item: T) => string;
    label: string;
    row: Snippet<[T]>;
  }

  let { items, rowHeight, key, label, row }: Props = $props();

  // Only the rows in view (plus a few either side) are in the DOM, so thousands of brews stay smooth.
  const OVERSCAN = 8;
  let scrollTop = $state(0);
  let viewport = $state(0);
  const start = $derived(Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN));
  const end = $derived(
    Math.min(items.length, Math.ceil((scrollTop + (viewport || 800)) / rowHeight) + OVERSCAN),
  );
  const visible = $derived(items.slice(start, end));
</script>

<div
  class="max-h-[70dvh] overflow-y-auto rounded-2xl border border-border bg-surface"
  bind:clientHeight={viewport}
  onscroll={(e) => (scrollTop = e.currentTarget.scrollTop)}
>
  <ul aria-label={label} class="relative" style:height="{items.length * rowHeight}px">
    {#each visible as item, i (key(item))}
      <li
        class="absolute inset-x-0 border-b border-border"
        style:top="{(start + i) * rowHeight}px"
        style:height="{rowHeight}px"
        aria-setsize={items.length}
        aria-posinset={start + i + 1}
      >
        {@render row(item)}
      </li>
    {/each}
  </ul>
</div>
