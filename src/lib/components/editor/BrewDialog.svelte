<script lang="ts">
  import { Trash2 } from '@lucide/svelte';
  import { m } from '$paraglide/messages';
  import type { BackupRecord } from '../../formats/backup/schema';
  import { applyBrewForm, brewForm, validateBrew, type BrewForm } from '../../editor/brews';
  import { ERROR_LABELS } from '../../editor/labels';
  import ConfirmDelete from './ConfirmDelete.svelte';
  import SheetDialog from './SheetDialog.svelte';
  import { buttonClass, inputClass, labelClass } from './styles';

  interface Option {
    uuid: string;
    name: string;
  }

  interface Props {
    brew: BackupRecord;
    beans: readonly Option[];
    methods: readonly Option[];
    mills: readonly Option[];
    maxRating: number;
    onsave: (brew: BackupRecord) => void;
    ondelete: () => void;
    onclose: () => void;
  }

  let { brew, beans, methods, mills, maxRating, onsave, ondelete, onclose }: Props = $props();

  // Mounted per brew, so the form starts from the brew it was opened with.
  // svelte-ignore state_referenced_locally
  let form = $state(brewForm(brew));
  let submitted = $state(false);
  let confirmingDelete = $state(false);
  const initial = JSON.stringify(form);
  const dirty = $derived(JSON.stringify(form) !== initial);
  let formRoot = $state<HTMLElement>();
  const errors = $derived(validateBrew(form, maxRating));
  const shown = $derived(submitted ? errors : {});

  function save() {
    submitted = true;
    if (Object.keys(errors).length > 0) {
      queueMicrotask(() => formRoot?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    onsave(applyBrewForm(brew, $state.snapshot(form)));
  }

  type NumberKey = {
    [K in keyof BrewForm]: BrewForm[K] extends number | null ? K : never;
  }[keyof BrewForm];

  const NUMBERS: { key: NumberKey; label: () => string }[] = [
    { key: 'grind_weight', label: m.brew_grind_weight },
    { key: 'brew_quantity', label: m.brew_quantity },
    { key: 'brew_beverage_quantity', label: m.brew_beverage_quantity },
    { key: 'brew_temperature', label: m.brew_temperature },
    { key: 'brew_time', label: m.brew_time },
    { key: 'tds', label: m.brew_tds },
    { key: 'rating', label: () => m.brew_rating({ max: maxRating }) },
  ];

  const SELECTS: {
    key: 'bean' | 'method_of_preparation' | 'mill';
    label: () => string;
    options: () => readonly Option[];
  }[] = [
    { key: 'bean', label: m.brews_filter_bean, options: () => beans },
    { key: 'method_of_preparation', label: m.brews_filter_method, options: () => methods },
    { key: 'mill', label: m.brews_filter_grinder, options: () => mills },
  ];
</script>

<SheetDialog
  title={m.brew_edit_title()}
  testid="brew-dialog"
  formId="brew-form"
  onsubmit={save}
  {onclose}
  {dirty}
  busy={confirmingDelete}
>
  <div bind:this={formRoot} class="grid gap-4 sm:grid-cols-2">
    <label class="{labelClass} sm:col-span-2">
      {m.brew_when()}
      <input
        class={inputClass}
        type="datetime-local"
        bind:value={form.when}
        aria-invalid={shown.when ? 'true' : undefined}
        aria-describedby={shown.when ? 'err-brew-when' : undefined}
      />
      {#if shown.when}<span id="err-brew-when" class="text-xs font-normal text-danger"
          >{ERROR_LABELS[shown.when]()}</span
        >{/if}
    </label>
    {#each SELECTS as select (select.key)}
      {@const options = select.options()}
      <label class={labelClass}>
        {select.label()}
        <select class={inputClass} bind:value={form[select.key]}>
          <option value="">{m.brews_none()}</option>
          {#if form[select.key] && !options.some((o) => o.uuid === form[select.key])}
            <!-- A reference to a record this backup doesn't have: keep it selectable, never drop it. -->
            <option value={form[select.key]}>{m.brews_missing()}</option>
          {/if}
          {#each options as option (option.uuid)}
            <option value={option.uuid}>{option.name}</option>
          {/each}
        </select>
      </label>
    {/each}
    <label class={labelClass}>
      {m.brew_grind_size()}
      <input class={inputClass} bind:value={form.grind_size} />
    </label>
    {#each NUMBERS as field (field.key)}
      {@const error = shown[field.key]}
      <label class={labelClass}>
        {field.label()}
        <input
          class={inputClass}
          type="number"
          min="0"
          step="any"
          inputmode="decimal"
          bind:value={form[field.key]}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `err-brew-${field.key}` : undefined}
        />
        {#if error}
          <span id="err-brew-{field.key}" class="text-xs font-normal text-danger"
            >{ERROR_LABELS[error]()}</span
          >
        {/if}
      </label>
    {/each}
    <label class="{labelClass} sm:col-span-2">
      {m.brew_note()}
      <textarea class="{inputClass} min-h-20" bind:value={form.note}></textarea>
    </label>
  </div>
  {#if confirmingDelete}
    <ConfirmDelete confirm={m.brew_delete_confirm()} {ondelete} oncancel={() => (confirmingDelete = false)} />
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
    <span class="flex-1"></span>
  {/snippet}
</SheetDialog>
