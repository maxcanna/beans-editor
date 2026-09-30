<script lang="ts">
  import { Switch } from 'bits-ui';

  interface Props {
    checked: boolean;
    label: string;
  }

  let { checked = $bindable(), label }: Props = $props();
  const id = $props.id();
</script>

<span class="flex items-center gap-2 text-sm">
  <Switch.Root
    bind:checked
    aria-labelledby="{id}-label"
    class="inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full bg-border p-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent data-[state=checked]:bg-accent"
  >
    <Switch.Thumb
      class="pointer-events-none block size-4 rounded-full bg-surface shadow transition-transform data-[state=checked]:translate-x-4"
    />
  </Switch.Root>
  <span id="{id}-label">{label}</span>
</span>
