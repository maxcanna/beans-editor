<script lang="ts">
  import { Archive, Snowflake } from '@lucide/svelte';
  import { m } from '$paraglide/messages';

  interface Props {
    archived: boolean;
    frozen: boolean;
    class?: string;
  }

  let { archived, frozen, class: className = '' }: Props = $props();

  const badge = 'inline-flex shrink-0 items-center rounded-full bg-border/50 p-1 text-muted';
</script>

<!-- Icons only, to leave the room to the names; the label is the accessible name and the tooltip. -->
{#if archived}
  <span class="{badge} {className}" role="img" aria-label={m.beans_archived()} title={m.beans_archived()}>
    <Archive class="size-3.5" aria-hidden="true" />
  </span>
{/if}
{#if frozen}
  <span class="{badge} {className}" role="img" aria-label={m.beans_frozen()} title={m.beans_frozen()}>
    <Snowflake class="size-3.5" aria-hidden="true" />
  </span>
{/if}
