<script lang="ts">
  import { app, addPlayer, softDeletePlayer, findPlayerByName, restorePlayer, renamePlayer } from '../stores/app.svelte';
  import { go } from '../stores/router.svelte';
  import AppBar from '../components/AppBar.svelte';
  import Modal from '../components/Modal.svelte';
  import Confirm from '../components/Confirm.svelte';

  const active = $derived(app.players.filter(p => p.deletedAt === null));

  let addOpen = $state(false);
  let newName = $state('');
  let restoreOpen = $state(false);
  let restoreTarget = $state<{ id: string; name: string } | null>(null);
  let pendingName = $state('');

  let confirmDelete = $state<{ id: string; name: string } | null>(null);

  function openAdd() {
    newName = '';
    addOpen = true;
  }

  function submitAdd() {
    const name = newName.trim();
    if (!name) return;
    const existing = findPlayerByName(name);
    if (existing && existing.deletedAt !== null) {
      restoreTarget = { id: existing.id, name: existing.name };
      pendingName = name;
      addOpen = false;
      restoreOpen = true;
      return;
    }
    if (existing && existing.deletedAt === null) {
      // duplicate active name — don't add
      addOpen = false;
      return;
    }
    addPlayer(name);
    addOpen = false;
  }

  function doRestore() {
    if (restoreTarget) restorePlayer(restoreTarget.id);
    restoreOpen = false;
    restoreTarget = null;
  }

  function doCreateNewKeepOld() {
    if (restoreTarget) {
      const stamp = new Date().toISOString().slice(0, 10);
      renamePlayer(restoreTarget.id, `${restoreTarget.name} (deleted ${stamp})`);
    }
    addPlayer(pendingName);
    restoreOpen = false;
    restoreTarget = null;
  }

  function doDelete() {
    if (confirmDelete) softDeletePlayer(confirmDelete.id);
    confirmDelete = null;
  }
</script>

<div class="flex flex-col h-full">
  <AppBar title="Players" showBack />
  <div class="flex-1 overflow-y-auto">
    {#if active.length === 0}
      <p class="text-center py-12 text-base-content/50">No players yet</p>
    {:else}
      <ul class="divide-y divide-base-300">
        {#each active as p (p.id)}
          <li class="flex items-stretch">
            <button class="flex-1 text-left px-4 py-3 active:bg-base-200" onclick={() => go({ name: 'player', playerId: p.id })}>
              <div class="font-medium">{p.name}</div>
              <div class="text-xs text-base-content/50">Tap to view profile</div>
            </button>
            <button class="px-4 text-error active:bg-base-200" aria-label="Delete {p.name}" onclick={() => confirmDelete = { id: p.id, name: p.name }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14H7L5 6"/><path d="M10 11v6M14 11v6"/></svg>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
  <div class="border-t border-base-300 px-4 pt-3 pb-5 safe-bottom">
    <button class="btn btn-primary w-full" onclick={openAdd}>Add player</button>
  </div>
</div>

<Modal open={addOpen} title="Add player" onClose={() => addOpen = false}>
  <input
    class="input input-bordered w-full"
    placeholder="Player name"
    bind:value={newName}
    autofocus
    onkeydown={(e) => { if (e.key === 'Enter') submitAdd(); }}
  />
  {#snippet actions()}
    <button class="btn btn-ghost" onclick={() => addOpen = false}>Cancel</button>
    <button class="btn btn-primary" onclick={submitAdd}>Add</button>
  {/snippet}
</Modal>

<Modal open={restoreOpen} title="Player exists" onClose={() => { restoreOpen = false; restoreTarget = null; }}>
  <p class="text-sm">A previous player named <strong>{restoreTarget?.name}</strong> was deleted. What do you want to do?</p>
  {#snippet actions()}
    <button class="btn btn-ghost" onclick={() => { restoreOpen = false; restoreTarget = null; }}>Cancel</button>
    <button class="btn btn-outline" onclick={doCreateNewKeepOld}>Create new</button>
    <button class="btn btn-primary" onclick={doRestore}>Restore</button>
  {/snippet}
</Modal>

<Confirm
  open={confirmDelete !== null}
  title="Delete player?"
  message="{confirmDelete?.name} will be hidden from match selection. Their match history is preserved."
  confirmLabel="Delete"
  danger
  onConfirm={doDelete}
  onCancel={() => confirmDelete = null}
/>
