<script lang="ts">
  import { ToggleGroup } from 'bits-ui';

  let { class: className = '', ...rest }: ToggleGroup.ItemProps = $props();
</script>

<ToggleGroup.Item
  data-slot="toggle-group-item"
  class="inline-flex items-center justify-center rounded-full p-2 text-muted hover:bg-border/40 focus-visible:outline-2 focus-visible:outline-accent data-[state=on]:bg-border/60 data-[state=on]:text-fg {className}"
  {...rest}
/>
