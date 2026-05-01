<script lang="ts">
  import { app, getPlayer, getShotType, deleteMatch } from '../stores/app.svelte';
  import { back } from '../stores/router.svelte';
  import { formatDuration } from '../lib/stats';
  import AppBar from '../components/AppBar.svelte';
  import Confirm from '../components/Confirm.svelte';

  interface Props { matchId: string; }
  let { matchId }: Props = $props();

  const match = $derived(app.matches.find((m) => m.id === matchId));
  const lp = $derived(match ? getPlayer(match.leftPlayerId) : undefined);
  const rp = $derived(match ? getPlayer(match.rightPlayerId) : undefined);

  let confirmDelete = $state(false);

  function fmtDate(ts: number) {
    return new Date(ts).toLocaleString();
  }

  function doDelete() {
    confirmDelete = false;
    if (match) deleteMatch(match.id);
    back();
  }
</script>

<div class="flex flex-col h-full">
  <AppBar title="Match detail" showBack />

  {#if !match}
    <p class="text-center py-12 text-base-content/50">Match not found</p>
  {:else}
    <div class="flex-1 overflow-y-auto p-4 space-y-4">

      <div class="card bg-base-200">
        <div class="card-body p-4">
          <div class="flex items-center justify-between">
            <div class="flex-1 min-w-0">
              <div class="text-xs text-base-content/60 truncate">{lp?.name ?? '—'}</div>
              <div class="text-4xl font-bold tabular {match.winnerId === match.leftPlayerId ? 'text-success' : ''}">{match.leftScore}</div>
            </div>
            <div class="text-base-content/40 text-2xl px-2">vs</div>
            <div class="flex-1 min-w-0 text-right">
              <div class="text-xs text-base-content/60 truncate">{rp?.name ?? '—'}</div>
              <div class="text-4xl font-bold tabular {match.winnerId === match.rightPlayerId ? 'text-success' : ''}">{match.rightScore}</div>
            </div>
          </div>
          <div class="flex justify-between text-xs text-base-content/60 mt-3">
            <span>{fmtDate(match.endedAt)}</span>
            <span>{formatDuration(match.endedAt - match.startedAt)}</span>
          </div>
          {#if match.isTie}
            <div class="text-center text-sm text-base-content/60 mt-1">Tie</div>
          {/if}
        </div>
      </div>

      <div>
        <h3 class="text-sm font-semibold uppercase tracking-wide text-base-content/60 mb-2">Points ({match.points.length})</h3>
        {#if match.points.length === 0}
          <p class="text-base-content/50 text-sm py-4 text-center">No points logged</p>
        {:else}
          <ol class="space-y-1.5">
            {#each match.points as p, idx (idx)}
              {@const st = getShotType(p.shotTypeId)}
              {@const scoredName = p.scorerSlot === 'left' ? (lp?.name ?? '—') : (rp?.name ?? '—')}
              <li class="bg-base-200 rounded-lg px-3 py-2 text-sm flex items-center gap-2">
                <span class="text-[11px] text-base-content/50 tabular w-6 shrink-0">{idx + 1}.</span>
                <span class="badge badge-sm {p.scorerSlot === 'left' ? 'badge-info' : 'badge-secondary'} shrink-0">{p.scorerSlot === 'left' ? 'L' : 'R'}</span>
                <span class="font-medium truncate">{scoredName}</span>
                <span class="text-base-content/60 truncate">· {st?.label ?? '—'}</span>
              </li>
            {/each}
          </ol>
        {/if}
      </div>

      <button class="btn btn-error btn-outline w-full" onclick={() => confirmDelete = true}>Delete match</button>
    </div>
  {/if}
</div>

<Confirm
  open={confirmDelete}
  title="Delete match?"
  message="This will permanently remove the match from history."
  confirmLabel="Delete"
  danger
  onConfirm={doDelete}
  onCancel={() => confirmDelete = false}
/>
