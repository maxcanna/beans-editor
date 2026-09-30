<script lang="ts">
  import { ArrowDown, ArrowUp, ArrowUpDown } from '@lucide/svelte';
  import type { SortDirection } from '../../editor/sort';

  interface Props {
    label: string;
    /** The direction this column is sorted in, or `null` when it isn't the sorted one. */
    direction: SortDirection | null;
    onclick: () => void;
    /** Right-aligned columns hold numbers. */
    end?: boolean;
  }

  let { label, direction, onclick, end = false }: Props = $props();
</script>

<!-- The header cell around it carries aria-sort; the button's text is the column's name. -->
<button
  type="button"
  class={[
    'inline-flex items-center gap-1 uppercase hover:text-fg focus-visible:outline-2 focus-visible:outline-accent',
    end && 'flex-row-reverse',
    direction && 'text-fg',
  ]}
  {onclick}
>
  {label}
  {#if direction === 'asc'}
    <ArrowUp class="size-3.5" aria-hidden="true" />
  {:else if direction === 'desc'}
    <ArrowDown class="size-3.5" aria-hidden="true" />
  {:else}
    <ArrowUpDown class="size-3.5 opacity-40" aria-hidden="true" />
  {/if}
</button>
