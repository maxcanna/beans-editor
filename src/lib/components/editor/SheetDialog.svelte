<script lang="ts">
  import { X } from '@lucide/svelte';
  import { Dialog } from 'bits-ui';
  import type { Snippet } from 'svelte';
  import { m } from '$paraglide/messages';
  import ConfirmDiscard from './ConfirmDiscard.svelte';

  interface Props {
    title: string;
    testid: string;
    /** Id for the form inside, so footer buttons can submit it. */
    formId: string;
    onsubmit: () => void;
    onclose: () => void;
    /** The form has edits, so Escape or a tap outside asks before closing. */
    dirty?: boolean;
    /** Another dialog (delete) is open on top and handles Escape itself. */
    busy?: boolean;
    children: Snippet;
    footer: Snippet;
  }

  let {
    title,
    testid,
    formId,
    onsubmit,
    onclose,
    dirty = false,
    busy = false,
    children,
    footer,
  }: Props = $props();

  let confirmingDiscard = $state(false);

  function guardClose(event: Event) {
    if (!dirty || busy || confirmingDiscard) return;
    event.preventDefault();
    confirmingDiscard = true;
  }
</script>

<!-- A bottom sheet on phones, a centred dialog on larger screens; mounted only while open. -->
<Dialog.Root open onOpenChange={(open) => !open && onclose()}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-40 bg-black/40" />
    <Dialog.Content
      class="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-2xl border border-border bg-surface shadow-xl sm:inset-auto sm:top-1/2 sm:left-1/2 sm:max-h-[88dvh] sm:w-[min(40rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
      data-testid={testid}
      onEscapeKeydown={guardClose}
      onInteractOutside={guardClose}
    >
      <div class="flex items-center gap-3 border-b border-border px-5 py-4">
        <Dialog.Title class="flex-1 text-lg font-semibold">{title}</Dialog.Title>
        <Dialog.Close
          class="rounded-full p-1.5 text-muted hover:bg-border/50 focus-visible:outline-2 focus-visible:outline-accent"
          aria-label={m.bean_cancel()}
        >
          <X class="size-5" aria-hidden="true" />
        </Dialog.Close>
      </div>
      <form
        id={formId}
        class="flex-1 space-y-6 overflow-y-auto px-5 py-5"
        novalidate
        onsubmit={(event) => {
          event.preventDefault();
          onsubmit();
        }}
      >
        {@render children()}
      </form>
      <footer class="flex items-center gap-1 border-t border-border px-3 py-3 sm:gap-2 sm:px-5 sm:py-4">
        {@render footer()}
        <Dialog.Close
          class="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium hover:bg-border/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {m.bean_cancel()}
        </Dialog.Close>
        <button
          type="submit"
          form={formId}
          class="inline-flex items-center justify-center rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:bg-accent/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {m.bean_save()}
        </button>
      </footer>
      {#if confirmingDiscard}
        <ConfirmDiscard ondiscard={onclose} oncancel={() => (confirmingDiscard = false)} />
      {/if}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
