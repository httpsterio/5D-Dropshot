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

  // Most recent first; up to 8 entries (5 full + 3 fading)
  const recentPoints = $derived.by(() => {
    if (!match) return [];
    const total = match.points.length;
    return match.points.slice(-8).reverse().map((point, i) => ({
      point,
      pointNumber: total - i,
      fadeIndex: i
    }));
  });

  let pickerSlot: Slot | null = $state(null);
  let playerPickerSlot: Slot | null = $state(null);
  let confirmEnd = $state(false);
  let confirmAbort = $state(false);
  let confirmUndo = $state(false);

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
      switchTab('home');
    }
  }

  function doAbort() {
    confirmAbort = false;
    abortMatch();
    switchTab('home');
  }

  function doUndo() {
    confirmUndo = false;
    undoPoint();
  }

  function fadeOpacity(i: number): string {
    if (i < 5) return '';
    if (i === 5) return 'opacity-60';
    if (i === 6) return 'opacity-40';
    return 'opacity-25';
  }

  function fmtTime(ts: number) {
    return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
</script>

<div class="flex flex-col h-full">

  {#if match}
    <!-- Top action bar: Abort / End -->
    <header class="safe-top bg-base-200 border-b border-base-300 grid grid-cols-2 divide-x divide-base-300">
      <button class="py-3 text-error font-medium active:bg-base-300 transition-colors" onclick={() => confirmAbort = true}>Abort</button>
      <button class="py-3 text-success font-medium active:bg-base-300 transition-colors" onclick={() => confirmEnd = true}>End</button>
    </header>

    <div class="flex-1 flex flex-col overflow-hidden">

      <!-- Player slot row -->
      <div class="grid grid-cols-2 border-b border-base-300">
        <button class="py-3 px-3 text-center active:bg-base-200 transition-colors border-r border-base-300" onclick={() => playerPickerSlot = 'left'}>
          <div class="text-[10px] uppercase tracking-wide text-info">Left</div>
          <div class="font-medium truncate {leftPlayer ? '' : 'text-base-content/50'}">{leftName}</div>
        </button>
        <button class="py-3 px-3 text-center active:bg-base-200 transition-colors" onclick={() => playerPickerSlot = 'right'}>
          <div class="text-[10px] uppercase tracking-wide text-warning">Right</div>
          <div class="font-medium truncate {rightPlayer ? '' : 'text-base-content/50'}">{rightName}</div>
        </button>
      </div>

      <!-- Score display -->
      <div class="grid grid-cols-2 py-5 border-b border-base-300">
        <div class="text-center">
          <div class="text-7xl font-bold tabular leading-none text-info">{score.left}</div>
        </div>
        <div class="text-center">
          <div class="text-7xl font-bold tabular leading-none text-warning">{score.right}</div>
        </div>
      </div>

      <!-- Last points -->
      <div class="flex-1 overflow-y-auto px-3 py-2 min-h-0">
        <div class="flex items-center justify-between mb-2 px-1">
          <span class="text-[10px] uppercase tracking-wide text-base-content/50">Last points</span>
          {#if recentPoints.length > 0}
            <span class="text-[10px] uppercase tracking-wide text-base-content/40 flex items-center gap-1">
              Newest
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
            </span>
          {/if}
        </div>
        {#if recentPoints.length === 0}
          <p class="text-center text-sm text-base-content/40 py-4">No points yet</p>
        {:else}
          <ul class="space-y-1">
            {#each recentPoints as entry, i (entry.pointNumber)}
              {@const p = entry.point}
              {@const st = getShotType(p.shotTypeId)}
              {@const scoredName = p.scorerSlot === 'left' ? leftName : rightName}
              {@const isLeft = p.scorerSlot === 'left'}
              <li class="rounded-lg px-3 py-2 text-sm flex items-center gap-2 transition-opacity
                {fadeOpacity(i)}
                {isLeft ? 'bg-info/15 border-l-4 border-info' : 'bg-warning/15 border-r-4 border-warning'}">
                <span class="text-[11px] text-base-content/50 tabular shrink-0 w-7 {isLeft ? '' : 'order-3 text-right'}">#{entry.pointNumber}</span>
                <div class="flex items-center gap-2 min-w-0 flex-1 {isLeft ? '' : 'justify-end text-right order-2'}">
                  <span class="font-semibold truncate {isLeft ? 'text-info' : 'text-warning order-2'}">{scoredName}</span>
                  <span class="text-base-content/70 truncate {isLeft ? '' : 'order-1'}">{st?.label ?? '—'}</span>
                </div>
                <span class="text-[10px] text-base-content/40 tabular shrink-0 {isLeft ? 'order-3' : 'order-1'}">{fmtTime(p.timestamp)}</span>
              </li>
            {/each}
          </ul>
        {/if}
      </div>

      <!-- Action row -->
      <div class="border-t border-base-300 px-3 pt-3 pb-5 space-y-2 safe-bottom">
        <button class="btn btn-ghost btn-sm w-full" onclick={() => confirmUndo = true} disabled={match.points.length === 0}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-15-6.7L3 13"/></svg>
          Undo last point
        </button>
        <div class="grid grid-cols-2 gap-2">
          <button class="btn btn-info h-16 text-base" onclick={() => openScore('left')}>+ {leftName}</button>
          <button class="btn btn-warning h-16 text-base" onclick={() => openScore('right')}>+ {rightName}</button>
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

<Confirm
  open={confirmUndo}
  title="Undo last point?"
  message="The most recent point will be removed."
  confirmLabel="Undo"
  onConfirm={doUndo}
  onCancel={() => confirmUndo = false}
/>
