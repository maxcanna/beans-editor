<script lang="ts">
  import { FileSpreadsheet, FileArchive, FileQuestion, X } from '@lucide/svelte';
  import { m } from '$paraglide/messages';
  import type { DetectedFile, FileKind } from '../files/detect';

  interface Props {
    file: DetectedFile;
    onclose: () => void;
  }

  let { file, onclose }: Props = $props();

  const labels: Record<FileKind, () => string> = {
    backup: m.detected_backup,
    'roasted-template': m.detected_roasted_template,
    'green-template': m.detected_green_template,
    'excel-export': m.detected_excel_export,
    unknown: m.detected_unknown,
  };

  const Icon = $derived(
    file.kind === 'backup' ? FileArchive : file.kind === 'unknown' ? FileQuestion : FileSpreadsheet,
  );
</script>

<article class="rounded-2xl border border-border bg-surface p-5 shadow-sm" data-testid="file-summary">
  <header class="flex items-start gap-4">
    <Icon class="mt-0.5 size-8 shrink-0 text-accent" aria-hidden="true" />
    <div class="min-w-0 flex-1">
      <h2 class="truncate font-semibold" data-testid="file-kind">{labels[file.kind]()}</h2>
      <p class="truncate text-sm text-muted">
        {file.name} · {m.file_size({ size: Math.max(1, Math.round(file.size / 1024)) })}
      </p>
    </div>
    <button
      type="button"
      class="rounded-full p-1.5 text-muted hover:bg-border/50 focus-visible:outline-2 focus-visible:outline-accent"
      aria-label={m.file_close()}
      onclick={onclose}
    >
      <X class="size-5" aria-hidden="true" />
    </button>
  </header>
  {#if file.parts.length}
    <ul class="mt-4 flex flex-wrap gap-2">
      {#each file.parts as part (part)}
        <li class="rounded-full bg-border/40 px-3 py-1 text-xs">{part}</li>
      {/each}
    </ul>
  {/if}
</article>
