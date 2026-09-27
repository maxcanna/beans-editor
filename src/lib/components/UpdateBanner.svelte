<script lang="ts">
  import { m } from '$paraglide/messages';
  import { pwa } from '../pwa/update.svelte';
</script>

{#if pwa.needRefresh}
  <div
    role="status"
    class="fixed inset-x-4 bottom-4 mx-auto flex max-w-md items-center gap-3 rounded-xl bg-fg px-4 py-3 text-bg shadow-lg"
  >
    <p class="flex-1 text-sm">{m.update_available()}</p>
    <button
      type="button"
      class="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg"
      onclick={() => pwa.applyUpdate()}
    >
      {m.update_reload()}
    </button>
  </div>
{/if}
