<script lang="ts">
  import { Archive, ArchiveRestore, Trash2, TriangleAlert, X } from '@lucide/svelte';
  import { Dialog } from 'bits-ui';
  import { tick } from 'svelte';
  import { m } from '$paraglide/messages';
  import type { BackupRecord } from '../../formats/backup/backup';
  import { applyBeanForm, beanForm, validateBean } from '../../editor/beans';
  import BeanFields from './BeanFields.svelte';
  import { buttonClass as button } from './styles';

  interface Props {
    bean: BackupRecord;
    isNew: boolean;
    /** Brews that use this bean; a bean in use can't be deleted. */
    brews: number;
    maxRating: number;
    onsave: (bean: BackupRecord) => void;
    ondelete: () => void;
    onclose: () => void;
  }

  let { bean, isNew, brews, maxRating, onsave, ondelete, onclose }: Props = $props();

  // The dialog is mounted per bean, so the form starts from the bean it was opened with.
  // svelte-ignore state_referenced_locally
  let form = $state(beanForm(bean));
  let submitted = $state(false);
  let confirmingDelete = $state(false);
  const errors = $derived(validateBean(form, maxRating));
  const shown = $derived(submitted ? errors : {});

  let formElement: HTMLFormElement;
  let deleteNotice = $state<HTMLElement>();

  function trySave() {
    submitted = true;
    if (Object.keys(errors).length > 0) {
      // Let the error messages render, then move focus to the first one.
      queueMicrotask(() => formElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    onsave(applyBeanForm(bean, $state.snapshot(form)));
  }

  /** Archiving saves the form too, so edits made before it aren't lost. */
  function toggleArchived() {
    form.finished = !form.finished;
    trySave();
  }
</script>

<Dialog.Root open onOpenChange={(open) => !open && onclose()}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-40 bg-black/40" />
    <Dialog.Content
      class="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-2xl border border-border bg-surface shadow-xl sm:inset-auto sm:top-1/2 sm:left-1/2 sm:max-h-[88dvh] sm:w-[min(40rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
      data-testid="bean-dialog"
    >
      <header class="flex items-center gap-3 border-b border-border px-5 py-4">
        <Dialog.Title class="flex-1 text-lg font-semibold">
          {isNew ? m.bean_new_title() : m.bean_edit_title()}
        </Dialog.Title>
        <Dialog.Close
          class="rounded-full p-1.5 text-muted hover:bg-border/50 focus-visible:outline-2 focus-visible:outline-accent"
          aria-label={m.bean_cancel()}
        >
          <X class="size-5" aria-hidden="true" />
        </Dialog.Close>
      </header>

      <form
        bind:this={formElement}
        id="bean-form"
        class="flex-1 space-y-6 overflow-y-auto px-5 py-5"
        novalidate
        onsubmit={(event) => {
          event.preventDefault();
          trySave();
        }}
      >
        <BeanFields bind:form mode="backup" errors={shown} {maxRating} />

        {#if confirmingDelete}
          <div
            bind:this={deleteNotice}
            role="alert"
            class="flex gap-3 rounded-xl border border-danger/40 bg-danger/5 p-4 text-sm"
          >
            <TriangleAlert class="size-5 shrink-0 text-danger" aria-hidden="true" />
            <div class="space-y-3">
              {#if brews > 0}
                <p>{m.bean_delete_blocked({ count: brews })}</p>
                {#if !form.finished}
                  <button
                    type="button"
                    class="{button} border border-border bg-surface hover:bg-border/40"
                    onclick={toggleArchived}
                  >
                    <Archive class="size-4" aria-hidden="true" />
                    {m.bean_archive()}
                  </button>
                {/if}
              {:else}
                <p>{m.bean_delete_confirm()}</p>
                <button
                  type="button"
                  class="{button} bg-danger text-accent-fg hover:bg-danger/90"
                  onclick={ondelete}
                >
                  <Trash2 class="size-4" aria-hidden="true" />
                  {m.bean_delete()}
                </button>
              {/if}
            </div>
          </div>
        {/if}
      </form>

      <footer class="flex items-center gap-1 border-t border-border px-3 py-3 sm:gap-2 sm:px-5 sm:py-4">
        {#if !isNew}
          <button
            type="button"
            class="{button} text-danger hover:bg-danger/10"
            onclick={async () => {
              confirmingDelete = true;
              await tick();
              deleteNotice?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }}
          >
            <Trash2 class="size-4" aria-hidden="true" />
            <span class="max-sm:sr-only">{m.bean_delete()}</span>
          </button>
          <button type="button" class="{button} hover:bg-border/40" onclick={toggleArchived}>
            {#if form.finished}
              <ArchiveRestore class="size-4" aria-hidden="true" />
              <span class="max-sm:sr-only">{m.bean_unarchive()}</span>
            {:else}
              <Archive class="size-4" aria-hidden="true" />
              <span class="max-sm:sr-only">{m.bean_archive()}</span>
            {/if}
          </button>
        {/if}
        <span class="flex-1"></span>
        <Dialog.Close class="{button} hover:bg-border/40">{m.bean_cancel()}</Dialog.Close>
        <button type="submit" form="bean-form" class="{button} bg-accent text-accent-fg hover:bg-accent/90">
          {m.bean_save()}
        </button>
      </footer>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
