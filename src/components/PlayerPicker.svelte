<script lang="ts">
  import Modal from './Modal.svelte';
  import { activePlayers } from '../stores/app.svelte';

  interface Props {
    open: boolean;
    title?: string;
    excludeId?: string | null;
    onPick: (playerId: string | null) => void;
    onCancel: () => void;
  }

  let { open, title = 'Select player', excludeId = null, onPick, onCancel }: Props = $props();

  const list = $derived(activePlayers().filter((p) => p.id !== excludeId));
</script>

<Modal {open} {title} onClose={onCancel}>
  <div class="space-y-2">
    <button class="btn btn-ghost w-full justify-start" onclick={() => onPick(null)}>
      <span class="text-base-content/60">— Unassigned —</span>
    </button>
    {#each list as p (p.id)}
      <button class="btn btn-outline w-full justify-start" onclick={() => onPick(p.id)}>
        {p.name}
      </button>
    {/each}
    {#if list.length === 0}
      <p class="text-base-content/50 text-sm text-center py-4">No other players. Add some in Settings.</p>
    {/if}
  </div>
</Modal>
