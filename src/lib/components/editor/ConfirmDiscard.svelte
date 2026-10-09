<script lang="ts">
  import { TriangleAlert } from '@lucide/svelte';
  import { AlertDialog } from 'bits-ui';
  import { m } from '$paraglide/messages';
  import { buttonClass } from './styles';

  interface Props {
    ondiscard: () => void;
    oncancel: () => void;
  }

  let { ondiscard, oncancel }: Props = $props();
</script>

<!-- Asked when Escape or a tap outside would close a form that has edits; the Cancel buttons close it as asked. -->
<AlertDialog.Root open onOpenChange={(open) => !open && oncancel()}>
  <AlertDialog.Portal>
    <AlertDialog.Overlay class="fixed inset-0 z-[60] bg-black/40" />
    <AlertDialog.Content
      class="fixed top-1/2 left-1/2 z-[70] flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 rounded-2xl border border-border bg-surface p-5 shadow-xl"
      data-testid="confirm-discard"
    >
      <div class="flex gap-3">
        <TriangleAlert class="size-5 shrink-0 text-danger" aria-hidden="true" />
        <AlertDialog.Description class="text-sm">{m.discard_body()}</AlertDialog.Description>
      </div>
      <div class="flex flex-wrap justify-end gap-2">
        <AlertDialog.Cancel class="{buttonClass} hover:bg-border/40">{m.replace_cancel()}</AlertDialog.Cancel>
        <button
          type="button"
          class="{buttonClass} bg-danger text-accent-fg hover:bg-danger/90"
          onclick={ondiscard}
        >
          {m.discard_confirm()}
        </button>
      </div>
    </AlertDialog.Content>
  </AlertDialog.Portal>
</AlertDialog.Root>
