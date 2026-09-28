<script lang="ts">
  import { FileUp } from '@lucide/svelte';
  import { m } from '$paraglide/messages';

  interface Props {
    onfile: (file: File) => void;
  }

  let { onfile }: Props = $props();
  let dragging = $state(false);
  let input: HTMLInputElement;

  function pick(files: FileList | null | undefined) {
    const file = files?.[0];
    if (file) onfile(file);
  }
</script>

<div
  role="region"
  aria-label={m.open_file()}
  class={[
    'flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors',
    dragging ? 'border-accent bg-accent/5' : 'border-border',
  ]}
  ondragover={(e) => {
    e.preventDefault();
    dragging = true;
  }}
  ondragleave={() => (dragging = false)}
  ondrop={(e) => {
    e.preventDefault();
    dragging = false;
    pick(e.dataTransfer?.files);
  }}
>
  <FileUp class="size-10 text-muted" aria-hidden="true" />
  <button
    type="button"
    class="rounded-full bg-accent px-6 py-2.5 font-medium text-accent-fg shadow-sm hover:bg-accent/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    onclick={() => input.click()}
  >
    {m.open_file()}
  </button>
  <p class="text-sm text-balance text-muted">{m.drop_hint()}</p>
  <input
    bind:this={input}
    type="file"
    accept=".zip,application/zip,application/x-zip-compressed"
    class="sr-only"
    tabindex="-1"
    aria-hidden="true"
    data-testid="file-input"
    onchange={(e) => {
      pick(e.currentTarget.files);
      e.currentTarget.value = '';
    }}
  />
</div>
