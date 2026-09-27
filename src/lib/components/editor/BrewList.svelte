<script lang="ts">
  import { Search, SlidersHorizontal, Star } from '@lucide/svelte';
  import { m } from '$paraglide/messages';
  import type { BackupRecord } from '../../formats/backup/backup';
  import { emptyBrewFilter, filterBrews } from '../../editor/brews';
  import { searchClass, inputClass, labelClass } from './styles';
  import VirtualList from './VirtualList.svelte';

  interface Option {
    uuid: string;
    name: string;
  }

  interface Props {
    brews: readonly BackupRecord[];
    names: ReadonlyMap<string, string>;
    beans: readonly Option[];
    methods: readonly Option[];
    mills: readonly Option[];
    onopen: (uuid: string) => void;
  }

  let { brews, names, beans, methods, mills, onopen }: Props = $props();
  let filter = $state(emptyBrewFilter());
  const shown = $derived(filterBrews(brews, names, filter));
  const filtered = $derived(Object.values(filter).some(Boolean));
  // On phones the filters would fill the screen, so they fold behind a button; wider screens always show them.
  let filtersOpen = $state(false);
  const activeFilters = $derived(
    (['bean', 'method', 'mill', 'from', 'to'] as const).filter((key) => filter[key]).length,
  );

  const value = (brew: BackupRecord, key: string) => (brew as Record<string, unknown>)[key];
  const name = (uuid: unknown) =>
    typeof uuid === 'string' && uuid ? (names.get(uuid) ?? m.brews_missing()) : '';
  const amount = (n: unknown, unit: string) => (typeof n === 'number' && n > 0 ? `${n} ${unit}` : '');
  const when = (brew: BackupRecord) =>
    new Date(brew.config.unix_timestamp * 1000).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

  const FILTERS = [
    { key: 'bean', label: m.brews_filter_bean, options: () => beans },
    { key: 'method', label: m.brews_filter_method, options: () => methods },
    { key: 'mill', label: m.brews_filter_grinder, options: () => mills },
  ] as const;
</script>

<section aria-label={m.brews_title()} class="flex flex-col gap-4">
  <div class="flex gap-2">
    <label class="relative flex-1">
      <span class="sr-only">{m.brews_search()}</span>
      <Search
        class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
        aria-hidden="true"
      />
      <input type="search" placeholder={m.brews_search()} class={searchClass} bind:value={filter.query} />
    </label>
    <button
      type="button"
      class="inline-flex shrink-0 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium hover:bg-border/40 focus-visible:outline-2 focus-visible:outline-accent sm:hidden"
      aria-expanded={filtersOpen}
      aria-controls="brew-filters"
      onclick={() => (filtersOpen = !filtersOpen)}
    >
      <SlidersHorizontal class="size-4" aria-hidden="true" />
      {activeFilters ? m.brews_filters_count({ count: activeFilters }) : m.brews_filters()}
    </button>
  </div>
  <div id="brew-filters" class="{filtersOpen ? 'grid' : 'hidden'} grid-cols-2 gap-3 sm:grid lg:grid-cols-6">
    {#each FILTERS as f (f.key)}
      <label class="{labelClass} col-span-2 sm:col-span-1 lg:col-span-2">
        {f.label()}
        <select class={inputClass} bind:value={filter[f.key]}>
          <option value="">{m.brews_filter_any()}</option>
          {#each f.options() as option (option.uuid)}
            <option value={option.uuid}>{option.name}</option>
          {/each}
        </select>
      </label>
    {/each}
    <label class="{labelClass} lg:col-span-2">
      {m.brews_filter_from()}
      <input class={inputClass} type="date" bind:value={filter.from} />
    </label>
    <label class="{labelClass} lg:col-span-2">
      {m.brews_filter_to()}
      <input class={inputClass} type="date" bind:value={filter.to} />
    </label>
  </div>

  <div class="flex items-center gap-3 text-sm text-muted">
    <p aria-live="polite" data-testid="brews-count">
      {m.brews_shown({ shown: shown.length, total: brews.length })}
    </p>
    {#if filtered}
      <button
        type="button"
        class="rounded-full px-3 py-1 font-medium text-fg hover:bg-border/40 focus-visible:outline-2 focus-visible:outline-accent"
        onclick={() => (filter = emptyBrewFilter())}
      >
        {m.brews_filter_clear()}
      </button>
    {/if}
  </div>

  {#if shown.length === 0}
    <p class="rounded-2xl border border-dashed border-border p-8 text-center text-muted">
      {brews.length === 0 ? m.brews_empty() : m.brews_no_match()}
    </p>
  {:else}
    <VirtualList items={shown} rowHeight={76} key={(b) => b.config.uuid} label={m.brews_title()}>
      {#snippet row(brew)}
        {@const rating = value(brew, 'rating')}
        <button
          type="button"
          class="flex h-full w-full items-center gap-4 px-4 text-left hover:bg-border/20 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
          onclick={() => onopen(brew.config.uuid)}
        >
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="truncate font-medium">{name(value(brew, 'bean')) || m.brews_none()}</span>
            <span class="truncate text-sm text-muted">
              {[when(brew), name(value(brew, 'method_of_preparation')), name(value(brew, 'mill'))]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </span>
          <span class="hidden shrink-0 text-right text-sm text-muted tabular-nums sm:block">
            {[
              amount(value(brew, 'grind_weight'), 'g'),
              amount(value(brew, 'brew_quantity'), value(brew, 'brew_quantity_type') === 'ML' ? 'ml' : 'g'),
            ]
              .filter(Boolean)
              .join(' → ')}
          </span>
          {#if typeof rating === 'number' && rating > 0}
            <span class="inline-flex shrink-0 items-center gap-1 text-sm tabular-nums">
              <Star class="size-3.5 text-accent" aria-hidden="true" />{rating}
            </span>
          {/if}
        </button>
      {/snippet}
    </VirtualList>
  {/if}
</section>
