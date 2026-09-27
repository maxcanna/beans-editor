<script lang="ts">
  import { Archive, ArchiveRestore, Plus, Trash2, TriangleAlert, X } from '@lucide/svelte';
  import { Dialog } from 'bits-ui';
  import { tick } from 'svelte';
  import { m } from '$paraglide/messages';
  import type { BackupRecord } from '../../formats/backup/backup';
  import { BLENDS, ROASTING_TYPES, ROASTS } from '../../formats/backup/enums';
  import { applyBeanForm, beanForm, emptyOrigin, validateBean, type BeanOrigin } from '../../editor/beans';
  import { BLEND_LABELS, ERROR_LABELS, ROAST_LABELS, ROASTING_TYPE_LABELS } from '../../editor/labels';

  interface Props {
    bean: BackupRecord;
    isNew: boolean;
    /** Brews that use this bean; a bean in use can't be deleted. */
    brews: number;
    maxRating: number;
    onsave: (bean: BackupRecord) => void;
    ondelete: () => void;
    onclose: () => void;
  }

  let { bean, isNew, brews, maxRating, onsave, ondelete, onclose }: Props = $props();

  // The dialog is mounted per bean, so the form starts from the bean it was opened with.
  // svelte-ignore state_referenced_locally
  let form = $state(beanForm(bean));
  let submitted = $state(false);
  let confirmingDelete = $state(false);
  const errors = $derived(validateBean(form, maxRating));
  const shown = $derived(submitted ? errors : {});

  const ORIGIN_FIELDS: { key: keyof BeanOrigin; label: () => string }[] = [
    { key: 'country', label: m.origin_country },
    { key: 'region', label: m.origin_region },
    { key: 'farm', label: m.origin_farm },
    { key: 'farmer', label: m.origin_farmer },
    { key: 'elevation', label: m.origin_elevation },
    { key: 'variety', label: m.origin_variety },
    { key: 'processing', label: m.origin_processing },
    { key: 'harvest_time', label: m.origin_harvest_time },
    { key: 'certification', label: m.origin_certification },
  ];

  let formElement: HTMLFormElement;
  let deleteNotice = $state<HTMLElement>();

  function trySave() {
    submitted = true;
    if (Object.keys(errors).length > 0) {
      // Let the error messages render, then move focus to the first one.
      queueMicrotask(() => formElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    onsave(applyBeanForm(bean, $state.snapshot(form)));
  }

  /** Archiving saves the form too, so edits made before it aren't lost. */
  function toggleArchived() {
    form.finished = !form.finished;
    trySave();
  }

  const input =
    'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-accent aria-[invalid=true]:border-danger';
  const labelClass = 'flex flex-col gap-1 text-sm font-medium';
  const button =
    'inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';
</script>

{#snippet error(message: string | undefined, id: string)}
  {#if message}<span {id} class="text-xs font-normal text-danger">{message}</span>{/if}
{/snippet}

<Dialog.Root open onOpenChange={(open) => !open && onclose()}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-40 bg-black/40" />
    <Dialog.Content
      class="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-2xl border border-border bg-surface shadow-xl sm:inset-auto sm:top-1/2 sm:left-1/2 sm:max-h-[88dvh] sm:w-[min(40rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
      data-testid="bean-dialog"
    >
      <header class="flex items-center gap-3 border-b border-border px-5 py-4">
        <Dialog.Title class="flex-1 text-lg font-semibold">
          {isNew ? m.bean_new_title() : m.bean_edit_title()}
        </Dialog.Title>
        <Dialog.Close
          class="rounded-full p-1.5 text-muted hover:bg-border/50 focus-visible:outline-2 focus-visible:outline-accent"
          aria-label={m.bean_cancel()}
        >
          <X class="size-5" aria-hidden="true" />
        </Dialog.Close>
      </header>

      <form
        bind:this={formElement}
        id="bean-form"
        class="flex-1 space-y-6 overflow-y-auto px-5 py-5"
        novalidate
        onsubmit={(event) => {
          event.preventDefault();
          trySave();
        }}
      >
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="{labelClass} sm:col-span-2">
            {m.bean_name()}
            <input
              class={input}
              bind:value={form.name}
              required
              aria-invalid={shown.name ? 'true' : undefined}
              aria-describedby={shown.name ? 'err-name' : undefined}
            />
            {@render error(shown.name && ERROR_LABELS[shown.name](), 'err-name')}
          </label>
          <label class={labelClass}>
            {m.bean_roaster()}
            <input class={input} bind:value={form.roaster} />
          </label>
          <label class={labelClass}>
            {m.bean_roast_date()}
            <input class={input} type="date" bind:value={form.roastingDate} />
          </label>
          <label class={labelClass}>
            {m.bean_roasting_type()}
            <select class={input} bind:value={form.bean_roasting_type}>
              {#each Object.keys(ROASTING_TYPES) as code (code)}
                <option value={code}>{ROASTING_TYPE_LABELS[code as keyof typeof ROASTING_TYPES]()}</option>
              {/each}
            </select>
          </label>
          <label class={labelClass}>
            {m.bean_roast()}
            <select class={input} bind:value={form.roast}>
              {#each Object.keys(ROASTS) as code (code)}
                <option value={code}>{ROAST_LABELS[code as keyof typeof ROASTS]()}</option>
              {/each}
            </select>
          </label>
          {#if form.roast === 'CUSTOM_ROAST'}
            <label class={labelClass}>
              {m.bean_roast_custom()}
              <input class={input} bind:value={form.roast_custom} />
            </label>
          {/if}
          <label class={labelClass}>
            {m.bean_blend()}
            <select class={input} bind:value={form.beanMix}>
              {#each Object.keys(BLENDS) as code (code)}
                <option value={code}>{BLEND_LABELS[code as keyof typeof BLENDS]()}</option>
              {/each}
            </select>
          </label>
          <label class={labelClass}>
            {m.bean_weight()}
            <input
              class={input}
              type="number"
              min="0"
              step="any"
              inputmode="decimal"
              bind:value={form.weight}
              aria-invalid={shown.weight ? 'true' : undefined}
              aria-describedby={shown.weight ? 'err-weight' : undefined}
            />
            {@render error(shown.weight && ERROR_LABELS[shown.weight](), 'err-weight')}
          </label>
          <label class={labelClass}>
            {m.bean_cost()}
            <input
              class={input}
              type="number"
              min="0"
              step="any"
              inputmode="decimal"
              bind:value={form.cost}
              aria-invalid={shown.cost ? 'true' : undefined}
              aria-describedby={shown.cost ? 'err-cost' : undefined}
            />
            {@render error(shown.cost && ERROR_LABELS[shown.cost](), 'err-cost')}
          </label>
          <label class={labelClass}>
            {m.bean_rating({ max: maxRating })}
            <input
              class={input}
              type="number"
              min="0"
              max={maxRating}
              step="any"
              inputmode="decimal"
              bind:value={form.rating}
              aria-invalid={shown.rating ? 'true' : undefined}
              aria-describedby={shown.rating ? 'err-rating' : undefined}
            />
            {@render error(shown.rating && ERROR_LABELS[shown.rating](), 'err-rating')}
          </label>
          <label class={labelClass}>
            {m.bean_aromatics()}
            <input class={input} bind:value={form.aromatics} />
          </label>
          <label class={labelClass}>
            {m.bean_cupping_points()}
            <input class={input} bind:value={form.cupping_points} />
          </label>
          <label class={labelClass}>
            {m.bean_url()}
            <input class={input} type="url" inputmode="url" bind:value={form.url} />
          </label>
          <label class={labelClass}>
            {m.bean_ean()}
            <input class={input} bind:value={form.ean_article_number} />
          </label>
          <label class="{labelClass} sm:col-span-2">
            {m.bean_note()}
            <textarea class="{input} min-h-20" bind:value={form.note}></textarea>
          </label>
          <label class="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" class="size-4 accent-accent" bind:checked={form.decaffeinated} />
            {m.bean_decaffeinated()}
          </label>
        </div>

        <fieldset class="space-y-3" aria-describedby={shown.bean_information ? 'err-origins' : undefined}>
          <legend class="text-sm font-semibold">{m.bean_origins()}</legend>
          {@render error(shown.bean_information && ERROR_LABELS[shown.bean_information](), 'err-origins')}
          {#each form.bean_information as origin, i (i)}
            <div class="space-y-3 rounded-xl border border-border p-4" data-testid="origin">
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-medium">{m.bean_origin_n({ n: i + 1 })}</h3>
                <button
                  type="button"
                  class="rounded-full p-1 text-muted hover:bg-border/50 focus-visible:outline-2 focus-visible:outline-accent"
                  aria-label={m.bean_origin_remove({ n: i + 1 })}
                  onclick={() => form.bean_information.splice(i, 1)}
                >
                  <X class="size-4" aria-hidden="true" />
                </button>
              </div>
              <div class="grid gap-3 sm:grid-cols-3">
                {#each ORIGIN_FIELDS as field (field.key)}
                  <label class={labelClass}>
                    {field.label()}
                    <input class={input} bind:value={origin[field.key]} />
                  </label>
                {/each}
                <label class={labelClass}>
                  {m.origin_percentage()}
                  <input
                    class={input}
                    type="number"
                    min="0"
                    max="100"
                    step="any"
                    inputmode="decimal"
                    bind:value={origin.percentage}
                  />
                </label>
              </div>
            </div>
          {/each}
          <button
            type="button"
            class="{button} border border-border hover:bg-border/40"
            onclick={() => form.bean_information.push(emptyOrigin())}
          >
            <Plus class="size-4" aria-hidden="true" />
            {m.bean_origin_add()}
          </button>
        </fieldset>

        {#if confirmingDelete}
          <div
            bind:this={deleteNotice}
            role="alert"
            class="flex gap-3 rounded-xl border border-danger/40 bg-danger/5 p-4 text-sm"
          >
            <TriangleAlert class="size-5 shrink-0 text-danger" aria-hidden="true" />
            <div class="space-y-3">
              {#if brews > 0}
                <p>{m.bean_delete_blocked({ count: brews })}</p>
                {#if !form.finished}
                  <button
                    type="button"
                    class="{button} border border-border bg-surface hover:bg-border/40"
                    onclick={toggleArchived}
                  >
                    <Archive class="size-4" aria-hidden="true" />
                    {m.bean_archive()}
                  </button>
                {/if}
              {:else}
                <p>{m.bean_delete_confirm()}</p>
                <button
                  type="button"
                  class="{button} bg-danger text-accent-fg hover:bg-danger/90"
                  onclick={ondelete}
                >
                  <Trash2 class="size-4" aria-hidden="true" />
                  {m.bean_delete()}
                </button>
              {/if}
            </div>
          </div>
        {/if}
      </form>

      <footer class="flex items-center gap-1 border-t border-border px-3 py-3 sm:gap-2 sm:px-5 sm:py-4">
        {#if !isNew}
          <button
            type="button"
            class="{button} text-danger hover:bg-danger/10"
            onclick={async () => {
              confirmingDelete = true;
              await tick();
              deleteNotice?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }}
          >
            <Trash2 class="size-4" aria-hidden="true" />
            <span class="max-sm:sr-only">{m.bean_delete()}</span>
          </button>
          <button type="button" class="{button} hover:bg-border/40" onclick={toggleArchived}>
            {#if form.finished}
              <ArchiveRestore class="size-4" aria-hidden="true" />
              <span class="max-sm:sr-only">{m.bean_unarchive()}</span>
            {:else}
              <Archive class="size-4" aria-hidden="true" />
              <span class="max-sm:sr-only">{m.bean_archive()}</span>
            {/if}
          </button>
        {/if}
        <span class="flex-1"></span>
        <Dialog.Close class="{button} hover:bg-border/40">{m.bean_cancel()}</Dialog.Close>
        <button type="submit" form="bean-form" class="{button} bg-accent text-accent-fg hover:bg-accent/90">
          {m.bean_save()}
        </button>
      </footer>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
