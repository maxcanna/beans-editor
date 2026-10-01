<script lang="ts">
  import { Archive, Snowflake } from '@lucide/svelte';
  import { m } from '$paraglide/messages';
  import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';

  interface Props {
    showArchived: boolean;
    /** Omit where there is nothing frozen to show (grinders, methods). */
    showFrozen?: boolean | undefined;
    class?: string;
  }

  let { showArchived = $bindable(), showFrozen = $bindable(), class: className = '' }: Props = $props();

  const withFrozen = $derived(showFrozen !== undefined);
  const value = $derived([...(showArchived ? ['archived'] : []), ...(showFrozen ? ['frozen'] : [])]);
  const change = (next: string[]) => {
    showArchived = next.includes('archived');
    if (withFrozen) showFrozen = next.includes('frozen');
  };
</script>

<ToggleGroup {value} onValueChange={change} aria-label={m.beans_show_group()} class={className}>
  <ToggleGroupItem value="archived" aria-label={m.beans_show_archived()} title={m.beans_show_archived()}>
    <Archive class="size-4" aria-hidden="true" />
  </ToggleGroupItem>
  {#if withFrozen}
    <ToggleGroupItem value="frozen" aria-label={m.beans_show_frozen()} title={m.beans_show_frozen()}>
      <Snowflake class="size-4" aria-hidden="true" />
    </ToggleGroupItem>
  {/if}
</ToggleGroup>
