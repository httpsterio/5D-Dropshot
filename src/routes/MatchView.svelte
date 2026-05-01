<script lang="ts">
  import {
    app,
    getPlayer,
    getShotType,
    scoreOf,
    setSlotPlayer,
    logPoint,
    undoPoint,
    endMatch,
    abortMatch,
    startMatch
  } from '../stores/app.svelte';
  import { switchTab } from '../stores/router.svelte';
  import AppBar from '../components/AppBar.svelte';
  import PointTypePicker from '../components/PointTypePicker.svelte';
  import PlayerPicker from '../components/PlayerPicker.svelte';
  import Confirm from '../components/Confirm.svelte';
  import type { Slot } from '../lib/types';

  // Auto-create active match if none exists when entering this view
  $effect(() => {
    if (!app.activeMatch) startMatch();
  });

  const match = $derived(app.activeMatch);
  const score = $derived(match ? scoreOf(match) : { left: 0, right: 0 });
  const leftPlayer = $derived(match ? getPlayer(match.leftPlayerId) : undefined);
  const rightPlayer = $derived(match ? getPlayer(match.rightPlayerId) : undefined);
  const leftName = $derived(leftPlayer?.name ?? 'Player 1');
  const rightName = $derived(rightPlayer?.name ?? 'Player 2');

  const lastPoints = $derived(match ? match.points.slice(-3).reverse() : []);

  let pickerSlot: Slot | null = $state(null);
  let playerPickerSlot: Slot | null = $state(null);
  let confirmEnd = $state(false);
  let confirmAbort = $state(false);

  const winThreshold = $derived(app.config.winThreshold);
  const winMargin = $derived(app.config.winByMargin);
  const meetsWinCondition = $derived(
    Math.max(score.left, score.right) >= winThreshold &&
    Math.abs(score.left - score.right) >= winMargin
  );
  const showWinPrompt = $derived(
    !!match && meetsWinCondition && !match.winPromptShown
  );

  function openScore(slot: Slot) {
    if (!match) return;
    if (!match.leftPlayerId || !match.rightPlayerId) {
      playerPickerSlot = !match.leftPlayerId ? 'left' : 'right';
      return;
    }
    pickerSlot = slot;
  }

  function onPickShot(shotTypeId: string) {
    if (pickerSlot && match) {
      logPoint(pickerSlot, shotTypeId);
    }
    pickerSlot = null;
  }

  function dismissWinPrompt(end: boolean) {
    if (!match) return;
    if (end) {
      doEnd();
    } else {
      match.winPromptShown = true;
    }
  }

  function doEnd() {
    confirmEnd = false;
    const finished = endMatch();
    if (finished) {
      switchTab('history');
    } else {
      // missing player assignment
      switchTab('home');
    }
  }

  function doAbort() {
    confirmAbort = false;
    abortMatch();
    switchTab('home');
  }

  function fmtTime(ts: number) {
    return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
</script>

<div class="flex flex-col h-full">
  <AppBar title="Match" />

  {#if match}
    <div class="flex-1 flex flex-col overflow-hidden">

      <!-- Player slot row -->
      <div class="grid grid-cols-2 border-b border-base-300">
        <button class="py-3 px-3 text-center active:bg-base-200 transition-colors border-r border-base-300" onclick={() => playerPickerSlot = 'left'}>
          <div class="text-[10px] uppercase tracking-wide text-base-content/50">Left</div>
          <div class="font-medium truncate {leftPlayer ? '' : 'text-base-content/50'}">{leftName}</div>
        </button>
        <button class="py-3 px-3 text-center active:bg-base-200 transition-colors" onclick={() => playerPickerSlot = 'right'}>
          <div class="text-[10px] uppercase tracking-wide text-base-content/50">Right</div>
          <div class="font-medium truncate {rightPlayer ? '' : 'text-base-content/50'}">{rightName}</div>
        </button>
      </div>

      <!-- Score display -->
      <div class="grid grid-cols-2 py-6 border-b border-base-300">
        <div class="text-center">
          <div class="text-7xl font-bold tabular leading-none">{score.left}</div>
        </div>
        <div class="text-center">
          <div class="text-7xl font-bold tabular leading-none">{score.right}</div>
        </div>
      </div>

      <!-- Last points -->
      <div class="flex-1 overflow-y-auto px-3 py-2 min-h-0">
        <div class="text-[10px] uppercase tracking-wide text-base-content/50 mb-2 px-1">Last points</div>
        {#if lastPoints.length === 0}
          <p class="text-center text-sm text-base-content/40 py-4">No points yet</p>
        {:else}
          <ul class="space-y-1.5">
            {#each lastPoints as p, i (match.points.length - i)}
              {@const st = getShotType(p.shotTypeId)}
              {@const scoredName = p.scorerSlot === 'left' ? leftName : rightName}
              <li class="bg-base-200 rounded-lg px-3 py-2 text-sm flex items-center justify-between">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="badge badge-sm {p.scorerSlot === 'left' ? 'badge-info' : 'badge-secondary'}">{p.scorerSlot === 'left' ? 'L' : 'R'}</span>
                  <span class="font-medium truncate">{scoredName}</span>
                  <span class="text-base-content/50 truncate">· {st?.label ?? '—'}</span>
                </div>
                <span class="text-[11px] text-base-content/50 tabular shrink-0 ml-2">{fmtTime(p.timestamp)}</span>
              </li>
            {/each}
          </ul>
        {/if}
      </div>

      <!-- Action row -->
      <div class="border-t border-base-300 p-3 space-y-2 safe-bottom">
        <div class="flex gap-2">
          <button class="btn btn-ghost btn-sm flex-1" onclick={undoPoint} disabled={match.points.length === 0}>Undo</button>
          <button class="btn btn-ghost btn-sm flex-1 text-error" onclick={() => confirmAbort = true}>Abort</button>
          <button class="btn btn-ghost btn-sm flex-1 text-success" onclick={() => confirmEnd = true}>End</button>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <button class="btn btn-primary h-16 text-lg" onclick={() => openScore('left')}>+ {leftName}</button>
          <button class="btn btn-primary h-16 text-lg" onclick={() => openScore('right')}>+ {rightName}</button>
        </div>
      </div>
    </div>
  {/if}
</div>

<PointTypePicker
  open={pickerSlot !== null}
  slot={pickerSlot ?? 'left'}
  {leftName}
  {rightName}
  onPick={onPickShot}
  onCancel={() => pickerSlot = null}
/>

<PlayerPicker
  open={playerPickerSlot !== null}
  title="Assign {playerPickerSlot === 'left' ? 'left' : 'right'} player"
  excludeId={playerPickerSlot === 'left' ? match?.rightPlayerId : match?.leftPlayerId}
  onPick={(id) => { if (playerPickerSlot) setSlotPlayer(playerPickerSlot, id); playerPickerSlot = null; }}
  onCancel={() => playerPickerSlot = null}
/>

<Confirm
  open={showWinPrompt}
  title="Match point reached"
  message="One side has won by margin. End the match now or keep playing?"
  confirmLabel="End match"
  cancelLabel="Keep playing"
  onConfirm={() => dismissWinPrompt(true)}
  onCancel={() => dismissWinPrompt(false)}
/>

<Confirm
  open={confirmEnd}
  title="End match?"
  message="Save current score and finalize this match."
  confirmLabel="End match"
  onConfirm={doEnd}
  onCancel={() => confirmEnd = false}
/>

<Confirm
  open={confirmAbort}
  title="Abort match?"
  message="The current match will be discarded. This cannot be undone."
  confirmLabel="Abort"
  danger
  onConfirm={doAbort}
  onCancel={() => confirmAbort = false}
/>
