<script lang="ts">
  import { Archive, Search } from '@lucide/svelte';
  import { m } from '$paraglide/messages';
  import type { BackupRecord } from '../../formats/backup/backup';
  import { filterGear, gearForm, type GearKey } from '../../editor/gear';
  import { searchClass } from './styles';
  import ShowToggles from './ShowToggles.svelte';

  interface Props {
    kind: GearKey;
    items: readonly BackupRecord[];
    brewCount: (uuid: string) => number;
    onopen: (uuid: string) => void;
  }

  let { kind, items, brewCount, onopen }: Props = $props();
  let query = $state('');
  let showArchived = $state(false);
  const shown = $derived(filterGear(items, query, showArchived));

  const text = $derived(
    kind === 'MILL'
      ? { title: m.grinders_title(), search: m.grinders_search(), empty: m.grinders_empty() }
      : { title: m.methods_title(), search: m.methods_search(), empty: m.methods_empty() },
  );
</script>

<section aria-label={text.title} class="flex flex-col gap-4">
  <div class="flex flex-wrap items-center gap-3">
    <label class="relative min-w-48 flex-1">
      <span class="sr-only">{text.search}</span>
      <Search
        class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
        aria-hidden="true"
      />
      <input type="search" placeholder={text.search} class={searchClass} bind:value={query} />
    </label>
    <ShowToggles bind:showArchived />
  </div>

  {#if shown.length === 0}
    <p class="rounded-2xl border border-dashed border-border p-8 text-center text-muted">
      {items.length === 0 ? text.empty : m.gear_no_match()}
    </p>
  {:else}
    <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {#each shown as item (item.config.uuid)}
        {@const form = gearForm(item)}
        <li>
          <button
            type="button"
            class="flex h-full w-full flex-col gap-1 rounded-2xl border border-border bg-surface p-4 text-left shadow-sm hover:border-accent/60 focus-visible:outline-2 focus-visible:outline-accent"
            onclick={() => onopen(item.config.uuid)}
          >
            <span class="flex items-start gap-2">
              <span class="flex-1 font-semibold">{form.name}</span>
              {#if form.finished}
                <span
                  class="inline-flex items-center gap-1 rounded-full bg-border/50 px-2 py-0.5 text-xs text-muted"
                >
                  <Archive class="size-3" aria-hidden="true" />
                  {m.beans_archived()}
                </span>
              {/if}
            </span>
            <span class="text-sm text-muted">{m.beans_brews({ count: brewCount(item.config.uuid) })}</span>
            {#if form.note}<span class="line-clamp-2 text-sm text-muted">{form.note}</span>{/if}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</section>
