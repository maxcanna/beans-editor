<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements';

  let { class: className = '', children, ...rest }: HTMLAttributes<HTMLSpanElement> = $props();
</script>

<span
  data-slot="badge"
  class="inline-flex items-center justify-center rounded-full bg-border/70 px-2 py-0.5 text-xs font-medium tabular-nums group-data-[state=active]/tab:bg-accent-fg/20 {className}"
  {...rest}
>
  {@render children?.()}
</span>
