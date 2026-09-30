<script lang="ts">
  import { Archive, Link, Plus, Search, Snowflake, SlidersHorizontal } from '@lucide/svelte';
  import { m } from '$paraglide/messages';
  import type { BackupRecord } from '../../formats/backup/backup';
  import { filterBeans, isFrozen, localDay, sortBeans, type BeanSortKey } from '../../editor/beans';
  import { label, ROAST_LABELS, ROASTING_TYPE_LABELS } from '../../editor/labels';
  import { nextSort, type Sort } from '../../editor/sort';
  import { inputClass, labelClass } from './styles';
  import MetaList from './MetaList.svelte';
  import SortButton from './SortButton.svelte';
  import ViewToggle from './ViewToggle.svelte';
  import Toggle from './Toggle.svelte';
  import { layout } from './view.svelte';

  interface Props {
    beans: readonly BackupRecord[];
    brewCount: (uuid: string) => number;
    onopen: (uuid: string) => void;
    onadd: () => void;
    /** Opens "Add a bean from a URL", which adds the bean to this backup. */
    onaddlink: () => void;
  }

  let { beans, brewCount, onopen, onadd, onaddlink }: Props = $props();

  let query = $state('');
  let showArchived = $state(false);
  let showFrozen = $state(false);
  /** Buy date and roast date ranges, local days. */
  let from = $state('');
  let to = $state('');
  let roastFrom = $state('');
  let roastTo = $state('');
  let sort = $state<Sort<BeanSortKey> | null>(null);
  const shown = $derived(
    sortBeans(filterBeans(beans, { query, showArchived, showFrozen, from, to, roastFrom, roastTo }), sort),
  );
  // On phones the filters would fill the screen, so they fold behind a button; wider screens always show them.
  let filtersOpen = $state(false);
  const activeFilters = $derived([from, to, roastFrom, roastTo].filter(Boolean).length);

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
        bind:value={query}
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
    <Toggle bind:checked={showArchived} label={m.beans_show_archived()} />
    <Toggle bind:checked={showFrozen} label={m.beans_show_frozen()} />
    <ViewToggle view={layout.view} onchange={(next) => (layout.view = next)} />
  </div>

  <div
    id="bean-filters"
    class="{filtersOpen ? 'grid' : 'hidden'} grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap"
  >
    <label class="{labelClass} sm:w-44">
      {m.beans_filter_roast_from()}
      <input class={inputClass} type="date" bind:value={roastFrom} />
    </label>
    <label class="{labelClass} sm:w-44">
      {m.beans_filter_roast_to()}
      <input class={inputClass} type="date" bind:value={roastTo} />
    </label>
    <label class="{labelClass} sm:w-44">
      {m.beans_filter_from()}
      <input class={inputClass} type="date" bind:value={from} />
    </label>
    <label class="{labelClass} sm:w-44">
      {m.beans_filter_to()}
      <input class={inputClass} type="date" bind:value={to} />
    </label>
    {#if activeFilters}
      <button
        type="button"
        class="col-span-2 rounded-full px-3 py-2 text-sm font-medium hover:bg-border/40 focus-visible:outline-2 focus-visible:outline-accent"
        onclick={() => ((from = ''), (to = ''), (roastFrom = ''), (roastTo = ''))}
      >
        {m.beans_filter_clear()}
      </button>
    {/if}
  </div>

  {#if shown.length === 0}
    <p class="rounded-2xl border border-dashed border-border p-8 text-center text-muted">
      {beans.length === 0 ? m.beans_empty() : m.beans_no_match()}
    </p>
  {:else if layout.view === 'cards'}
    <ul class="grid gap-3 sm:grid-cols-2" data-testid="bean-cards">
      {#each shown as bean (bean.config.uuid)}
        <li>
          <button
            type="button"
            class="flex h-full w-full flex-col gap-1 rounded-2xl border border-border bg-surface p-4 text-left shadow-sm hover:border-accent/60 focus-visible:outline-2 focus-visible:outline-accent"
            onclick={() => onopen(bean.config.uuid)}
          >
            <span class="flex items-start gap-2">
              <span class="flex-1 font-semibold">{text(bean, 'name')}</span>
              {#if archived(bean)}
                <span
                  class="inline-flex shrink-0 items-center gap-1 rounded-full bg-border/50 px-2 py-0.5 text-xs whitespace-nowrap text-muted"
                >
                  <Archive class="size-3" aria-hidden="true" />
                  {m.beans_archived()}
                </span>
              {/if}
              {#if isFrozen(bean)}
                <span
                  class="inline-flex shrink-0 items-center gap-1 rounded-full bg-border/50 px-2 py-0.5 text-xs whitespace-nowrap text-muted"
                >
                  <Snowflake class="size-3" aria-hidden="true" />
                  {m.beans_frozen()}
                </span>
              {/if}
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
    <div class="overflow-x-auto rounded-2xl border border-border bg-surface">
      <table class="w-full text-left text-sm" data-testid="bean-grid">
        <thead class="border-b border-border text-xs whitespace-nowrap text-muted">
          <tr>
            <th scope="col" aria-sort={ariaSort('name')} class="min-w-44 px-4 py-3 font-medium">
              <SortButton
                label={m.bean_name()}
                direction={sortOf('name')}
                onclick={() => (sort = nextSort(sort, 'name'))}
              />
            </th>
            <th scope="col" aria-sort={ariaSort('roaster')} class="min-w-36 px-4 py-3 font-medium">
              <SortButton
                label={m.bean_roaster()}
                direction={sortOf('roaster')}
                onclick={() => (sort = nextSort(sort, 'roaster'))}
              />
            </th>
            <th scope="col" aria-sort={ariaSort('roastingDate')} class="px-4 py-3 font-medium">
              <SortButton
                label={m.bean_roast_date()}
                direction={sortOf('roastingDate')}
                onclick={() => (sort = nextSort(sort, 'roastingDate'))}
              />
            </th>
            <th scope="col" aria-sort={ariaSort('buyDate')} class="px-4 py-3 font-medium">
              <SortButton
                label={m.bean_buy_date()}
                direction={sortOf('buyDate')}
                onclick={() => (sort = nextSort(sort, 'buyDate'))}
              />
            </th>
            <th scope="col" aria-sort={ariaSort('bean_roasting_type')} class="px-4 py-3 font-medium">
              <SortButton
                label={m.bean_roasting_type()}
                direction={sortOf('bean_roasting_type')}
                onclick={() => (sort = nextSort(sort, 'bean_roasting_type'))}
              />
            </th>
            <th scope="col" aria-sort={ariaSort('weight')} class="px-4 py-3 text-right font-medium">
              <SortButton
                label={m.bean_weight()}
                direction={sortOf('weight')}
                onclick={() => (sort = nextSort(sort, 'weight'))}
                end
              />
            </th>
            <th scope="col" aria-sort={ariaSort('rating')} class="px-4 py-3 text-right font-medium">
              <SortButton
                label={m.bean_rating_short()}
                direction={sortOf('rating')}
                onclick={() => (sort = nextSort(sort, 'rating'))}
                end
              />
            </th>
          </tr>
        </thead>
        <tbody>
          {#each shown as bean (bean.config.uuid)}
            <tr class="border-b border-border last:border-0 hover:bg-border/20">
              <th scope="row" class="px-4 py-2 font-medium">
                <button
                  type="button"
                  class="text-left hover:underline focus-visible:outline-2 focus-visible:outline-accent"
                  onclick={() => onopen(bean.config.uuid)}
                >
                  {text(bean, 'name')}
                </button>
                {#if archived(bean)}
                  <span
                    class="ml-2 rounded-full bg-border/50 px-2 py-0.5 text-xs font-normal whitespace-nowrap text-muted"
                  >
                    {m.beans_archived()}
                  </span>
                {/if}
                {#if isFrozen(bean)}
                  <span
                    class="ml-2 rounded-full bg-border/50 px-2 py-0.5 text-xs font-normal whitespace-nowrap text-muted"
                  >
                    {m.beans_frozen()}
                  </span>
                {/if}
              </th>
              <td class="px-4 py-2">{text(bean, 'roaster')}</td>
              <td class="px-4 py-2 whitespace-nowrap">{day(bean, 'roastingDate')}</td>
              <td class="px-4 py-2 whitespace-nowrap">{day(bean, 'buyDate')}</td>
              <td class="px-4 py-2 whitespace-nowrap"
                >{label(ROASTING_TYPE_LABELS, (bean as Record<string, unknown>)['bean_roasting_type'])}</td
              >
              <td class="px-4 py-2 text-right tabular-nums">{number(bean, 'weight') ?? ''}</td>
              <td class="px-4 py-2 text-right tabular-nums">{number(bean, 'rating') ?? ''}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>
