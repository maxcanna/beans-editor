<script lang="ts">
  import { Archive, Trash2, TriangleAlert } from '@lucide/svelte';
  import { onMount } from 'svelte';
  import { m } from '$paraglide/messages';
  import { buttonClass } from './styles';

  interface Props {
    /** Set when brews use the record, which blocks deleting it. */
    blocked?: string;
    confirm: string;
    /** Offered instead of deleting when blocked; omitted for records that can't be archived. */
    onarchive?: () => void;
    ondelete: () => void;
  }

  let { blocked, confirm, onarchive, ondelete }: Props = $props();
  let element: HTMLElement;

  // The notice sits at the end of a scrolling form; bring it into view.
  onMount(() => element.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
</script>

<div
  bind:this={element}
  role="alert"
  class="flex gap-3 rounded-xl border border-danger/40 bg-danger/5 p-4 text-sm"
>
  <TriangleAlert class="size-5 shrink-0 text-danger" aria-hidden="true" />
  <div class="space-y-3">
    {#if blocked}
      <p>{blocked}</p>
      {#if onarchive}
        <button
          type="button"
          class="{buttonClass} border border-border bg-surface hover:bg-border/40"
          onclick={onarchive}
        >
          <Archive class="size-4" aria-hidden="true" />
          {m.bean_archive()}
        </button>
      {/if}
    {:else}
      <p>{confirm}</p>
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
</div>
