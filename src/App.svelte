<script lang="ts">
  import { onMount } from 'svelte';
  import { current, tabOf } from './stores/router.svelte';
  import { app } from './stores/app.svelte';
  import BottomNav from './components/BottomNav.svelte';
  import HomeView from './routes/HomeView.svelte';
  import MatchView from './routes/MatchView.svelte';
  import HistoryView from './routes/HistoryView.svelte';
  import MatchDetail from './routes/MatchDetail.svelte';
  import SettingsView from './routes/SettingsView.svelte';
  import SettingsPlayers from './routes/SettingsPlayers.svelte';
  import SettingsShotTypes from './routes/SettingsShotTypes.svelte';
  import SettingsMatchConfig from './routes/SettingsMatchConfig.svelte';
  import SettingsData from './routes/SettingsData.svelte';
  import PlayerProfile from './routes/PlayerProfile.svelte';

  const route = $derived(current());
  const tab = $derived(tabOf(route));
  const showNav = $derived(tab !== 'match' || !app.activeMatch);

  let nosleep: { enable: () => void; disable: () => void } | null = null;

  onMount(async () => {
    const NoSleep = (await import('nosleep.js')).default;
    nosleep = new NoSleep();
  });

  $effect(() => {
    if (!nosleep) return;
    if (app.activeMatch && tab === 'match') {
      try { nosleep.enable(); } catch {}
    } else {
      try { nosleep.disable(); } catch {}
    }
  });
</script>

<div class="flex flex-col h-full bg-base-100 text-base-content">
  <main class="flex-1 overflow-hidden">
    {#if route.name === 'home'}
      <HomeView />
    {:else if route.name === 'match'}
      <MatchView />
    {:else if route.name === 'history'}
      <HistoryView />
    {:else if route.name === 'historyDetail'}
      <MatchDetail matchId={route.matchId} />
    {:else if route.name === 'settings'}
      <SettingsView />
    {:else if route.name === 'settingsPlayers'}
      <SettingsPlayers />
    {:else if route.name === 'settingsShotTypes'}
      <SettingsShotTypes />
    {:else if route.name === 'settingsMatchConfig'}
      <SettingsMatchConfig />
    {:else if route.name === 'settingsData'}
      <SettingsData />
    {:else if route.name === 'player'}
      <PlayerProfile playerId={route.playerId} />
    {/if}
  </main>
  {#if showNav}
    <BottomNav />
  {/if}
</div>
