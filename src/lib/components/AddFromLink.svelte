<script lang="ts">
  import { CircleCheck, ExternalLink, LoaderCircle, TriangleAlert, X } from '@lucide/svelte';
  import { Dialog } from 'bits-ui';
  import { m } from '$paraglide/messages';
  import { beanLink, findSharedUrl, nameFromUrl, type SharedBean } from '../beanlink/bean-link';
  import { ROASTING_TYPES, type RoastingType } from '../formats/backup/enums';
  import { ROASTING_TYPE_LABELS } from '../editor/labels';
  import { ReadError, readBean } from '../extract/read';
  import { buttonClass, inputClass, labelClass, primaryButtonClass } from './editor/styles';

  interface Props {
    onclose: () => void;
  }

  let { onclose }: Props = $props();

  /** The review form: every field a plain string, so inputs can bind to it. */
  interface Form {
    name: string;
    roaster: string;
    roastingType: RoastingType;
    weight: string;
    cost: string;
    aromatics: string;
    decaffeinated: boolean;
    url: string;
    ean: string;
    note: string;
    country: string;
    region: string;
    farm: string;
    farmer: string;
    elevation: string;
    variety: string;
    processing: string;
  }
  type OriginKey = 'country' | 'region' | 'farm' | 'farmer' | 'elevation' | 'variety' | 'processing';

  let step = $state<'link' | 'reading' | 'review'>('link');
  let input = $state('');
  let error = $state<string | null>(null);
  let online = $state(navigator.onLine);
  let form = $state<Form | null>(null);
  let controller: AbortController | undefined;

  function toForm(bean: SharedBean): Form {
    const origin = bean.bean_information?.[0] ?? {};
    return {
      name: bean.name,
      roaster: bean.roaster ?? '',
      roastingType: bean.bean_roasting_type ?? 'UNKNOWN',
      weight: bean.weight?.toString() ?? '',
      cost: bean.cost?.toString() ?? '',
      aromatics: bean.aromatics ?? '',
      decaffeinated: bean.decaffeinated ?? false,
      url: bean.url ?? '',
      ean: bean.ean_article_number ?? '',
      note: bean.note ?? '',
      country: origin.country ?? '',
      region: origin.region ?? '',
      farm: origin.farm ?? '',
      farmer: origin.farmer ?? '',
      elevation: origin.elevation ?? '',
      variety: origin.variety ?? '',
      processing: origin.processing ?? '',
    };
  }

  function toBean(f: Form): SharedBean {
    const num = (text: string) => {
      const value = parseFloat(text.replace(',', '.'));
      return Number.isFinite(value) && value > 0 ? value : undefined;
    };
    const origin = Object.fromEntries(
      ORIGIN_FIELDS.map(({ key }) => [key, f[key].trim()]).filter(([, v]) => v),
    );
    const bean: SharedBean = {
      name: f.name.trim(),
      roaster: f.roaster.trim() || undefined,
      bean_roasting_type: f.roastingType === 'UNKNOWN' ? undefined : f.roastingType,
      weight: num(f.weight),
      cost: num(f.cost),
      aromatics: f.aromatics.trim() || undefined,
      decaffeinated: f.decaffeinated || undefined,
      url: f.url.trim() || undefined,
      ean_article_number: f.ean.trim() || undefined,
      note: f.note.trim() || undefined,
    };
    if (Object.keys(origin).length > 0) bean.bean_information = [origin];
    return bean;
  }

  /** What happened after "Open in Beanconqueror": the page is hidden when the app takes over. */
  let opening = $state<'waiting' | 'opened' | 'not-opened' | null>(null);
  let openTimer: ReturnType<typeof setTimeout> | undefined;

  function onOpen() {
    clearTimeout(openTimer);
    opening = 'waiting';
    openTimer = setTimeout(() => {
      if (opening === 'waiting') opening = 'not-opened';
    }, 3000);
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'hidden' && opening === 'waiting') {
      clearTimeout(openTimer);
      opening = 'opened';
    }
  }

  const link = $derived(form && form.name.trim() ? beanLink(toBean(form)) : undefined);

  async function read(text = input) {
    const url = findSharedUrl(text);
    if (!url) {
      error = m.link_invalid();
      return;
    }
    error = null;
    step = 'reading';
    controller = new AbortController();
    try {
      form = toForm(await readBean(url, fetch, controller.signal));
      step = 'review';
    } catch (e) {
      if (controller.signal.aborted) return;
      step = 'link';
      error =
        e instanceof ReadError && e.kind === 'dead'
          ? m.link_dead()
          : e instanceof ReadError && e.kind === 'rate-limited'
            ? m.link_rate_limited()
            : m.link_unreachable();
    }
  }

  /** Stops reading, or skips it: the form opens with what the link itself says. */
  function fillByHand() {
    controller?.abort();
    const url = findSharedUrl(input);
    form = toForm(url ? { name: nameFromUrl(url), url: url.href } : { name: '' });
    error = null;
    step = 'review';
  }

  function onpaste(event: ClipboardEvent) {
    const text = event.clipboardData?.getData('text') ?? '';
    if (online && findSharedUrl(text)) {
      event.preventDefault();
      input = text.trim();
      void read(text);
    }
  }

  const ORIGIN_FIELDS: { key: OriginKey; label: () => string }[] = [
    { key: 'country', label: m.origin_country },
    { key: 'region', label: m.origin_region },
    { key: 'farm', label: m.origin_farm },
    { key: 'farmer', label: m.origin_farmer },
    { key: 'elevation', label: m.origin_elevation },
    { key: 'variety', label: m.origin_variety },
    { key: 'processing', label: m.origin_processing },
  ];
