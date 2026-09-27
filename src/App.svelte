<script lang="ts">
  import { Coffee } from '@lucide/svelte';
  import { onMount } from 'svelte';
  import { m } from '$paraglide/messages';
  import DropZone from './lib/components/DropZone.svelte';
  import UpdateBanner from './lib/components/UpdateBanner.svelte';
  import { consumeShare, readLocalFile, type IncomingFile } from './lib/files/incoming';

  // Heavy code (zip parsing, the summary view) is split into lazy chunks; the
  // service worker still precaches them, so this only speeds up startup.
  const loadDetect = () => import('./lib/files/detect');
  const loadSummary = () => import('./lib/components/FileSummary.svelte');

  let current = $state<Promise<{ detected: import('./lib/files/detect').DetectedFile }> | null>(null);

  function open(file: IncomingFile) {
    current = loadDetect().then(({ detectFile }) => ({ detected: detectFile(file.name, file.bytes) }));
  }

  onMount(async () => {
    const incoming = await consumeShare(window.location, window.history);
    if (incoming.type === 'file') open(incoming.file);
  });
</script>

<div class="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 py-8 sm:px-6">
  <header class="mb-10 flex items-center gap-3">
    <Coffee class="size-7 text-accent" aria-hidden="true" />
    <h1 class="text-xl font-semibold tracking-tight">{m.app_name()}</h1>
  </header>

  <main class="flex flex-1 flex-col gap-6">
    <p class="text-lg text-balance text-muted">{m.app_tagline()}</p>

    {#if current}
      {#await Promise.all([current, loadSummary()])}
        <div
          class="h-28 animate-pulse rounded-2xl bg-border/40"
          aria-busy="true"
          aria-label={m.loading()}
        ></div>
      {:then [{ detected }, { default: FileSummary }]}
        <FileSummary file={detected} onclose={() => (current = null)} />
      {:catch}
        <p role="alert" class="rounded-2xl border border-danger/40 bg-danger/5 p-5 text-danger">
          {m.error_read()}
        </p>
      {/await}
    {/if}

    <DropZone onfile={async (file) => open(await readLocalFile(file))} />

    <p class="mt-auto pt-10 text-center text-xs text-muted">{m.privacy_note()}</p>
  </main>
</div>

<UpdateBanner />
