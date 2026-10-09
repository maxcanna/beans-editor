<script lang="ts">
  import { Plus, X } from '@lucide/svelte';
  import { m } from '$paraglide/messages';
  import { BLENDS, FREEZING_STORAGES, ROASTING_TYPES, ROASTS } from '../../formats/backup/enums';
  import { emptyOrigin, type BeanErrors, type BeanForm, type BeanOrigin } from '../../editor/beans';
  import {
    BLEND_LABELS,
    ERROR_LABELS,
    FREEZING_STORAGE_LABELS,
    ROAST_LABELS,
    ROASTING_TYPE_LABELS,
  } from '../../editor/labels';
  import { buttonClass, inputClass, labelClass } from './styles';

  interface Props {
    form: BeanForm;
    /**
     * `backup`: every field. `share`: only what a link to Beanconqueror can
     * carry, which leaves out the buy date, best before date, freezing and rating.
     */
    mode: 'backup' | 'share';
    /** The errors to show next to their fields. */
    errors: BeanErrors;
    maxRating: number;
  }

  let { form = $bindable(), mode, errors, maxRating }: Props = $props();

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
  const PRICE_FIELDS: { key: 'purchasing_price' | 'fob_price'; label: () => string }[] = [
    { key: 'purchasing_price', label: m.origin_purchasing_price },
    { key: 'fob_price', label: m.origin_fob_price },
  ];
</script>

