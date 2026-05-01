<script lang="ts">
  import { app, getPlayer } from '../stores/app.svelte';
  import { go } from '../stores/router.svelte';
  import { formatDuration } from '../lib/stats';
  import AppBar from '../components/AppBar.svelte';

  function fmtDate(ts: number) {
    return new Date(ts).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }
</script>

<div class="flex flex-col h-full">
  <AppBar title="History" />
  <div class="flex-1 overflow-y-auto p-3">
    {#if app.matches.length === 0}
      <p class="text-center text-base-content/50 py-12">No matches played yet</p>
    {:else}
      <div class="space-y-2">
        {#each app.matches as m (m.id)}
          {@const lp = getPlayer(m.leftPlayerId)}
          {@const rp = getPlayer(m.rightPlayerId)}
          <button class="card bg-base-200 w-full text-left active:bg-base-300 transition-colors" onclick={() => go({ name: 'historyDetail', matchId: m.id })}>
            <div class="card-body p-3">
              <div class="flex justify-between items-center">
                <span class="truncate flex-1 text-sm {m.winnerId === m.leftPlayerId ? 'font-semibold' : ''}">{lp?.name ?? '—'}</span>
                <span class="tabular px-2 text-base {m.winnerId === m.leftPlayerId ? 'font-bold text-success' : ''}">{m.leftScore}</span>
                <span class="text-base-content/40">–</span>
                <span class="tabular px-2 text-base {m.winnerId === m.rightPlayerId ? 'font-bold text-success' : ''}">{m.rightScore}</span>
                <span class="truncate flex-1 text-right text-sm {m.winnerId === m.rightPlayerId ? 'font-semibold' : ''}">{rp?.name ?? '—'}</span>
              </div>
              <div class="flex justify-between text-[11px] text-base-content/50 mt-1">
                <span>{fmtDate(m.endedAt)}</span>
                <span>{m.isTie ? 'Tie' : ''} {formatDuration(m.endedAt - m.startedAt)}</span>
              </div>
            </div>
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>
