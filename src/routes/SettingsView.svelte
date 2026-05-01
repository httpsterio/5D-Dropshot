<script lang="ts">
  import { go } from '../stores/router.svelte';
  import { app } from '../stores/app.svelte';
  import AppBar from '../components/AppBar.svelte';

  const playerCount = $derived(app.players.filter(p => p.deletedAt === null).length);
  const typeCount = $derived(app.shotTypes.length);
</script>

<div class="flex flex-col h-full">
  <AppBar title="Settings" />
  <div class="flex-1 overflow-y-auto">
    <ul class="divide-y divide-base-300">
      <li>
        <button class="w-full text-left px-4 py-4 active:bg-base-200 flex justify-between items-center" onclick={() => go({ name: 'settingsPlayers' })}>
          <div>
            <div class="font-medium">Players</div>
            <div class="text-xs text-base-content/60">{playerCount} active</div>
          </div>
          <span class="text-base-content/40">›</span>
        </button>
      </li>
      <li>
        <button class="w-full text-left px-4 py-4 active:bg-base-200 flex justify-between items-center" onclick={() => go({ name: 'settingsShotTypes' })}>
          <div>
            <div class="font-medium">Shot types</div>
            <div class="text-xs text-base-content/60">{typeCount} configured</div>
          </div>
          <span class="text-base-content/40">›</span>
        </button>
      </li>
      <li>
        <button class="w-full text-left px-4 py-4 active:bg-base-200 flex justify-between items-center" onclick={() => go({ name: 'settingsMatchConfig' })}>
          <div>
            <div class="font-medium">Match config</div>
            <div class="text-xs text-base-content/60">Play to {app.config.winThreshold}, win by {app.config.winByMargin}</div>
          </div>
          <span class="text-base-content/40">›</span>
        </button>
      </li>
      <li>
        <button class="w-full text-left px-4 py-4 active:bg-base-200 flex justify-between items-center" onclick={() => go({ name: 'settingsData' })}>
          <div>
            <div class="font-medium">Data</div>
            <div class="text-xs text-base-content/60">Export or import</div>
          </div>
          <span class="text-base-content/40">›</span>
        </button>
      </li>
    </ul>
  </div>
</div>
