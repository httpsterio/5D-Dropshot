<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
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
  import SettingsTheme from './routes/SettingsTheme.svelte';
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

  $effect(() => {
    const theme = app.config.theme;
    // Update theme-color meta tag if it exists
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      // We could try to get the actual background color from the theme,
      // but for now we'll just let it be or use a heuristic.
      // Many daisyUI dark themes use dark backgrounds.
      const isDark = ['business', 'sunset', 'abyss'].includes(theme);
      meta.setAttribute('content', isDark ? '#1a1a1a' : '#ffffff');
    }
  });
</script>

<div class="flex flex-col h-full bg-base-100 text-base-content" data-theme={app.config.theme}>
  <main class="flex-1 overflow-hidden relative">
    {#key route.name}
      <div class="h-full" in:fade={{ duration: 120 }}>
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
        {:else if route.name === 'settingsTheme'}
          <SettingsTheme />
        {:else if route.name === 'settingsData'}
          <SettingsData />
        {:else if route.name === 'player'}
          <PlayerProfile playerId={route.playerId} />
        {/if}
      </div>
    {/key}
  </main>
  {#if showNav}
    <BottomNav />
  {/if}
</div>