</script>

<svelte:window onoffline={() => (online = false)} ononline={() => (online = true)} />
<svelte:document onvisibilitychange={onVisibilityChange} />

<Dialog.Root open onOpenChange={(open) => !open && (controller?.abort(), onclose())}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-40 bg-black/40" />
    <Dialog.Content
      class="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-2xl border border-border bg-surface shadow-xl sm:inset-auto sm:top-1/2 sm:left-1/2 sm:max-h-[88dvh] sm:w-[min(40rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
      data-testid="add-from-link"
    >
      <header class="flex items-center gap-3 border-b border-border px-5 py-4">
        <Dialog.Title class="flex-1 text-lg font-semibold">{m.link_title()}</Dialog.Title>
        <Dialog.Close
          class="rounded-full p-1.5 text-muted hover:bg-border/50 focus-visible:outline-2 focus-visible:outline-accent"
          aria-label={m.bean_cancel()}
        >
          <X class="size-5" aria-hidden="true" />
        </Dialog.Close>
      </header>

      {#if step !== 'review'}
        <form
          class="flex-1 space-y-4 overflow-y-auto px-5 py-5"
          novalidate
          onsubmit={(event) => {
            event.preventDefault();
            void read();
          }}
        >
          <Dialog.Description class="text-sm text-muted">{m.link_intro()}</Dialog.Description>
          <label class={labelClass}>
            {m.link_label()}
            <input
              class={inputClass}
              type="url"
              inputmode="url"
              autocomplete="off"
              placeholder="https://"
              bind:value={input}
              {onpaste}
              disabled={step === 'reading'}
              aria-invalid={error ? 'true' : undefined}
              aria-describedby={error ? 'link-error' : undefined}
            />
          </label>
          {#if error}
            <p id="link-error" role="alert" class="flex items-start gap-2 text-sm text-danger">
              <TriangleAlert class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          {/if}
          {#if !online}
            <p role="status" class="text-sm text-muted">{m.link_offline()}</p>
          {/if}
          {#if step === 'reading'}
            <p role="status" class="flex items-center gap-2 text-sm text-muted" data-testid="link-reading">
              <LoaderCircle class="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              {m.link_reading()}
            </p>
          {/if}
        </form>
        <footer
          class="flex flex-wrap items-center justify-end gap-2 border-t border-border px-3 py-3 sm:px-5 sm:py-4"
        >
          <button type="button" class="{buttonClass} hover:bg-border/40" onclick={fillByHand}>
            {step === 'reading' ? m.link_skip() : m.link_by_hand()}
          </button>
          <button
            type="button"
            class={primaryButtonClass}
            disabled={!online || step === 'reading' || !input.trim()}
            onclick={() => read()}
          >
            {m.link_read()}
          </button>
        </footer>
      {:else if form}
        <form
          class="flex-1 space-y-6 overflow-y-auto px-5 py-5"
          novalidate
          onsubmit={(e) => e.preventDefault()}
        >
          <Dialog.Description class="text-sm text-muted"
            >{m.link_review()} {m.link_backup_untouched()}</Dialog.Description
          >
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="{labelClass} sm:col-span-2">
              {m.bean_name()}
              <input
                class={inputClass}
                bind:value={form.name}
                required
                aria-invalid={!form.name.trim() || undefined}
              />
            </label>
            <label class={labelClass}>
              {m.bean_roaster()}
              <input class={inputClass} bind:value={form.roaster} />
            </label>
            <label class={labelClass}>
              {m.bean_roasting_type()}
              <select class={inputClass} bind:value={form.roastingType}>
                {#each Object.keys(ROASTING_TYPES) as RoastingType[] as type (type)}
                  <option value={type}>{ROASTING_TYPE_LABELS[type]()}</option>
                {/each}
              </select>
            </label>
            <label class={labelClass}>
              {m.bean_weight()}
              <input class={inputClass} inputmode="decimal" bind:value={form.weight} />
            </label>
            <label class={labelClass}>
              {m.bean_cost()}
              <input class={inputClass} inputmode="decimal" bind:value={form.cost} />
            </label>
            <label class="{labelClass} sm:col-span-2">
              {m.bean_aromatics()}
              <input class={inputClass} bind:value={form.aromatics} />
            </label>
            <label class="{labelClass} sm:col-span-2">
              {m.bean_url()}
              <input class={inputClass} type="url" bind:value={form.url} />
            </label>
            <label class={labelClass}>
              {m.bean_ean()}
              <input class={inputClass} bind:value={form.ean} />
            </label>
            <label class="flex items-center gap-2 self-end pb-2 text-sm font-medium">
              <input type="checkbox" class="size-4 accent-accent" bind:checked={form.decaffeinated} />
              {m.bean_decaffeinated()}
            </label>
          </div>
          <fieldset class="grid gap-4 sm:grid-cols-2">
            <legend class="mb-2 text-sm font-semibold">{m.bean_origins()}</legend>
            {#each ORIGIN_FIELDS as field (field.key)}
              <label class={labelClass}>
                {field.label()}
                <input class={inputClass} bind:value={form[field.key]} />
              </label>
            {/each}
          </fieldset>
          <label class={labelClass}>
            {m.bean_note()}
            <textarea class="{inputClass} min-h-20" bind:value={form.note}></textarea>
          </label>
        </form>
        <footer
          class="flex flex-wrap items-center justify-end gap-2 border-t border-border px-3 py-3 sm:px-5 sm:py-4"
        >
          <p role="status" class={['basis-full text-sm', !opening && 'hidden']} data-testid="open-status">
            {#if opening === 'waiting'}
              <span class="inline-flex items-center gap-2 text-muted">
                <LoaderCircle class="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                {m.link_opening()}
              </span>
            {:else if opening === 'opened'}
              <span class="inline-flex items-center gap-2">
                <CircleCheck class="size-4 text-accent" aria-hidden="true" />
                {m.link_opened()}
              </span>
            {:else if opening === 'not-opened'}
              <span class="inline-flex items-start gap-2 text-danger">
                <TriangleAlert class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {m.link_not_opened()}
              </span>
            {/if}
          </p>
          <button
            type="button"
            class="{buttonClass} hover:bg-border/40"
            onclick={() => {
              step = 'link';
              form = null;
              opening = null;
            }}
          >
            {m.link_back()}
          </button>
          {#if link}
            <a class={primaryButtonClass} href={link} onclick={onOpen} data-testid="open-in-beanconqueror">
              <ExternalLink class="size-4" aria-hidden="true" />
              {m.link_open()}
            </a>
          {:else}
            <button type="button" class="{primaryButtonClass} opacity-50" disabled>
              <ExternalLink class="size-4" aria-hidden="true" />
              {m.link_open()}
            </button>
          {/if}
        </footer>
      {/if}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
