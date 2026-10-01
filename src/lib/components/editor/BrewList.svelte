<script lang="ts">
  import { Search, SlidersHorizontal, Star } from '@lucide/svelte';
  import { m } from '$paraglide/messages';
  import type { BackupRecord } from '../../formats/backup/backup';
  import { emptyBrewFilter, filterBrews, sortBrews, type BrewSortKey } from '../../editor/brews';
  import { nextSort, type Sort } from '../../editor/sort';
  import { searchClass, inputClass, labelClass } from './styles';
  import SortButton from './SortButton.svelte';
  import ViewToggle from './ViewToggle.svelte';
  import VirtualList from './VirtualList.svelte';
  import VirtualTable from './VirtualTable.svelte';
  import { layout } from './view.svelte';

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
  let sort = $state<Sort<BrewSortKey> | null>(null);
  const shown = $derived(sortBrews(filterBrews(brews, names, filter), names, sort));

  // Two cards side by side once there's room, like the bean cards.
  const wide = matchMedia('(min-width: 40rem)');
  let columns = $state(wide.matches ? 2 : 1);
  $effect(() => {
    const update = () => (columns = wide.matches ? 2 : 1);
    wide.addEventListener('change', update);
    return () => wide.removeEventListener('change', update);
  });

  const sortOf = (key: BrewSortKey) => (sort?.key === key ? sort.direction : null);
  const ariaSort = (key: BrewSortKey) =>
    sort?.key === key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none';
  const COLUMNS: { key: BrewSortKey; label: () => string; width: string; end?: boolean }[] = [
    { key: 'when', label: m.brews_col_when, width: '12rem' },
    { key: 'bean', label: m.brews_filter_bean, width: '' },
    { key: 'method', label: m.brews_filter_method, width: '9rem' },
    { key: 'mill', label: m.brews_filter_grinder, width: '9rem' },
    { key: 'dose', label: m.brew_grind_weight, width: '7rem', end: true },
    { key: 'water', label: m.brews_col_water, width: '7rem', end: true },
    { key: 'rating', label: m.bean_rating_short, width: '6rem', end: true },
  ];
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
  const number = (n: unknown) => (typeof n === 'number' && n > 0 ? n : '');
  const water = (brew: BackupRecord) =>
    amount(value(brew, 'brew_quantity'), value(brew, 'brew_quantity_type') === 'ML' ? 'ml' : 'g');
  const amounts = (brew: BackupRecord) =>
    [amount(value(brew, 'grind_weight'), 'g'), water(brew)].filter(Boolean).join(' → ');
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
  <div class="flex flex-wrap items-center gap-2">
    <label class="relative min-w-48 flex-1">
      <span class="sr-only">{m.brews_search()}</span>
      <Search
        class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
        aria-hidden="true"
      />
      <input type="search" placeholder={m.brews_search()} class={searchClass} bind:value={filter.query} />
    </label>
    <ViewToggle view={layout.view} onchange={(next) => (layout.view = next)} />
    <button
      type="button"
      class="inline-flex shrink-0 items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-border/40 focus-visible:outline-2 focus-visible:outline-accent sm:hidden"
      aria-expanded={filtersOpen}
      aria-controls="brew-filters"
      onclick={() => (filtersOpen = !filtersOpen)}
    >
      <SlidersHorizontal class="size-4" aria-hidden="true" />
      {activeFilters ? m.brews_filters_count({ count: activeFilters }) : m.brews_filters()}
    </button>
  </div>
  <div id="brew-filters" class="{filtersOpen ? 'grid' : 'hidden'} grid-cols-2 gap-3 sm:flex sm:flex-wrap">
    <label class="{labelClass} sm:w-44">
      {m.brews_filter_from()}
      <input class={inputClass} type="date" bind:value={filter.from} />
    </label>
    <label class="{labelClass} sm:w-44">
      {m.brews_filter_to()}
      <input class={inputClass} type="date" bind:value={filter.to} />
    </label>
    {#each FILTERS as f (f.key)}
      <label class="{labelClass} col-span-2 sm:w-44">
        {f.label()}
        <select class={inputClass} bind:value={filter[f.key]}>
          <option value="">{m.brews_filter_any()}</option>
          {#each f.options() as option (option.uuid)}
            <option value={option.uuid}>{option.name}</option>
          {/each}
        </select>
      </label>
    {/each}
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
  {:else if layout.view === 'cards'}
    <div data-testid="brew-cards">
      <VirtualList
        items={shown}
        rowHeight={116}
        {columns}
        plain
        key={(b) => b.config.uuid}
        label={m.brews_title()}
      >
        {#snippet row(brew, index)}
          {@const rating = value(brew, 'rating')}
          <div class={['h-full pb-3', columns > 1 && index % columns !== columns - 1 && 'pr-3']}>
            <button
              type="button"
              class="flex h-full w-full flex-col gap-1 rounded-2xl border border-border bg-surface p-4 text-left shadow-sm hover:border-accent/60 focus-visible:outline-2 focus-visible:outline-accent"
              onclick={() => onopen(brew.config.uuid)}
            >
              <span class="truncate font-semibold">{name(value(brew, 'bean')) || m.brews_none()}</span>
              <span class="truncate text-sm text-muted">
                {[when(brew), name(value(brew, 'method_of_preparation')), name(value(brew, 'mill'))]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
              <span class="flex items-center gap-3 text-sm text-muted tabular-nums">
                <span class="flex-1 truncate">{amounts(brew)}</span>
                {#if typeof rating === 'number' && rating > 0}
                  <span class="inline-flex shrink-0 items-center gap-1 text-fg">
                    <Star class="size-3.5 text-accent" aria-hidden="true" />{rating}
                  </span>
                {/if}
              </span>
            </button>
          </div>
        {/snippet}
      </VirtualList>
    </div>
  {:else}
    <div data-testid="brew-table">
      <VirtualTable
        items={shown}
        rowHeight={48}
        columns={COLUMNS.length}
        minWidth={58}
        key={(b) => b.config.uuid}
        label={m.brews_title()}
      >
        {#snippet head()}
          <colgroup>
            {#each COLUMNS as c (c.key)}
              <col style:width={c.width || undefined} />
            {/each}
          </colgroup>
          <thead class="text-xs whitespace-nowrap text-muted">
            <tr>
              {#each COLUMNS as c (c.key)}
                <th
                  scope="col"
                  aria-sort={ariaSort(c.key)}
                  class={[
                    'sticky top-0 z-10 border-b border-border bg-surface px-4 py-3 font-medium',
                    c.end && 'text-right',
                  ]}
                >
                  <SortButton
                    label={c.label()}
                    direction={sortOf(c.key)}
                    end={c.end}
                    onclick={() => (sort = nextSort(sort, c.key))}
                  />
                </th>
              {/each}
            </tr>
          </thead>
        {/snippet}
        {#snippet cells(brew)}
          {@const rating = value(brew, 'rating')}
          <th scope="row" class="truncate px-4 py-2 font-medium">
            <button
              type="button"
              class="max-w-full truncate text-left hover:underline focus-visible:outline-2 focus-visible:outline-accent"
              onclick={() => onopen(brew.config.uuid)}
            >
              {when(brew)}
            </button>
          </th>
          <td class="truncate px-4 py-2">{name(value(brew, 'bean')) || m.brews_none()}</td>
          <td class="truncate px-4 py-2">{name(value(brew, 'method_of_preparation'))}</td>
          <td class="truncate px-4 py-2">{name(value(brew, 'mill'))}</td>
          <td class="px-4 py-2 text-right tabular-nums">{number(value(brew, 'grind_weight'))}</td>
          <td class="truncate px-4 py-2 text-right tabular-nums">{water(brew)}</td>
          <td class="px-4 py-2 text-right tabular-nums"
            >{typeof rating === 'number' && rating > 0 ? rating : ''}</td
          >
        {/snippet}
      </VirtualTable>
    </div>
  {/if}
</section>
