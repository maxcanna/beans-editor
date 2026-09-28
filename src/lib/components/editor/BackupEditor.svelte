<script lang="ts">
  import { CircleCheck, Download, FileArchive, Share2, X } from '@lucide/svelte';
  import { Tabs } from 'bits-ui';
  import { m } from '$paraglide/messages';
  import { writeBackup, type BackupRecord } from '../../formats/backup/backup';
  import { newBean } from '../../editor/beans';
  import { nameIndex } from '../../editor/brews';
  import { newMill } from '../../editor/gear';
  import { canShareFiles, download, outputName, share } from '../../editor/output';
  import {
    addRecord,
    brewsUsing,
    deleteRecord,
    findRecord,
    records,
    replaceRecord,
  } from '../../editor/records';
  import type { EditorSession } from '../../editor/session.svelte';
  import BeanDialog from './BeanDialog.svelte';
  import BeanList from './BeanList.svelte';
  import BrewDialog from './BrewDialog.svelte';
  import BrewList from './BrewList.svelte';
  import GearDialog from './GearDialog.svelte';
  import GearList from './GearList.svelte';
  import MetaList from './MetaList.svelte';

  interface Props {
    session: EditorSession;
    onclose: () => void;
  }

  let { session, onclose }: Props = $props();

  const data = $derived(session.data ?? {});
  const beans = $derived(records(data, 'BEANS'));
  const count = (key: 'BREWS' | 'MILL' | 'PREPARATION') => records(data, key).length;
  const maxRating = $derived.by(() => {
    const settings = data['SETTINGS'];
    const first = Array.isArray(settings) ? settings[0] : settings;
    const value = (first as Record<string, unknown> | undefined)?.['bean_rating'];
    return typeof value === 'number' && value > 0 ? value : 5;
  });

  const brewMaxRating = $derived.by(() => {
    const settings = data['SETTINGS'];
    const first = Array.isArray(settings) ? settings[0] : settings;
    const value = (first as Record<string, unknown> | undefined)?.['brew_rating'];
    return typeof value === 'number' && value > 0 ? value : 5;
  });

  type Editable = 'BEANS' | 'BREWS' | 'MILL' | 'PREPARATION';
  /** The record in the dialog: an existing one, or a new unsaved one. */
  // Raw, so the record stays a plain object that IndexedDB can store.
  let editing = $state.raw<{ key: Editable; record: BackupRecord; isNew: boolean } | null>(null);
  let tab = $state<Editable>('BEANS');
  const shareable = canShareFiles();

  const options = (key: 'BEANS' | 'MILL' | 'PREPARATION') =>
    records(data, key)
      .map((r) => ({ uuid: r.config.uuid, name: String((r as Record<string, unknown>)['name'] ?? '') }))
      .sort((a, b) => a.name.localeCompare(b.name));
  const beanOptions = $derived(options('BEANS'));
  const methodOptions = $derived(options('PREPARATION'));
  const millOptions = $derived(options('MILL'));
  const names = $derived(nameIndex(data));

  function openRecord(key: Editable, uuid: string) {
    const record = findRecord(data, key, uuid);
    if (record) editing = { key, record, isNew: false };
  }

  function saveRecord(record: BackupRecord) {
    if (!editing) return;
    const { key, isNew } = editing;
    session.update((d) => (isNew ? addRecord(d, key, record) : replaceRecord(d, key, record)));
    editing = null;
  }

  function deleteEditing() {
    if (!editing) return;
    const result = deleteRecord(data, editing.key, editing.record.config.uuid);
    if (result.ok) {
      session.update(() => result.data);
      editing = null;
    }
  }

  const TABS = [
    { key: 'BEANS', label: (count: number) => m.tab_beans({ count }) },
    { key: 'BREWS', label: (count: number) => m.tab_brews({ count }) },
    { key: 'MILL', label: (count: number) => m.tab_grinders({ count }) },
    { key: 'PREPARATION', label: (count: number) => m.tab_methods({ count }) },
  ] as const;

  const bytes = () => writeBackup(data);

  function downloadBackup() {
    download(bytes(), outputName(session.fileName));
    session.markSaved();
  }

  async function shareBackup() {
    if (await share(bytes(), outputName(session.fileName))) session.markSaved();
  }

  const action =
    'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';
</script>

