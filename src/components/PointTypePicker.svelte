<script lang="ts">
  import { app } from '../stores/app.svelte';
  import type { Slot, ShotType } from '../lib/types';

  interface Props {
    open: boolean;
    slot: Slot;
    leftName: string;
    rightName: string;
    onPick: (shotTypeId: string) => void;
    onCancel: () => void;
  }

  let { open, slot, leftName, rightName, onPick, onCancel }: Props = $props();

  const winners = $derived(app.shotTypes.filter((s) => s.attribution === 'winner'));
  const errors = $derived(app.shotTypes.filter((s) => s.attribution === 'error'));

  const scorerName = $derived(slot === 'left' ? leftName : rightName);
  const opponentName = $derived(slot === 'left' ? rightName : leftName);

  function pick(t: ShotType) {
    onPick(t.id);
  }
</script>

{#if open}
  <div
    role="presentation"
    class="fixed inset-0 z-50 flex items-end justify-center bg-black/60 safe-bottom"
    onclick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
  >
    <div class="bg-base-100 rounded-t-2xl w-full max-w-md max-h-[88dvh] flex flex-col">
      <div class="px-4 pt-3 pb-2 border-b border-base-300">
        <div class="text-xs text-base-content/60">Point for</div>
        <div class="font-semibold text-lg truncate">{scorerName}</div>
      </div>
      <div class="overflow-y-auto p-3 space-y-4">

        <div>
          <div class="text-[11px] uppercase tracking-wide text-success/80 font-semibold mb-2 px-1">
            {scorerName} scored
          </div>
          <div class="grid grid-cols-2 gap-2">
            {#each winners as w (w.id)}
              <button class="btn btn-success btn-outline justify-start text-left h-auto py-3 normal-case" onclick={() => pick(w)}>
                <span class="truncate">{w.label}</span>
              </button>
            {/each}
            {#if winners.length === 0}
              <p class="col-span-2 text-xs text-base-content/50 text-center py-2">No winner types defined</p>
            {/if}
          </div>
        </div>

        <div>
          <div class="text-[11px] uppercase tracking-wide text-error/80 font-semibold mb-2 px-1">
            {opponentName} error
          </div>
          <div class="grid grid-cols-2 gap-2">
            {#each errors as er (er.id)}
              <button class="btn btn-error btn-outline justify-start text-left h-auto py-3 normal-case" onclick={() => pick(er)}>
                <span class="truncate">{er.label}</span>
              </button>
            {/each}
            {#if errors.length === 0}
              <p class="col-span-2 text-xs text-base-content/50 text-center py-2">No error types defined</p>
            {/if}
          </div>
        </div>
      </div>
      <div class="border-t border-base-300 p-3">
        <button class="btn btn-ghost w-full" onclick={onCancel}>Cancel</button>
      </div>
    </div>
  </div>
{/if}
