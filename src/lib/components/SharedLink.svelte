<script lang="ts">
  import { CircleCheck, ExternalLink, LoaderCircle, TriangleAlert } from '@lucide/svelte';
  import { onMount } from 'svelte';
  import { m } from '$paraglide/messages';
  import { beanLink, nameFromUrl, type SharedBean } from '../beanlink/bean-link';
  import { localDay } from '../editor/beans';
  import { ReadError, readBean } from '../extract/read';
  import { buttonClass, primaryButtonClass } from './editor/styles';

  interface Props {
    /** The product page shared from another app. */
    url: URL;
    ondone: () => void;
  }

  let { url, ondone }: Props = $props();

  /** Jina can hang on a slow shop; after this the bean goes with what the link itself says. */
  const READ_TIMEOUT = 20_000;
  /** How long to wait for Beanconqueror to take over before asking for a tap. */
  const OPEN_TIMEOUT = 2500;

  const host = $derived(url.hostname.replace(/^www\./, ''));

  let step = $state<'reading' | 'ready'>('reading');
  let bean = $state<SharedBean | null>(null);
  /** Why the page couldn't be read, when it couldn't. */
  let readProblem = $state<string | null>(null);
  let opening = $state<'waiting' | 'opened' | 'not-opened' | null>(null);
  let openTimer: ReturnType<typeof setTimeout> | undefined;

  const link = $derived(bean ? beanLink(bean) : undefined);

  async function read(): Promise<SharedBean> {
    const fallback = { name: nameFromUrl(url), url: url.href };
    if (!navigator.onLine) {
      readProblem = m.share_link_offline();
      return fallback;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), READ_TIMEOUT);
    try {
      return await readBean(url, fetch, controller.signal);
    } catch (e) {
      readProblem = controller.signal.aborted
        ? m.share_link_slow()
        : e instanceof ReadError && e.kind === 'dead'
          ? m.share_link_dead()
          : e instanceof ReadError && e.kind === 'rate-limited'
            ? m.share_link_rate_limited()
            : m.share_link_unreachable();
      return fallback;
    } finally {
      clearTimeout(timer);
    }
  }

  function waitForApp() {
    clearTimeout(openTimer);
    opening = 'waiting';
    openTimer = setTimeout(() => {
      if (opening === 'waiting') opening = 'not-opened';
    }, OPEN_TIMEOUT);
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'hidden' && opening === 'waiting') {
      clearTimeout(openTimer);
      opening = 'opened';
    }
  }

  onMount(() => {
    void (async () => {
      bean = await read();
      step = 'ready';
      if (!link) return;
      // Chrome may refuse to open an app without a tap; the button below covers that.
      waitForApp();
      window.location.href = link;
    })();
    return () => clearTimeout(openTimer);
  });

  const found = $derived(
    bean
      ? [
          { label: m.bean_name(), value: bean.name },
          { label: m.bean_roaster(), value: bean.roaster },
          { label: m.bean_roast_date(), value: bean.roastingDate && localDay(bean.roastingDate) },
          { label: m.bean_weight(), value: bean.weight?.toString() },
          { label: m.origin_country(), value: bean.bean_information?.[0]?.country },
        ].filter((row): row is typeof row & { value: string } => Boolean(row.value))
      : [],
  );
</script>

<svelte:document onvisibilitychange={onVisibilityChange} />

<section
  class="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-5 shadow-sm"
  aria-labelledby="shared-link-title"
  data-testid="shared-link"
>
  <h2 id="shared-link-title" class="text-lg font-semibold">{m.share_link_title()}</h2>

  {#if step === 'reading'}
    <p role="status" class="flex items-start gap-3 text-sm" data-testid="shared-link-reading">
      <LoaderCircle
        class="mt-0.5 size-5 shrink-0 animate-spin text-accent motion-reduce:animate-none"
        aria-hidden="true"
      />
      <span>
        <span class="block font-medium">{m.link_reading({ host })}</span>
        <span class="block text-muted">{m.link_reading_wait()}</span>
      </span>
    </p>
  {:else if bean}
    {#if readProblem}
      <p role="alert" class="flex items-start gap-2 text-sm text-danger">
        <TriangleAlert class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {readProblem}
      </p>
    {/if}
    {#if found.length > 0}
      <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm" data-testid="shared-link-found">
        {#each found as row (row.label)}
          <dt class="text-muted">{row.label}</dt>
          <dd class="min-w-0 break-words">{row.value}</dd>
        {/each}
      </dl>
    {/if}

    <p role="status" class="text-sm" data-testid="open-status">
      {#if opening === 'waiting'}
        <span class="inline-flex items-center gap-2 text-muted">
          <LoaderCircle class="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          {m.link_opening()}
        </span>
      {:else if opening === 'opened'}
        <span class="inline-flex items-start gap-2">
          <CircleCheck class="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
          {m.link_opened()}
        </span>
      {:else if opening === 'not-opened'}
        <span class="inline-flex items-start gap-2">
          <TriangleAlert class="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
          {m.share_link_tap()}
        </span>
      {/if}
    </p>

    <div class="flex flex-wrap items-center justify-end gap-2">
      <button type="button" class="{buttonClass} hover:bg-border/40" onclick={ondone}>
        {m.share_link_done()}
      </button>
      {#if link}
        <a class={primaryButtonClass} href={link} onclick={waitForApp} data-testid="open-in-beanconqueror">
          <ExternalLink class="size-4" aria-hidden="true" />
          {m.link_open()}
        </a>
      {/if}
    </div>
  {/if}
</section>
