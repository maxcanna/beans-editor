<script lang="ts">
  import { CircleCheck, Download, FileArchive, Share2, X } from '@lucide/svelte';
  import { m } from '$paraglide/messages';
  import { writeBackup, type BackupRecord } from '../../formats/backup/backup';
  import { newBean } from '../../editor/beans';
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

  /** The bean in the dialog: an existing one by uuid, or a new unsaved one. */
  // Raw, so the record stays a plain object that IndexedDB can store.
  let editing = $state.raw<{ bean: BackupRecord; isNew: boolean } | null>(null);
  const shareable = canShareFiles();

  function openBean(uuid: string) {
    const bean = findRecord(data, 'BEANS', uuid);
    if (bean) editing = { bean, isNew: false };
  }

  function saveBean(bean: BackupRecord) {
    const isNew = editing?.isNew;
    session.update((d) => (isNew ? addRecord(d, 'BEANS', bean) : replaceRecord(d, 'BEANS', bean)));
    editing = null;
  }

  function deleteBean() {
    if (!editing) return;
    const uuid = editing.bean.config.uuid;
    const result = deleteRecord(data, 'BEANS', uuid);
    if (result.ok) {
      session.update(() => result.data);
      editing = null;
    }
  }

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
    <div class="min-w-0 flex-1">
      <h2 class="truncate font-semibold">{session.fileName}</h2>
      <p class="text-sm text-muted">
        {m.editor_counts({
          beans: beans.length,
          brews: count('BREWS'),
          grinders: count('MILL'),
          methods: count('PREPARATION'),
        })}
      </p>
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
    <div class="flex flex-wrap items-center gap-2">
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

  <BeanList
    {beans}
    brewCount={(uuid) => brewsUsing(data, 'BEANS', uuid)}
    onopen={openBean}
    onadd={() => (editing = { bean: newBean(), isNew: true })}
  />
</div>

{#if editing}
  {#key editing.bean.config.uuid}
    <BeanDialog
      bean={editing.bean}
      isNew={editing.isNew}
      brews={brewsUsing(data, 'BEANS', editing.bean.config.uuid)}
      {maxRating}
      onsave={saveBean}
      ondelete={deleteBean}
      onclose={() => (editing = null)}
    />
  {/key}
{/if}
