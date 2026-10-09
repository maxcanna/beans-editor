<script lang="ts">
  import { Archive, ArchiveRestore, Trash2 } from '@lucide/svelte';
  import { m } from '$paraglide/messages';
  import type { BackupRecord } from '../../formats/backup/schema';
  import { applyGearForm, gearForm, type GearKey } from '../../editor/gear';
  import { ERROR_LABELS } from '../../editor/labels';
  import ConfirmDelete from './ConfirmDelete.svelte';
  import SheetDialog from './SheetDialog.svelte';
  import { buttonClass, inputClass, labelClass } from './styles';

  interface Props {
    kind: GearKey;
    record: BackupRecord;
    brews: number;
    onsave: (record: BackupRecord) => void;
    ondelete: () => void;
    onclose: () => void;
  }

  let { kind, record, brews, onsave, ondelete, onclose }: Props = $props();

  // Mounted per record, so the form starts from the record it was opened with.
  // svelte-ignore state_referenced_locally
  let form = $state(gearForm(record));
  let submitted = $state(false);
  let confirmingDelete = $state(false);
  const initial = JSON.stringify(form);
  const dirty = $derived(JSON.stringify(form) !== initial);
  const nameError = $derived(submitted && form.name.trim() === '' ? ERROR_LABELS.required() : undefined);

  let nameInput = $state<HTMLInputElement>();
  const title = $derived(kind === 'PREPARATION' ? m.gear_edit_method() : m.gear_edit_grinder());

  function save() {
    submitted = true;
    if (form.name.trim() === '') {
      queueMicrotask(() => nameInput?.focus());
      return;
    }
    onsave(applyGearForm(record, $state.snapshot(form)));
  }

  function toggleArchived() {
    form.finished = !form.finished;
    save();
  }
</script>

<SheetDialog
  {title}
  testid="gear-dialog"
  formId="gear-form"
  onsubmit={save}
  {onclose}
  {dirty}
  busy={confirmingDelete}
>
  <label class={labelClass}>
    {m.gear_name()}
    <input
      bind:this={nameInput}
      class={inputClass}
      bind:value={form.name}
      required
      aria-invalid={nameError ? 'true' : undefined}
      aria-describedby={nameError ? 'err-gear-name' : undefined}
    />
    {#if nameError}<span id="err-gear-name" class="text-xs font-normal text-danger">{nameError}</span>{/if}
  </label>
  <label class={labelClass}>
    {m.gear_note()}
    <textarea class="{inputClass} min-h-20" bind:value={form.note}></textarea>
  </label>
  {#if confirmingDelete}
    <ConfirmDelete
      blocked={brews > 0 ? m.gear_delete_blocked({ count: brews }) : undefined}
      confirm={m.gear_delete_confirm()}
      onarchive={form.finished ? undefined : toggleArchived}
      {ondelete}
      oncancel={() => (confirmingDelete = false)}
    />
  {/if}

  {#snippet footer()}
    <button
      type="button"
      class="{buttonClass} text-danger hover:bg-danger/10"
      onclick={() => (confirmingDelete = true)}
    >
      <Trash2 class="size-4" aria-hidden="true" />
      <span class="max-sm:sr-only">{m.bean_delete()}</span>
    </button>
    <button type="button" class="{buttonClass} hover:bg-border/40" onclick={toggleArchived}>
      {#if form.finished}
        <ArchiveRestore class="size-4" aria-hidden="true" />
        <span class="max-sm:sr-only">{m.bean_unarchive()}</span>
      {:else}
        <Archive class="size-4" aria-hidden="true" />
        <span class="max-sm:sr-only">{m.bean_archive()}</span>
      {/if}
    </button>
    <span class="flex-1"></span>
  {/snippet}
</SheetDialog>
