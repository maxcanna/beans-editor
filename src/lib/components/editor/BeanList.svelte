<script lang="ts">
  import { Archive, LayoutGrid, Link, Plus, Search, Table } from '@lucide/svelte';
  import { m } from '$paraglide/messages';
  import type { BackupRecord } from '../../formats/backup/backup';
  import { filterBeans, localDay } from '../../editor/beans';
  import { label, ROAST_LABELS } from '../../editor/labels';
  import MetaList from './MetaList.svelte';

  interface Props {
    beans: readonly BackupRecord[];
    brewCount: (uuid: string) => number;
    onopen: (uuid: string) => void;
    onadd: () => void;
    /** Opens "Add a bean from a URL", which adds the bean to this backup. */
    onaddlink: () => void;
  }

  let { beans, brewCount, onopen, onadd, onaddlink }: Props = $props();

  type View = 'cards' | 'grid';
  const VIEW_KEY = 'beans-editor:beans-view';

  function initialView(): View {
    try {
      const saved = localStorage.getItem(VIEW_KEY);
      if (saved === 'cards' || saved === 'grid') return saved;
    } catch {
      // Storage can be blocked; fall back to the screen size.
    }
    return matchMedia('(min-width: 48rem)').matches ? 'grid' : 'cards';
  }

  let view = $state<View>(initialView());
  let query = $state('');
  let showArchived = $state(false);
  const shown = $derived(filterBeans(beans, { query, showArchived }));

  function setView(next: View) {
    view = next;
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Not remembered, which is fine.
    }
  }

  const text = (bean: BackupRecord, key: string) => {
    const value = (bean as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : '';
  };
  const number = (bean: BackupRecord, key: string) => {
    const value = (bean as Record<string, unknown>)[key];
    return typeof value === 'number' && value > 0 ? value : undefined;
  };
  const archived = (bean: BackupRecord) => (bean as Record<string, unknown>)['finished'] === true;
  const date = (bean: BackupRecord) => {
    const day = localDay((bean as Record<string, unknown>)['roastingDate']);
    return day ? new Date(`${day}T00:00`).toLocaleDateString() : '';
  };

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
    <label class="flex items-center gap-2 text-sm">
      <input type="checkbox" class="size-4 accent-accent" bind:checked={showArchived} />
      {m.beans_show_archived()}
    </label>
    <div role="group" aria-label={m.beans_view()} class="flex rounded-full border border-border p-0.5">
      <button
        type="button"
        class={[toggle, view === 'cards' ? 'bg-border/60 font-medium' : 'text-muted']}
        aria-pressed={view === 'cards'}
        onclick={() => setView('cards')}
      >
        <LayoutGrid class="size-4" aria-hidden="true" />
        {m.beans_view_cards()}
      </button>
      <button
        type="button"
        class={[toggle, view === 'grid' ? 'bg-border/60 font-medium' : 'text-muted']}
        aria-pressed={view === 'grid'}
        onclick={() => setView('grid')}
      >
        <Table class="size-4" aria-hidden="true" />
        {m.beans_view_grid()}
      </button>
    </div>
  </div>

  {#if shown.length === 0}
    <p class="rounded-2xl border border-dashed border-border p-8 text-center text-muted">
      {beans.length === 0 ? m.beans_empty() : m.beans_no_match()}
    </p>
  {:else if view === 'cards'}
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
            </span>
            <MetaList class="text-sm text-muted" items={[text(bean, 'roaster'), date(bean)]} />
            <MetaList
              class="text-sm text-muted"
              items={[
                label(ROAST_LABELS, (bean as Record<string, unknown>)['roast']),
                number(bean, 'weight') && `${number(bean, 'weight')} g`,
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
        <thead class="border-b border-border text-xs whitespace-nowrap text-muted uppercase">
          <tr>
            <th scope="col" class="min-w-44 px-4 py-3 font-medium">{m.bean_name()}</th>
            <th scope="col" class="min-w-36 px-4 py-3 font-medium">{m.bean_roaster()}</th>
            <th scope="col" class="px-4 py-3 font-medium">{m.bean_roast_date()}</th>
            <th scope="col" class="px-4 py-3 font-medium">{m.bean_roast()}</th>
            <th scope="col" class="px-4 py-3 text-right font-medium">{m.bean_weight()}</th>
            <th scope="col" class="px-4 py-3 text-right font-medium">{m.bean_rating_short()}</th>
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
              </th>
              <td class="px-4 py-2">{text(bean, 'roaster')}</td>
              <td class="px-4 py-2 whitespace-nowrap">{date(bean)}</td>
              <td class="px-4 py-2 whitespace-nowrap"
                >{label(ROAST_LABELS, (bean as Record<string, unknown>)['roast'])}</td
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
