<script lang="ts">
  import { switchTab, tabOf, current, type Tab } from '../stores/router.svelte';

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'home', label: 'Home', icon: 'M3 12l9-9 9 9M5 10v10h14V10' },
    { id: 'match', label: 'Match', icon: 'M12 2v20M2 12h20' },
    { id: 'history', label: 'History', icon: 'M3 3v18h18M7 14l4-4 4 4 5-5' },
    { id: 'settings', label: 'Settings', icon: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z' }
  ];

  const activeTab = $derived(tabOf(current()));
</script>

<nav class="safe-bottom bg-base-200 border-t border-base-300">
  <div class="grid grid-cols-4">
    {#each tabs as t (t.id)}
      <button
        class="flex flex-col items-center justify-center py-2 gap-1 transition-colors {activeTab === t.id ? 'text-primary' : 'text-base-content/60'}"
        onclick={() => switchTab(t.id)}
        aria-label={t.label}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d={t.icon}/>
        </svg>
        <span class="text-[11px] font-medium">{t.label}</span>
      </button>
    {/each}
  </div>
</nav>
