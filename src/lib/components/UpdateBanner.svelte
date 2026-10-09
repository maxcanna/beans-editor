<script lang="ts">
  import { m } from '$paraglide/messages';
  import { pwa } from '../pwa/update.svelte';

  const card = 'pointer-events-auto flex items-center gap-3 rounded-xl bg-fg px-4 py-3 text-bg shadow-lg';
  const button =
    'rounded-lg px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-accent';
</script>

<!-- The live region stays mounted so a screen reader announces what appears in it. -->
<div
  role="status"
  class="pointer-events-none fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 mx-auto max-w-md"
>
  {#if pwa.needRefresh}
    <div class={card}>
      <p class="flex-1 text-sm">{m.update_available()}</p>
      <button type="button" class="{button} bg-accent text-accent-fg" onclick={() => pwa.applyUpdate()}>
        {m.update_reload()}
      </button>
      <button type="button" class="{button} hover:bg-bg/15" onclick={() => pwa.dismiss()}>
        {m.dismiss()}
      </button>
    </div>
  {:else if pwa.offlineReady}
    <div class={card}>
      <p class="flex-1 text-sm">{m.offline_ready()}</p>
      <button type="button" class="{button} hover:bg-bg/15" onclick={() => pwa.dismiss()}>
        {m.dismiss()}
      </button>
    </div>
  {/if}
</div>
