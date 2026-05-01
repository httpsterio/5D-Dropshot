<script lang="ts">
  import { app, getPlayer, scoreOf, startMatch } from '../stores/app.svelte';
  import { go, switchTab } from '../stores/router.svelte';
  import { formatDuration } from '../lib/stats';
  import AppBar from '../components/AppBar.svelte';

  const recent = $derived(app.matches.slice(0, 3));
  const hasActive = $derived(!!app.activeMatch);

  function newMatch() {
    if (!app.activeMatch) startMatch();
    switchTab('match');
  }

  function resume() {
    switchTab('match');
  }

  function fmtDate(ts: number) {
    return new Date(ts).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }
</script>

<div class="flex flex-col h-full">
  <AppBar title="DropShot" />
  <div class="flex-1 overflow-y-auto p-4 space-y-4">

    {#if hasActive && app.activeMatch}
      {@const sc = scoreOf(app.activeMatch)}
      {@const lp = getPlayer(app.activeMatch.leftPlayerId)}
      {@const rp = getPlayer(app.activeMatch.rightPlayerId)}
      <button class="card bg-warning/15 border border-warning/40 w-full text-left active:scale-[0.99] transition-transform" onclick={resume}>
        <div class="card-body p-4">
          <div class="flex justify-between items-center">
            <span class="badge badge-warning badge-sm">Active match</span>
            <span class="text-xs text-base-content/60">{fmtDate(app.activeMatch.startedAt)}</span>
          </div>
          <div class="flex items-center justify-between mt-2">
            <div class="flex-1">
              <div class="text-sm text-base-content/60">{lp?.name ?? 'Player 1'}</div>
              <div class="text-3xl font-bold tabular">{sc.left}</div>
            </div>
            <div class="text-base-content/40 text-xl">vs</div>
            <div class="flex-1 text-right">
              <div class="text-sm text-base-content/60">{rp?.name ?? 'Player 2'}</div>
              <div class="text-3xl font-bold tabular">{sc.right}</div>
            </div>
          </div>
          <div class="text-xs text-base-content/60 mt-2">Tap to resume</div>
        </div>
      </button>
    {/if}

    <button class="btn btn-primary btn-lg w-full h-16 text-base" onclick={newMatch}>
      {hasActive ? 'Open Active Match' : 'Start New Match'}
    </button>

    <div class="grid grid-cols-2 gap-3">
      <div class="stat bg-base-200 rounded-xl p-4">
        <div class="stat-title text-xs">Players</div>
        <div class="stat-value text-2xl tabular">{app.players.filter(p => !p.deletedAt).length}</div>
      </div>
      <div class="stat bg-base-200 rounded-xl p-4">
        <div class="stat-title text-xs">Matches</div>
        <div class="stat-value text-2xl tabular">{app.matches.length}</div>
      </div>
    </div>

    <div>
      <div class="flex justify-between items-baseline mb-2">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-base-content/60">Recent matches</h2>
        {#if app.matches.length > 3}
          <button class="text-xs text-primary" onclick={() => switchTab('history')}>See all</button>
        {/if}
      </div>
      {#if recent.length === 0}
        <p class="text-base-content/50 text-sm py-6 text-center">No matches yet</p>
      {:else}
        <div class="space-y-2">
          {#each recent as m (m.id)}
            {@const lp = getPlayer(m.leftPlayerId)}
            {@const rp = getPlayer(m.rightPlayerId)}
            <button class="card bg-base-200 w-full text-left active:bg-base-300 transition-colors" onclick={() => go({ name: 'historyDetail', matchId: m.id })}>
              <div class="card-body p-3">
                <div class="flex justify-between items-center text-sm">
                  <span class="truncate flex-1 {m.winnerId === m.leftPlayerId ? 'font-semibold' : ''}">{lp?.name ?? '—'}</span>
                  <span class="tabular px-2 {m.winnerId === m.leftPlayerId ? 'font-bold' : 'text-base-content/60'}">{m.leftScore}</span>
                  <span class="text-base-content/40 px-1">–</span>
                  <span class="tabular px-2 {m.winnerId === m.rightPlayerId ? 'font-bold' : 'text-base-content/60'}">{m.rightScore}</span>
                  <span class="truncate flex-1 text-right {m.winnerId === m.rightPlayerId ? 'font-semibold' : ''}">{rp?.name ?? '—'}</span>
                </div>
                <div class="flex justify-between text-[11px] text-base-content/50 mt-1">
                  <span>{fmtDate(m.endedAt)}</span>
                  <span>{formatDuration(m.endedAt - m.startedAt)}</span>
                </div>
              </div>
            </button>
          {/each}
        </div>
      {/if}
    </div>

  </div>
</div>
