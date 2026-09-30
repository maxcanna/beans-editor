<script lang="ts">
  import { Archive, Trash2, TriangleAlert } from '@lucide/svelte';
  import { AlertDialog } from 'bits-ui';
  import { m } from '$paraglide/messages';
  import { buttonClass } from './styles';

  interface Props {
    /** Set when brews use the record, which blocks deleting it. */
    blocked?: string;
    confirm: string;
    /** Offered instead of deleting when blocked; omitted for records that can't be archived. */
    onarchive?: () => void;
    ondelete: () => void;
    oncancel: () => void;
  }

  let { blocked, confirm, onarchive, ondelete, oncancel }: Props = $props();
</script>

<!-- Its own dialog on top of the record's, so the form behind doesn't scroll. -->
<AlertDialog.Root open onOpenChange={(open) => !open && oncancel()}>
  <AlertDialog.Portal>
    <AlertDialog.Overlay class="fixed inset-0 z-[60] bg-black/40" />
    <AlertDialog.Content
      class="fixed top-1/2 left-1/2 z-[70] flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 rounded-2xl border border-border bg-surface p-5 shadow-xl"
      data-testid="confirm-delete"
    >
      <div class="flex gap-3">
        <TriangleAlert class="size-5 shrink-0 text-danger" aria-hidden="true" />
        <AlertDialog.Description class="text-sm">{blocked ?? confirm}</AlertDialog.Description>
      </div>
      <div class="flex flex-wrap justify-end gap-2">
        <AlertDialog.Cancel class="{buttonClass} hover:bg-border/40">{m.bean_cancel()}</AlertDialog.Cancel>
        {#if blocked}
          {#if onarchive}
            <button
              type="button"
              class="{buttonClass} bg-accent text-accent-fg hover:bg-accent/90"
              onclick={onarchive}
            >
              <Archive class="size-4" aria-hidden="true" />
              {m.bean_archive()}
            </button>
          {/if}
        {:else}
          <button
            type="button"
            class="{buttonClass} bg-danger text-accent-fg hover:bg-danger/90"
            onclick={ondelete}
          >
            <Trash2 class="size-4" aria-hidden="true" />
            {m.bean_delete()}
          </button>
        {/if}
      </div>
    </AlertDialog.Content>
  </AlertDialog.Portal>
</AlertDialog.Root>
