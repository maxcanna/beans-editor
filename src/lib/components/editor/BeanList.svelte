<script lang="ts">
  import { Link, Plus, Search, SlidersHorizontal } from '@lucide/svelte';
  import { m } from '$paraglide/messages';
  import type { BackupRecord } from '../../formats/backup/schema';
  import { filterBeans, isFrozen, localDay, sortBeans, type BeanSortKey } from '../../editor/beans';
  import { label, ROAST_LABELS, ROASTING_TYPE_LABELS } from '../../editor/labels';
  import { nextSort, type Sort } from '../../editor/sort';
  import { inputClass, labelClass } from './styles';
  import MetaList from './MetaList.svelte';
  import SortButton from './SortButton.svelte';
  import ViewToggle from './ViewToggle.svelte';
  import { rem } from './rem.svelte';
  import VirtualTable from './VirtualTable.svelte';
  import ShowToggles from './ShowToggles.svelte';
  import StateBadges from './StateBadges.svelte';
  import { layout } from './view.svelte';
  import type { BeanFilters } from '../../editor/filters.svelte';

  interface Props {
    beans: readonly BackupRecord[];
    /** Kept by the editor, so they survive moving to another section. */
    filters: BeanFilters;
    brewCount: (uuid: string) => number;
    onopen: (uuid: string) => void;
    onadd: () => void;
    /** Opens "Add a bean from a URL", which adds the bean to this backup. */
    onaddlink: () => void;
  }

  let { beans, filters, brewCount, onopen, onadd, onaddlink }: Props = $props();

  let sort = $state<Sort<BeanSortKey> | null>(null);
  const shown = $derived(sortBeans(filterBeans(beans, filters), sort));
  // On phones the filters and the archived/frozen switches would fill the screen, so they fold behind a button;
  // wider screens always show them.
  let filtersOpen = $state(false);
  const activeFilters = $derived(
    Object.entries(filters).filter(([key, value]) => key !== 'query' && value).length,
  );
  const filtered = $derived(activeFilters > 0 || filters.query !== '');
  const clearFilters = () => {
    Object.assign(filters, {
      query: '',
      showArchived: false,
      showFrozen: false,
      from: '',
      to: '',
      roastFrom: '',
      roastTo: '',
    });
  };

  const COLUMNS: { key: BeanSortKey; label: () => string; width: string; end?: boolean }[] = [
    { key: 'roastingDate', label: m.bean_roast_date, width: '8rem' },
    { key: 'buyDate', label: m.bean_buy_date, width: '8rem' },
    { key: 'name', label: m.bean_name, width: '' },
    { key: 'roaster', label: m.bean_roaster, width: '10rem' },
    { key: 'bean_roasting_type', label: m.bean_roasting_type, width: '8rem' },
    { key: 'weight', label: m.bean_weight, width: '6rem', end: true },
    { key: 'rating', label: m.bean_rating_short, width: '6rem', end: true },
  ];

  const sortOf = (key: BeanSortKey) => (sort?.key === key ? sort.direction : null);
  const ariaSort = (key: BeanSortKey) =>
    sort?.key === key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none';

  const text = (bean: BackupRecord, key: string) => {
    const value = (bean as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : '';
  };
  const number = (bean: BackupRecord, key: string) => {
    const value = (bean as Record<string, unknown>)[key];
    return typeof value === 'number' && value > 0 ? value : undefined;
  };
  const day = (bean: BackupRecord, key: string) => {
    const local = localDay((bean as Record<string, unknown>)[key]);
    return local ? new Date(`${local}T00:00`).toLocaleDateString() : '';
  };
  const archived = (bean: BackupRecord) => (bean as Record<string, unknown>)['finished'] === true;
  const toggle =
    'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-accent';
</script>

<section aria-labelledby="beans-heading" class="flex flex-col gap-4">
  <div class="flex flex-wrap items-center gap-3">
    <h2 id="beans-heading" class="text-lg font-semibold">{m.beans_title()}</h2>
    <span class="flex-1"></span>
    <button
      type="button"
      class="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-border/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      onclick={onaddlink}
    >
      <Link class="size-4" aria-hidden="true" />
      {m.beans_add_link()}
    </button>
    <button
      type="button"
      class="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:bg-accent/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      onclick={onadd}
    >
      <Plus class="size-4" aria-hidden="true" />
      {m.beans_add()}
    </button>
  </div>

  <div class="flex flex-wrap items-center gap-3">
    <label class="relative min-w-48 flex-1">
      <span class="sr-only">{m.beans_search()}</span>
      <Search
        class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
        aria-hidden="true"
      />
      <input
        type="search"
        placeholder={m.beans_search()}
        class="w-full rounded-full border border-border bg-surface py-2 pr-4 pl-9 text-sm focus-visible:outline-2 focus-visible:outline-accent"
        bind:value={filters.query}
      />
    </label>
    <button
      type="button"
      class="{toggle} shrink-0 border border-border sm:hidden"
      aria-expanded={filtersOpen}
      aria-controls="bean-filters"
      onclick={() => (filtersOpen = !filtersOpen)}
    >
      <SlidersHorizontal class="size-4" aria-hidden="true" />
      {activeFilters ? m.beans_filters_count({ count: activeFilters }) : m.beans_filters()}
    </button>
  </div>

  <div
    id="bean-filters"
    class="{filtersOpen ? 'grid' : 'hidden'} grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap"
  >
    <!-- As tall as the date inputs, so the toggles line up with them on wide screens. -->
    <div class="col-span-2 flex flex-wrap items-center gap-x-6 gap-y-3 sm:h-[38px]">
      <ShowToggles bind:showArchived={filters.showArchived} bind:showFrozen={filters.showFrozen} />
    </div>
    <label class="{labelClass} sm:w-44">
      {m.beans_filter_roast_from()}
      <input class={inputClass} type="date" bind:value={filters.roastFrom} />
    </label>
    <label class="{labelClass} sm:w-44">
      {m.beans_filter_roast_to()}
      <input class={inputClass} type="date" bind:value={filters.roastTo} />
    </label>
    <label class="{labelClass} sm:w-44">
      {m.beans_filter_from()}
      <input class={inputClass} type="date" bind:value={filters.from} />
    </label>
    <label class="{labelClass} sm:w-44">
      {m.beans_filter_to()}
      <input class={inputClass} type="date" bind:value={filters.to} />
    </label>
  </div>

  <div class="flex items-center gap-3 text-sm text-muted">
    <p aria-live="polite" data-testid="beans-count">
      {m.beans_shown({ shown: shown.length, total: beans.length })}
    </p>
    {#if filtered}
      <button
        type="button"
        class="rounded-full px-3 py-1 font-medium text-fg hover:bg-border/40 focus-visible:outline-2 focus-visible:outline-accent"
        onclick={clearFilters}
      >
        {m.beans_filter_clear()}
      </button>
    {/if}
    <span class="ml-auto">
      <ViewToggle view={layout.view} onchange={(next) => (layout.view = next)} />
    </span>
  </div>

  {#if shown.length === 0}
    <p class="rounded-2xl border border-dashed border-border p-8 text-center text-muted">
      {beans.length === 0 ? m.beans_empty() : m.beans_no_match()}
    </p>
  {:else if layout.view === 'cards'}
    <ul class="grid gap-3 sm:grid-cols-2" data-testid="bean-cards">
      {#each shown as bean (bean.config.uuid)}
        <!-- Off-screen cards skip layout and paint, which keeps a long list cheap without fixing the cards' height. -->
        <li class="[contain-intrinsic-size:auto_7rem] [content-visibility:auto]">
          <button
            type="button"
            class="flex h-full w-full flex-col gap-1 rounded-2xl border border-border bg-surface p-4 text-left shadow-sm hover:border-accent/60 focus-visible:outline-2 focus-visible:outline-accent"
            onclick={() => onopen(bean.config.uuid)}
          >
            <span class="flex items-start gap-2">
              <span class="flex-1 font-semibold">{text(bean, 'name')}</span>
              <StateBadges archived={archived(bean)} frozen={isFrozen(bean)} />
            </span>
            <MetaList class="text-sm text-muted" items={[text(bean, 'roaster'), day(bean, 'roastingDate')]} />
            <MetaList
              class="text-sm text-muted"
              items={[
                label(ROAST_LABELS, (bean as Record<string, unknown>)['roast']),
                number(bean, 'weight') && `${number(bean, 'weight')} g`,
                day(bean, 'buyDate') && m.beans_bought({ date: day(bean, 'buyDate') }),
                m.beans_brews({ count: brewCount(bean.config.uuid) }),
              ]}
            />
          </button>
        </li>
      {/each}
    </ul>
  {:else}
    <div data-testid="bean-grid">
      <VirtualTable
        items={shown}
        rowHeight={rem.px * 3}
        columns={COLUMNS.length}
        minWidth={58}
        key={(b) => b.config.uuid}
        label={m.beans_title()}
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
        {#snippet cells(bean)}
          <td class="truncate px-4 py-2">{day(bean, 'roastingDate')}</td>
          <td class="truncate px-4 py-2">{day(bean, 'buyDate')}</td>
          <th scope="row" class="px-4 py-2 font-medium">
            <span class="flex items-center gap-2">
              <button
                type="button"
                class="min-w-0 truncate text-left hover:underline focus-visible:outline-2 focus-visible:outline-accent"
                onclick={() => onopen(bean.config.uuid)}
              >
                {text(bean, 'name')}
              </button>
              <StateBadges archived={archived(bean)} frozen={isFrozen(bean)} />
            </span>
          </th>
          <td class="truncate px-4 py-2">{text(bean, 'roaster')}</td>
          <td class="truncate px-4 py-2"
            >{label(ROASTING_TYPE_LABELS, (bean as Record<string, unknown>)['bean_roasting_type'])}</td
          >
          <td class="px-4 py-2 text-right tabular-nums">{number(bean, 'weight') ?? ''}</td>
          <td class="px-4 py-2 text-right tabular-nums">{number(bean, 'rating') ?? ''}</td>
        {/snippet}
      </VirtualTable>
    </div>
  {/if}
</section>