<div class="flex flex-col gap-6" data-testid="backup-editor">
  <header class="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-surface p-4 shadow-sm">
    <FileArchive class="size-8 shrink-0 text-accent" aria-hidden="true" />
    <div class="min-w-0 flex-1 basis-56">
      <h2 class="truncate font-semibold">{session.fileName}</h2>
      <MetaList
        class="text-sm text-muted"
        items={[
          m.editor_count_beans({ count: beans.length }),
          m.editor_count_brews({ count: count('BREWS') }),
          m.editor_count_grinders({ count: count('MILL') }),
          m.editor_count_methods({ count: count('PREPARATION') }),
        ]}
      />
      <p class="mt-1 text-xs" aria-live="polite" data-testid="save-state">
        {#if session.storageFailed}
          <span role="alert" class="font-medium text-danger">{m.editor_storage_failed()}</span>
        {:else if session.dirty}
          <span class="font-medium text-accent">{m.editor_unsaved()}</span>
        {:else}
          <span class="inline-flex items-center gap-1 text-muted">
            <CircleCheck class="size-3.5" aria-hidden="true" />
            {m.editor_saved()}
          </span>
        {/if}
      </p>
    </div>
    <div class="flex flex-wrap items-center gap-2 max-sm:w-full max-sm:justify-end">
      {#if shareable}
        <button type="button" class="{action} border border-border hover:bg-border/40" onclick={shareBackup}>
          <Share2 class="size-4" aria-hidden="true" />
          {m.editor_share()}
        </button>
      {/if}
      <button
        type="button"
        class="{action} bg-accent text-accent-fg hover:bg-accent/90"
        onclick={downloadBackup}
      >
        <Download class="size-4" aria-hidden="true" />
        {m.editor_download()}
      </button>
      <button
        type="button"
        class="rounded-full p-2 text-muted hover:bg-border/50 focus-visible:outline-2 focus-visible:outline-accent"
        aria-label={m.editor_close()}
        onclick={onclose}
      >
        <X class="size-5" aria-hidden="true" />
      </button>
    </div>
  </header>

  <Tabs.Root bind:value={tab} class="flex flex-col gap-6">
    <Tabs.List
      aria-label={m.tabs_label()}
      class="flex gap-1 overflow-x-auto rounded-full border border-border bg-surface p-1 text-sm"
    >
      {#each TABS as t (t.key)}
        <Tabs.Trigger
          value={t.key}
          class="shrink-0 rounded-full px-4 py-1.5 font-medium text-muted focus-visible:outline-2 focus-visible:outline-accent data-[state=active]:bg-accent data-[state=active]:text-accent-fg"
        >
          {t.label(records(data, t.key).length)}
        </Tabs.Trigger>
      {/each}
    </Tabs.List>
    <Tabs.Content value="BEANS">
      <!-- Only the open tab is mounted, so hidden lists cost nothing. -->
      {#if tab === 'BEANS'}
        <BeanList
          {beans}
          brewCount={(uuid) => brewsUsing(data, 'BEANS', uuid)}
          onopen={(uuid) => openRecord('BEANS', uuid)}
          onadd={() => (editing = { key: 'BEANS', record: newBean(), isNew: true })}
        />
      {/if}
    </Tabs.Content>
    <Tabs.Content value="BREWS">
      <!-- Only the open tab is mounted, so hidden lists cost nothing. -->
      {#if tab === 'BREWS'}
        <BrewList
          brews={records(data, 'BREWS')}
          {names}
          beans={beanOptions}
          methods={methodOptions}
          mills={millOptions}
          onopen={(uuid) => openRecord('BREWS', uuid)}
        />
      {/if}
    </Tabs.Content>
    <Tabs.Content value="MILL">
      <!-- Only the open tab is mounted, so hidden lists cost nothing. -->
      {#if tab === 'MILL'}
        <GearList
          kind="MILL"
          items={records(data, 'MILL')}
          brewCount={(uuid) => brewsUsing(data, 'MILL', uuid)}
          onopen={(uuid) => openRecord('MILL', uuid)}
          onadd={() => (editing = { key: 'MILL', record: newMill(), isNew: true })}
        />
      {/if}
    </Tabs.Content>
    <Tabs.Content value="PREPARATION">
      <!-- Only the open tab is mounted, so hidden lists cost nothing. -->
      {#if tab === 'PREPARATION'}
        <GearList
          kind="PREPARATION"
          items={records(data, 'PREPARATION')}
          brewCount={(uuid) => brewsUsing(data, 'PREPARATION', uuid)}
          onopen={(uuid) => openRecord('PREPARATION', uuid)}
        />
      {/if}
    </Tabs.Content>
  </Tabs.Root>
</div>

{#if editing}
  {@const { key, record, isNew } = editing}
  {@const brews = brewsUsing(data, key, record.config.uuid)}
  {#key record.config.uuid}
    {#if key === 'BEANS'}
      <BeanDialog
        bean={record}
        {isNew}
        {brews}
        {maxRating}
        onsave={saveRecord}
        ondelete={deleteEditing}
        onclose={() => (editing = null)}
      />
    {:else if key === 'BREWS'}
      <BrewDialog
        brew={record}
        beans={beanOptions}
        methods={methodOptions}
        mills={millOptions}
        maxRating={brewMaxRating}
        onsave={saveRecord}
        ondelete={deleteEditing}
        onclose={() => (editing = null)}
      />
    {:else}
      <GearDialog
        kind={key}
        {record}
        {isNew}
        {brews}
        onsave={saveRecord}
        ondelete={deleteEditing}
        onclose={() => (editing = null)}
      />
    {/if}
  {/key}
{/if}
