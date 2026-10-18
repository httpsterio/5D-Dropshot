<script lang="ts">
  import { app, getPlayer } from '../stores/app.svelte';
  import { go } from '../stores/router.svelte';
  import { statsFor, formatDuration } from '../lib/stats';
  import { eloSeries } from '../lib/eloHistory';
  import AppBar from '../components/AppBar.svelte';
  import EloChart from '../components/EloChart.svelte';

  interface Props { playerId: string; }
  let { playerId }: Props = $props();

  const player = $derived(getPlayer(playerId));
  const stats = $derived(statsFor(playerId, app.matches, app.shotTypes, app.historyVersion));

  const winners = $derived([...stats.shotBreakdown.values()].filter(s => s.attribution === 'winner').sort((a, b) => b.count - a.count));
  const errors = $derived([...stats.shotBreakdown.values()].filter(s => s.attribution === 'error').sort((a, b) => b.count - a.count));

  const playerMatches = $derived(app.matches.filter(m => m.leftPlayerId === playerId || m.rightPlayerId === playerId));
  const eloPoints = $derived(eloSeries(playerId, [...playerMatches].sort((a, b) => a.endedAt - b.endedAt), player?.elo ?? 1000));

  function fmtDate(ts: number) {
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
</script>

<div class="flex flex-col h-full">
  <AppBar title={player?.name ?? 'Player'} showBack />

  {#if !player}
    <p class="text-center py-12 text-base-content/50">Player not found</p>
  {:else}
    <div class="flex-1 overflow-y-auto p-4 space-y-4">

      <div class="bg-base-200 rounded-xl p-4 text-center">
        <div class="text-[11px] text-base-content/60 uppercase tracking-wide">Elo Rating</div>
        <div class="text-4xl font-bold tabular mt-1">{player.elo ?? 1000}</div>
      </div>

      <div class="grid grid-cols-3 gap-2">
        <div class="bg-base-200 rounded-xl p-3 text-center">
          <div class="text-[11px] text-base-content/60">Wins</div>
          <div class="text-2xl font-bold tabular text-success">{stats.wins}</div>
        </div>
        <div class="bg-base-200 rounded-xl p-3 text-center">
          <div class="text-[11px] text-base-content/60">Losses</div>
          <div class="text-2xl font-bold tabular text-error">{stats.losses}</div>
        </div>
        <div class="bg-base-200 rounded-xl p-3 text-center">
          <div class="text-[11px] text-base-content/60">Ties</div>
          <div class="text-2xl font-bold tabular">{stats.ties}</div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div class="bg-base-200 rounded-xl p-3 text-center">
          <div class="text-[11px] text-base-content/60">Points won</div>
          <div class="text-xl font-semibold tabular">{stats.totalPoints}</div>
        </div>
        <div class="bg-base-200 rounded-xl p-3 text-center">
          <div class="text-[11px] text-base-content/60">Points conceded</div>
          <div class="text-xl font-semibold tabular">{stats.pointsConceded}</div>
        </div>
      </div>

      {#if eloPoints.length > 1}
        <section>
          <h3 class="text-xs uppercase tracking-wide text-base-content/60 font-semibold mb-2 px-1">Elo history</h3>
          <EloChart points={eloPoints} />
        </section>
      {/if}

      <section>
        <h3 class="text-xs uppercase tracking-wide text-success/80 font-semibold mb-2 px-1">Winning shots</h3>
        {#if winners.length === 0}
          <p class="text-sm text-base-content/50 text-center py-2">No data</p>
        {:else}
          <ul class="space-y-1.5">
            {#each winners as s (s.label)}
              <li class="relative overflow-hidden bg-base-200 rounded-lg px-3 py-2 flex justify-between items-center text-sm">
                <span class="absolute inset-y-0 left-0 bg-success/30" style="width: {s.pct}%"></span>
                <span class="relative z-10 truncate text-base-content">{s.label}</span>
                <span class="relative z-10 tabular text-base-content/70 shrink-0 ml-2">{s.count} <span class="text-base-content/50">({s.pct.toFixed(1)}%)</span></span>
              </li>
            {/each}
          </ul>
        {/if}
      </section>

      <section>
        <h3 class="text-xs uppercase tracking-wide text-error/80 font-semibold mb-2 px-1">Errors made</h3>
        {#if errors.length === 0}
          <p class="text-sm text-base-content/50 text-center py-2">No data</p>
        {:else}
          <ul class="space-y-1.5">
            {#each errors as s (s.label)}
              <li class="relative overflow-hidden bg-base-200 rounded-lg px-3 py-2 flex justify-between items-center text-sm">
                <span class="absolute inset-y-0 left-0 bg-error/30" style="width: {s.pct}%"></span>
                <span class="relative z-10 truncate text-base-content">{s.label}</span>
                <span class="relative z-10 tabular text-base-content/70 shrink-0 ml-2">{s.count} <span class="text-base-content/50">({s.pct.toFixed(1)}%)</span></span>
              </li>
            {/each}
          </ul>
        {/if}
      </section>

      <section>
        <h3 class="text-xs uppercase tracking-wide text-base-content/60 font-semibold mb-2 px-1">Matches ({playerMatches.length})</h3>
        {#if playerMatches.length === 0}
          <p class="text-sm text-base-content/50 text-center py-2">No matches</p>
        {:else}
          <ul class="space-y-2">
            {#each playerMatches as m (m.id)}
              {@const isLeft = m.leftPlayerId === playerId}
              {@const opp = isLeft ? getPlayer(m.rightPlayerId) : getPlayer(m.leftPlayerId)}
              {@const my = isLeft ? m.leftScore : m.rightScore}
              {@const their = isLeft ? m.rightScore : m.leftScore}
              {@const won = m.winnerId === playerId}
              <li>
                <button class="card bg-base-200 w-full text-left active:bg-base-300" onclick={() => go({ name: 'historyDetail', matchId: m.id })}>
                  <div class="card-body p-3 text-sm">
                    <div class="flex items-center justify-between">
                      <span class="text-xs px-2 py-0.5 rounded {m.isTie ? 'bg-base-300' : won ? 'bg-success/30 text-success' : 'bg-error/30 text-error'}">
                        {m.isTie ? 'Tie' : won ? 'Won' : 'Lost'}
                      </span>
                      <span class="tabular font-semibold">{my} – {their}</span>
                    </div>
                    <div class="flex justify-between text-xs text-base-content/60 mt-1">
                      <span class="truncate">vs {opp?.name ?? '—'}</span>
                      <span>{fmtDate(m.endedAt)} · {formatDuration(m.endedAt - m.startedAt)}</span>
                    </div>
                  </div>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    </div>
  {/if}
</div>
