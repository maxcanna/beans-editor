<script lang="ts">
  import { CircleCheck, ExternalLink, LoaderCircle, Plus, RotateCw, TriangleAlert, X } from '@lucide/svelte';
  import { Dialog } from 'bits-ui';
  import { onMount } from 'svelte';
  import { m } from '$paraglide/messages';
  import { beanLink, findSharedUrl, nameFromUrl } from '../beanlink/bean-link';
  import type { BackupRecord } from '../formats/backup/backup';
  import {
    applyBeanForm,
    beanForm,
    beanFormFromShared,
    newBean,
    sharedFromBeanForm,
    validateBean,
  } from '../editor/beans';
  import { ReadError, readBean } from '../extract/read';
  import BeanFields from './editor/BeanFields.svelte';
  import { buttonClass, inputClass, labelClass, primaryButtonClass } from './editor/styles';

  interface Props {
    onclose: () => void;
    /**
     * Set when opened from a backup being edited: the bean goes into that
     * backup instead of being sent to Beanconqueror.
     */
    onadd?: (bean: BackupRecord) => void;
    /** The backup's bean rating scale (SETTINGS.bean_rating). */
    maxRating?: number;
    /** A product page shared from another app: it's read right away. */
    url?: URL;
  }

  let { onclose, onadd, maxRating = 5, url: sharedUrl }: Props = $props();

  let step = $state<'link' | 'reading' | 'review'>('link');
  let input = $state('');
  let error = $state<string | null>(null);
  let online = $state(navigator.onLine);
  /** The review form: the same fields as the bean dialog, so a bean looks alike wherever it's edited. */
  let form = $state(beanForm(newBean()));
  let submitted = $state(false);
  let formElement = $state<HTMLFormElement>();
  let controller: AbortController | undefined;
  let typingTimer: ReturnType<typeof setTimeout> | undefined;
  /** The link being read, shown while it loads. */
  let readingHost = $state('');

  const mode = $derived(onadd ? 'backup' : 'share');
  const errors = $derived(validateBean(form, maxRating));
  const shown = $derived(submitted ? errors : {});
  const valid = $derived(Object.keys(errors).length === 0);

  /** A tap on the disabled button shows what's wrong and moves focus to it. */
  function showErrors() {
    submitted = true;
    queueMicrotask(() => formElement?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
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

  const link = $derived(valid ? beanLink(sharedFromBeanForm(form)) : undefined);

  async function read(text = input) {
    clearTimeout(typingTimer);
    const url = findSharedUrl(text);
    if (!url) {
      error = m.link_invalid();
      return;
    }
    if (!online) return;
    error = null;
    readingHost = url.hostname.replace(/^www\./, '');
    step = 'reading';
    controller = new AbortController();
    try {
      form = beanFormFromShared(await readBean(url, fetch, controller.signal));
      submitted = false;
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
    clearTimeout(typingTimer);
    controller?.abort();
    const url = findSharedUrl(input);
    form = beanFormFromShared(url ? { name: nameFromUrl(url), url: url.href } : { name: '' });
    submitted = false;
    error = null;
    step = 'review';
  }

  function onpaste(event: ClipboardEvent) {
    const text = event.clipboardData?.getData('text') ?? '';
    if (step === 'link' && online && findSharedUrl(text)) {
      event.preventDefault();
      input = text.trim();
      void read(text);
    }
  }

  /**
   * A link typed, or pasted by a keyboard's clipboard chip (which sends no
   * paste event), is read once the input settles.
   */
  function oninput() {
    clearTimeout(typingTimer);
    error = null;
    if (!online || !findSharedUrl(input)) return;
    typingTimer = setTimeout(() => void read(), 800);
  }

  onMount(() => {
    if (sharedUrl) {
      input = sharedUrl.href;
      void read();
    }
    return () => clearTimeout(openTimer);
  });
</script>

<svelte:window onoffline={() => (online = false)} ononline={() => (online = true)} />
<svelte:document onvisibilitychange={onVisibilityChange} />

<Dialog.Root
  open
  onOpenChange={(open) => !open && (clearTimeout(typingTimer), controller?.abort(), onclose())}
>
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
          <Dialog.Description class="text-sm text-muted"
            >{onadd ? m.link_intro_backup() : m.link_intro()}</Dialog.Description
          >
          <label class={labelClass}>
            {m.link_label()}
            <span class="relative">
              <input
                class="{inputClass} pr-10"
                type="url"
                inputmode="url"
                autocomplete="off"
                placeholder="https://"
                bind:value={input}
                {onpaste}
                {oninput}
                readonly={step === 'reading'}
                aria-busy={step === 'reading'}
                aria-invalid={error ? 'true' : undefined}
                aria-describedby={error ? 'link-error' : undefined}
              />
              {#if step === 'reading'}
                <LoaderCircle
                  class="absolute top-1/2 right-3 size-5 -translate-y-1/2 animate-spin text-accent motion-reduce:animate-none"
                  aria-hidden="true"
                />
              {/if}
            </span>
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
            <p
              role="status"
              class="flex items-start gap-3 rounded-xl border border-border bg-bg p-3 text-sm"
              data-testid="link-reading"
            >
              <LoaderCircle
                class="mt-0.5 size-4 shrink-0 animate-spin text-accent motion-reduce:animate-none"
                aria-hidden="true"
              />
              <span>
                <span class="block font-medium">{m.link_reading({ host: readingHost })}</span>
                <span class="block text-muted">{m.link_reading_wait()}</span>
              </span>
            </p>
          {/if}
        </form>
        <footer
          class="flex flex-wrap items-center justify-end gap-2 border-t border-border px-3 py-3 sm:px-5 sm:py-4"
        >
          <button type="button" class="{buttonClass} hover:bg-border/40" onclick={fillByHand}>
            {step === 'reading' ? m.link_skip() : m.link_by_hand()}
          </button>
          {#if error && online && step === 'link' && findSharedUrl(input)}
            <button type="button" class={primaryButtonClass} onclick={() => read()}>
              <RotateCw class="size-4" aria-hidden="true" />
              {m.link_retry()}
            </button>
          {/if}
        </footer>
      {:else}
        <form
          bind:this={formElement}
          class="flex-1 space-y-6 overflow-y-auto px-5 py-5"
          novalidate
          onsubmit={(e) => e.preventDefault()}
        >
          <Dialog.Description class="text-sm text-muted"
            >{m.link_review()} {onadd ? '' : m.link_backup_untouched()}</Dialog.Description
          >
          <BeanFields bind:form {mode} errors={shown} {maxRating} />
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
              opening = null;
            }}
          >
            {m.link_back()}
          </button>
          {#if onadd}
            <button
              type="button"
              class={[primaryButtonClass, !valid && 'opacity-50']}
              aria-disabled={!valid}
              onclick={() => (valid ? onadd(applyBeanForm(newBean(), $state.snapshot(form))) : showErrors())}
            >
              <Plus class="size-4" aria-hidden="true" />
              {m.link_add_to_backup()}
            </button>
          {:else if link}
            <a class={primaryButtonClass} href={link} onclick={onOpen} data-testid="open-in-beanconqueror">
              <ExternalLink class="size-4" aria-hidden="true" />
              {m.link_open()}
            </a>
          {:else}
            <button
              type="button"
              class="{primaryButtonClass} opacity-50"
              aria-disabled="true"
              onclick={showErrors}
            >
              <ExternalLink class="size-4" aria-hidden="true" />
              {m.link_open()}
            </button>
          {/if}
        </footer>
      {/if}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
