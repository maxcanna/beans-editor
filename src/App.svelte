<script lang="ts">
  import { Coffee, TriangleAlert } from '@lucide/svelte';
  import { AlertDialog } from 'bits-ui';
  import { onMount } from 'svelte';
  import { m } from '$paraglide/messages';
  import DropZone from './lib/components/DropZone.svelte';
  import UpdateBanner from './lib/components/UpdateBanner.svelte';
  import { EditorSession } from './lib/editor/session.svelte';
  import { consumeShare, readLocalFile, type IncomingFile } from './lib/files/incoming';
  import type { DetectedFile } from './lib/files/detect';

  // Heavy code (zip parsing, the editor, the summary view) is split into lazy
  // chunks; the service worker still precaches them, so this only speeds up startup.
  const loadDetect = () => import('./lib/files/detect');
  const loadBackup = () => import('./lib/formats/backup/backup');
  const loadSummary = () => import('./lib/components/FileSummary.svelte');
  const loadEditor = () => import('./lib/components/editor/BackupEditor.svelte');
  const loadOutput = () => import('./lib/editor/output');

  const session = new EditorSession();

  /** A non-backup file shown as a summary (templates and exports come in as sources later). */
  let summary = $state<Promise<DetectedFile> | null>(null);
  let openError = $state<string | null>(null);
  let notice = $state<'restored' | null>(null);
  let invalidDraft = $state<{ raw: unknown } | null>(null);
  /** A backup waiting for the user to confirm it may replace unsaved work. */
  let pending = $state<{ name: string; open: () => void } | null>(null);

  async function open(file: IncomingFile) {
    openError = null;
    notice = null;
    const { detectFile } = await loadDetect();
    const detected = detectFile(file.name, file.bytes);
    if (detected.kind !== 'backup') {
      summary = Promise.resolve(detected);
      return;
    }
    try {
      const { readBackup } = await loadBackup();
      const data = readBackup(file.bytes);
      const replace = () => {
        summary = null;
        session.open(file.name, data);
      };
      if (session.data && session.dirty) pending = { name: file.name, open: replace };
      else replace();
    } catch (error) {
      openError = error instanceof Error ? error.message : String(error);
    }
  }

  async function downloadInvalidDraft() {
    if (!invalidDraft) return;
    const { download } = await loadOutput();
    const json = new TextEncoder().encode(JSON.stringify(invalidDraft.raw));
    download(json, 'bean-editor-unsaved-work.json', 'application/json');
  }

  async function discardInvalidDraft() {
    await session.close();
    invalidDraft = null;
  }

  onMount(() => {
    void (async () => {
      const restored = await session.restore();
      if (restored.status === 'ok') notice = 'restored';
      if (restored.status === 'invalid') invalidDraft = { raw: restored.raw };
      const incoming = await consumeShare(window.location, window.history);
      if (incoming.type === 'file') await open(incoming.file);
    })();

    // Write pending edits right away when the page is hidden or closed.
    const flush = () => {
      if (document.visibilityState === 'hidden') void session.flush();
    };
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', flush);
      window.removeEventListener('pagehide', flush);
    };
  });

  const banner = 'flex flex-wrap items-center gap-3 rounded-2xl border p-4 text-sm';
  const bannerButton =
    'rounded-full border border-border bg-surface px-3 py-1.5 font-medium hover:bg-border/40 focus-visible:outline-2 focus-visible:outline-accent';
</script>

<div class={['mx-auto flex min-h-dvh flex-col px-4 py-8 sm:px-6', session.data ? 'max-w-6xl' : 'max-w-3xl']}>
  <header class="mb-10 flex items-center gap-3">
    <Coffee class="size-7 text-accent" aria-hidden="true" />
    <h1 class="text-xl font-semibold tracking-tight">{m.app_name()}</h1>
  </header>

  <main class="flex flex-1 flex-col gap-6">
    {#if invalidDraft}
      <div role="alert" class="{banner} border-danger/40 bg-danger/5" data-testid="invalid-draft">
        <TriangleAlert class="size-5 shrink-0 text-danger" aria-hidden="true" />
        <p class="min-w-48 flex-1">{m.draft_invalid()}</p>
        <button type="button" class={bannerButton} onclick={downloadInvalidDraft}
          >{m.draft_invalid_download()}</button
        >
        <button type="button" class={bannerButton} onclick={discardInvalidDraft}
          >{m.draft_invalid_discard()}</button
        >
      </div>
    {/if}

    {#if notice === 'restored'}
      <div role="status" class="{banner} border-border bg-surface">
        <p class="flex-1">{m.draft_restored()}</p>
        <button type="button" class={bannerButton} onclick={() => (notice = null)}>{m.dismiss()}</button>
      </div>
    {/if}

    {#if openError}
      <p role="alert" class="rounded-2xl border border-danger/40 bg-danger/5 p-5 text-danger">
        {m.editor_error_open({ reason: openError })}
      </p>
    {/if}

    {#if session.data}
      {#await loadEditor()}
        <div
          class="h-40 animate-pulse rounded-2xl bg-border/40"
          aria-busy="true"
          aria-label={m.loading()}
        ></div>
      {:then { default: BackupEditor }}
        <BackupEditor
          {session}
          onclose={() => {
            notice = null;
            void session.close();
          }}
        />
      {:catch}
        <p role="alert" class="rounded-2xl border border-danger/40 bg-danger/5 p-5 text-danger">
          {m.error_read()}
        </p>
      {/await}
    {:else}
      <p class="text-lg text-balance text-muted">{m.app_tagline()}</p>

      {#if summary}
        {#await Promise.all([summary, loadSummary()])}
          <div
            class="h-28 animate-pulse rounded-2xl bg-border/40"
            aria-busy="true"
            aria-label={m.loading()}
          ></div>
        {:then [detected, { default: FileSummary }]}
          <FileSummary file={detected} onclose={() => (summary = null)} />
        {:catch}
          <p role="alert" class="rounded-2xl border border-danger/40 bg-danger/5 p-5 text-danger">
            {m.error_read()}
          </p>
        {/await}
      {/if}

      <DropZone onfile={async (file) => open(await readLocalFile(file))} />
    {/if}

    <p class="mt-auto pt-10 text-center text-xs text-muted">{m.privacy_note()}</p>
  </main>
</div>

<AlertDialog.Root open={pending !== null} onOpenChange={(open) => !open && (pending = null)}>
  <AlertDialog.Portal>
    <AlertDialog.Overlay class="fixed inset-0 z-40 bg-black/40" />
    <AlertDialog.Content
      class="fixed top-1/2 left-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-xl"
    >
      <AlertDialog.Title class="text-lg font-semibold">{m.replace_title()}</AlertDialog.Title>
      <AlertDialog.Description class="text-sm text-muted">
        {m.replace_body({ file: pending?.name ?? '' })}
      </AlertDialog.Description>
      <div class="flex justify-end gap-2">
        <AlertDialog.Cancel
          class="rounded-full px-4 py-2 text-sm font-medium hover:bg-border/40 focus-visible:outline-2 focus-visible:outline-accent"
        >
          {m.replace_cancel()}
        </AlertDialog.Cancel>
        <AlertDialog.Action
          class="rounded-full bg-danger px-4 py-2 text-sm font-medium text-accent-fg hover:bg-danger/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          onclick={() => {
            pending?.open();
            pending = null;
          }}
        >
          {m.replace_confirm()}
        </AlertDialog.Action>
      </div>
    </AlertDialog.Content>
  </AlertDialog.Portal>
</AlertDialog.Root>

<UpdateBanner />
