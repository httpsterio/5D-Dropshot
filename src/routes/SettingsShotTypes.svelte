<script lang="ts">
  import { app, addShotType, updateShotType, removeShotType, reorderShotType } from '../stores/app.svelte';
  import AppBar from '../components/AppBar.svelte';
  import Modal from '../components/Modal.svelte';
  import Confirm from '../components/Confirm.svelte';
  import type { ShotAttribution, ShotType } from '../lib/types';

  const winners = $derived(app.shotTypes.filter(s => s.attribution === 'winner'));
  const errors = $derived(app.shotTypes.filter(s => s.attribution === 'error'));

  let editOpen = $state(false);
  let editing = $state<ShotType | null>(null);
  let label = $state('');
  let attribution: ShotAttribution = $state('winner');
  let confirmDelete = $state<ShotType | null>(null);

  function openAdd() {
    editing = null;
    label = '';
    attribution = 'winner';
    editOpen = true;
  }

  function openEdit(t: ShotType) {
    editing = t;
    label = t.label;
    attribution = t.attribution;
    editOpen = true;
  }

  function submit() {
    const l = label.trim();
    if (!l) return;
    if (editing) {
      updateShotType(editing.id, { label: l, attribution });
    } else {
      addShotType(l, attribution);
    }
    editOpen = false;
    editing = null;
  }

  function doDelete() {
    if (confirmDelete) removeShotType(confirmDelete.id);
    confirmDelete = null;
  }
</script>

<div class="flex flex-col h-full">
  <AppBar title="Shot types" showBack />
  <div class="flex-1 overflow-y-auto p-3 space-y-4">

    <section>
      <div class="text-xs uppercase tracking-wide text-success/80 font-semibold mb-2 px-1">Winners</div>
      {#if winners.length === 0}
        <p class="text-center text-sm text-base-content/50 py-3">None</p>
      {:else}
        <ul class="space-y-1.5">
          {#each winners as t (t.id)}
            <li class="bg-base-200 rounded-lg flex items-stretch">
              <button class="flex-1 text-left px-3 py-3" onclick={() => openEdit(t)}>{t.label}</button>
              <div class="flex flex-col border-l border-base-300">
                <button class="flex-1 px-2.5 text-base-content/40 active:text-base-content text-[10px]" aria-label="Move up" onclick={() => reorderShotType(t.id, 'up')}>▲</button>
                <button class="flex-1 px-2.5 text-base-content/40 active:text-base-content text-[10px]" aria-label="Move down" onclick={() => reorderShotType(t.id, 'down')}>▼</button>
              </div>
              <button class="px-3 text-error border-l border-base-300" aria-label="Delete" onclick={() => confirmDelete = t}>×</button>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <section>
      <div class="text-xs uppercase tracking-wide text-error/80 font-semibold mb-2 px-1">Errors</div>
      {#if errors.length === 0}
        <p class="text-center text-sm text-base-content/50 py-3">None</p>
      {:else}
        <ul class="space-y-1.5">
          {#each errors as t (t.id)}
            <li class="bg-base-200 rounded-lg flex items-stretch">
              <button class="flex-1 text-left px-3 py-3" onclick={() => openEdit(t)}>{t.label}</button>
              <div class="flex flex-col border-l border-base-300">
                <button class="flex-1 px-2.5 text-base-content/40 active:text-base-content text-[10px]" aria-label="Move up" onclick={() => reorderShotType(t.id, 'up')}>▲</button>
                <button class="flex-1 px-2.5 text-base-content/40 active:text-base-content text-[10px]" aria-label="Move down" onclick={() => reorderShotType(t.id, 'down')}>▼</button>
              </div>
              <button class="px-3 text-error border-l border-base-300" aria-label="Delete" onclick={() => confirmDelete = t}>×</button>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  </div>
  <div class="border-t border-base-300 px-4 pt-3 pb-5 safe-bottom">
    <button class="btn btn-primary w-full" onclick={openAdd}>Add shot type</button>
  </div>
</div>

<Modal open={editOpen} title={editing ? 'Edit shot type' : 'Add shot type'} onClose={() => editOpen = false}>
  <div class="space-y-3">
    <label class="block">
      <span class="text-sm text-base-content/60">Label</span>
      <input class="input input-bordered w-full mt-1" bind:value={label} placeholder="e.g. Smash" />
    </label>
    <fieldset>
      <legend class="text-sm text-base-content/60 mb-2">Attribution</legend>
      <div class="grid grid-cols-2 gap-2">
        <label class="btn btn-outline {attribution === 'winner' ? 'btn-success' : ''}">
          <input type="radio" class="hidden" bind:group={attribution} value="winner" /> Winner
        </label>
        <label class="btn btn-outline {attribution === 'error' ? 'btn-error' : ''}">
          <input type="radio" class="hidden" bind:group={attribution} value="error" /> Error
        </label>
      </div>
      <p class="text-[11px] text-base-content/50 mt-2">
        Winner = scoring player did something right. Error = opposing player made a mistake.
      </p>
    </fieldset>
  </div>
  {#snippet actions()}
    <button class="btn btn-ghost" onclick={() => editOpen = false}>Cancel</button>
    <button class="btn btn-primary" onclick={submit}>{editing ? 'Save' : 'Add'}</button>
  {/snippet}
</Modal>

<Confirm
  open={confirmDelete !== null}
  title="Delete shot type?"
  message="Existing matches that used this type will still display the label, but it will no longer be available for new points."
  confirmLabel="Delete"
  danger
  onConfirm={doDelete}
  onCancel={() => confirmDelete = null}
/>
