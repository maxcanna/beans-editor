<script lang="ts">
  import type { ClassValue } from 'svelte/elements';

  let {
    items,
    class: className,
  }: { items: (string | number | false | null | undefined)[]; class?: ClassValue } = $props();

  // Falsy items (missing values, a zero from `value && label`) are left out.
  const shown = $derived(items.filter(Boolean));
</script>

<!--
  Items separated by a middle dot. Lines break between items, not inside a
  short one like "Brews: 1", and never leave a dot at the start or end of a line.
  Every item carries its dot in front; the dot of the first item on each line
  sits in the negative margin and is clipped, so no line starts or ends with one.
-->
<span class={['block overflow-hidden', className]}>
  <span class="-ml-4 flex flex-wrap">
    {#each shown as item, i (i)}
      <span class="before:inline-block before:w-4 before:text-center before:content-['·']">{item}</span>
    {/each}
  </span>
</span>
