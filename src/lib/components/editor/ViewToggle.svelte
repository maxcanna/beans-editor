<script lang="ts">
  import { LayoutGrid, Table } from '@lucide/svelte';
  import { m } from '$paraglide/messages';
  import type { View } from './view.svelte';

  interface Props {
    view: View;
    onchange: (view: View) => void;
  }

  let { view, onchange }: Props = $props();

  const toggle =
    'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-accent';
</script>

<div role="group" aria-label={m.view_label()} class="flex rounded-full border border-border p-0.5">
  <button
    type="button"
    class={[toggle, view === 'cards' ? 'bg-border/60 font-medium' : 'text-muted']}
    aria-pressed={view === 'cards'}
    onclick={() => onchange('cards')}
  >
    <LayoutGrid class="size-4" aria-hidden="true" />
    {m.view_cards()}
  </button>
  <button
    type="button"
    class={[toggle, view === 'grid' ? 'bg-border/60 font-medium' : 'text-muted']}
    aria-pressed={view === 'grid'}
    onclick={() => onchange('grid')}
  >
    <Table class="size-4" aria-hidden="true" />
    {m.view_grid()}
  </button>
</div>