{#snippet error(message: string | undefined, id: string)}
  {#if message}<span {id} class="text-xs font-normal text-danger">{message}</span>{/if}
{/snippet}

<!-- A link carries whole numbers only (BeanProto's uint fields), so say so rather than round without a word. -->
{#snippet rounded(value: number | null)}
  {#if mode === 'share' && value !== null && value > 0 && !Number.isInteger(value)}
    <span class="text-xs font-normal text-muted">{m.link_rounded({ value: Math.round(value) })}</span>
  {/if}
{/snippet}

<div class="grid gap-4 sm:grid-cols-2">
  <label class="{labelClass} sm:col-span-2">
    {m.bean_name()}
    <input
      class={inputClass}
      bind:value={form.name}
      required
      aria-invalid={errors.name ? 'true' : undefined}
      aria-describedby={errors.name ? 'err-name' : undefined}
    />
    {@render error(errors.name && ERROR_LABELS[errors.name](), 'err-name')}
  </label>
  <label class={labelClass}>
    {m.bean_roaster()}
    <input class={inputClass} bind:value={form.roaster} />
  </label>
  <label class={labelClass}>
    {m.bean_roasting_type()}
    <select class={inputClass} bind:value={form.bean_roasting_type}>
      {#each Object.keys(ROASTING_TYPES) as code (code)}
        <option value={code}>{ROASTING_TYPE_LABELS[code as keyof typeof ROASTING_TYPES]()}</option>
      {/each}
    </select>
  </label>
  <label class={labelClass}>
    {m.bean_roast()}
    <select class={inputClass} bind:value={form.roast}>
      {#each Object.keys(ROASTS) as code (code)}
        <option value={code}>{ROAST_LABELS[code as keyof typeof ROASTS]()}</option>
      {/each}
    </select>
  </label>
  {#if form.roast === 'CUSTOM_ROAST'}
    <label class={labelClass}>
      {m.bean_roast_custom()}
      <input class={inputClass} bind:value={form.roast_custom} />
    </label>
  {/if}
  <label class={labelClass}>
    {m.bean_blend()}
    <select class={inputClass} bind:value={form.beanMix}>
      {#each Object.keys(BLENDS) as code (code)}
        <option value={code}>{BLEND_LABELS[code as keyof typeof BLENDS]()}</option>
      {/each}
    </select>
  </label>
  <label class={labelClass}>
    {m.bean_weight()}
    <input
      class={inputClass}
      type="number"
      min="0"
      step="any"
      inputmode="decimal"
      bind:value={form.weight}
      aria-invalid={errors.weight ? 'true' : undefined}
      aria-describedby={errors.weight ? 'err-weight' : undefined}
    />
    {@render error(errors.weight && ERROR_LABELS[errors.weight](), 'err-weight')}
    {@render rounded(form.weight)}
  </label>
  <label class={labelClass}>
    {m.bean_cost()}
    <input
      class={inputClass}
      type="number"
      min="0"
      step="any"
      inputmode="decimal"
      bind:value={form.cost}
      aria-invalid={errors.cost ? 'true' : undefined}
      aria-describedby={errors.cost ? 'err-cost' : undefined}
    />
    {@render error(errors.cost && ERROR_LABELS[errors.cost](), 'err-cost')}
    {@render rounded(form.cost)}
  </label>
  {#if mode === 'backup'}
    <label class={labelClass}>
      {m.bean_rating({ max: maxRating })}
      <input
        class={inputClass}
        type="number"
        min="0"
        max={maxRating}
        step="any"
        inputmode="decimal"
        bind:value={form.rating}
        aria-invalid={errors.rating ? 'true' : undefined}
        aria-describedby={errors.rating ? 'err-rating' : undefined}
      />
      {@render error(errors.rating && ERROR_LABELS[errors.rating](), 'err-rating')}
    </label>
  {/if}
  <label class={labelClass}>
    {m.bean_aromatics()}
    <input class={inputClass} bind:value={form.aromatics} />
  </label>
  <label class={labelClass}>
    {m.bean_cupping_points()}
    <input class={inputClass} bind:value={form.cupping_points} />
  </label>
  <label class={labelClass}>
    {m.bean_url()}
    <input class={inputClass} type="url" inputmode="url" bind:value={form.url} />
  </label>
  <label class={labelClass}>
    {m.bean_ean()}
    <input class={inputClass} bind:value={form.ean_article_number} />
  </label>
  <label class="flex items-center gap-2 text-sm font-medium">
    <input type="checkbox" class="size-4 accent-accent" bind:checked={form.decaffeinated} />
    {m.bean_decaffeinated()}
  </label>
</div>

<fieldset class="grid gap-4 sm:grid-cols-2">
  <legend class="mb-2 text-sm font-semibold">{m.bean_dates()}</legend>
  <label class={labelClass}>
    {m.bean_roast_date()}
    <input class={inputClass} type="date" bind:value={form.roastingDate} />
  </label>
  {#if mode === 'backup'}
    <label class={labelClass}>
      {m.bean_buy_date()}
      <input class={inputClass} type="date" bind:value={form.buyDate} />
    </label>
    <label class={labelClass}>
      {m.bean_best_date()}
      <input class={inputClass} type="date" bind:value={form.bestDate} />
    </label>
  {:else}
    <p class="text-sm text-muted sm:col-span-2" data-testid="backup-only-fields">
      {m.link_backup_only_fields()}
    </p>
  {/if}
</fieldset>

{#if mode === 'backup'}
  <fieldset class="grid gap-4 sm:grid-cols-2">
    <legend class="mb-2 text-sm font-semibold">{m.bean_freezing()}</legend>
    <label class={labelClass}>
      {m.bean_frozen_date()}
      <input class={inputClass} type="date" bind:value={form.frozenDate} />
    </label>
    <label class={labelClass}>
      {m.bean_unfrozen_date()}
      <input class={inputClass} type="date" bind:value={form.unfrozenDate} />
    </label>
    <label class="{labelClass} sm:col-span-2">
      {m.bean_frozen_storage()}
      <select class={inputClass} bind:value={form.frozenStorageType}>
        {#each Object.keys(FREEZING_STORAGES) as code (code)}
          <option value={code}>{FREEZING_STORAGE_LABELS[code as keyof typeof FREEZING_STORAGES]()}</option>
        {/each}
      </select>
    </label>
    <label class="{labelClass} sm:col-span-2">
      {m.bean_frozen_note()}
      <textarea class="{inputClass} min-h-16" bind:value={form.frozenNote}></textarea>
    </label>
  </fieldset>
{/if}

<fieldset class="space-y-3" aria-describedby={errors.bean_information ? 'err-origins' : undefined}>
  <legend class="text-sm font-semibold">{m.bean_origins()}</legend>
  {@render error(errors.bean_information && ERROR_LABELS[errors.bean_information](), 'err-origins')}
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
            <input class={inputClass} bind:value={origin[field.key]} />
          </label>
        {/each}
        <label class={labelClass}>
          {m.origin_percentage()}
          <input
            class={inputClass}
            type="number"
            min="0"
            max="100"
            step="any"
            inputmode="decimal"
            bind:value={origin.percentage}
          />
        </label>
        {#each PRICE_FIELDS as field (field.key)}
          <label class={labelClass}>
            {field.label()}
            <input
              class={inputClass}
              type="number"
              min="0"
              step="any"
              inputmode="decimal"
              bind:value={origin[field.key]}
            />
          </label>
        {/each}
      </div>
    </div>
  {/each}
  <button
    type="button"
    class="{buttonClass} border border-border hover:bg-border/40"
    onclick={() => form.bean_information.push(emptyOrigin())}
  >
    <Plus class="size-4" aria-hidden="true" />
    {m.bean_origin_add()}
  </button>
</fieldset>

<label class={labelClass}>
  {m.bean_note()}
  <textarea class="{inputClass} min-h-20" bind:value={form.note}></textarea>
</label>
