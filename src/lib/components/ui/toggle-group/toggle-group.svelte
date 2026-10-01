<script lang="ts">
  import { ToggleGroup } from 'bits-ui';
  import type { HTMLAttributes } from 'svelte/elements';

  // Always the multiple (independent on/off buttons) flavour; the value is the list of pressed items.
  interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'id'> {
    value?: string[];
    onValueChange?: (value: string[]) => void;
    children?: import('svelte').Snippet;
  }

  let { value = $bindable([]), class: className = '', ...rest }: Props = $props();
</script>

<ToggleGroup.Root
  type="multiple"
  bind:value
  data-slot="toggle-group"
  class="flex rounded-full border border-border p-0.5 {className}"
  {...rest}
/>
