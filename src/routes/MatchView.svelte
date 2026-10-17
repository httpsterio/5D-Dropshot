<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
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
  import { computeWinProb, h2hMatchWinRate, inferP } from '../lib/winProb';
  import {
    TONE_HIGH,
    TONE_LOW,
    VOICE_HELP_TEXT,
    VOICE_LANG,
    cancelSpeech,
    getSpeechRecognitionCtor,
    hasSpeechRecognition,
    initVoiceAudio,
    isSpeechMuted,
    normalizeTranscript,
    parseVoiceCommand,
    parseVoiceCompletion,
    playTone,
    speak,
    type SpeechRecognitionEventLike,
    type SpeechRecognitionLike
  } from '../lib/voice';

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

  const winProbs = $derived.by(() => {
    if (!match) return null;
    if (!match.leftPlayerId || !match.rightPlayerId) return { left: 50, right: 50 };
    const winRate = h2hMatchWinRate(match.leftPlayerId, match.rightPlayerId, app.matches);
    const p = inferP(winRate, app.config.winThreshold, app.config.winByMargin);
    const leftWin = computeWinProb(
      score.left, score.right, p,
      app.config.winThreshold, app.config.winByMargin
    );
    const left = Math.round(leftWin * 100);
    return { left, right: 100 - left };
  });

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

  // ---------- Hands-free voice scoring ----------

  const speechSupported = hasSpeechRecognition();
  const VOICE_ARM_TIMEOUT_MS = 8000;
  let voiceOn = $state(false);
  let voiceError = $state('');
  let voiceStatus = $state('Listening');
  let voiceStatusTimer: number | undefined;
  let voiceRestartTimer: number | undefined;
  let recognition: SpeechRecognitionLike | null = null;
  let recognitionRunning = false;
  let lastHeard = '';
  let lastHeardAt = 0;
  let voiceArmed = false;
  let armedSlot: Slot | null = null;
  let voiceArmTimer: number | undefined;
  let nosleep: { enable: () => void; disable: () => void } | null = null;

  const voiceBlocked = $derived(
    pickerSlot !== null ||
      playerPickerSlot !== null ||
      confirmEnd ||
      confirmAbort ||
      confirmUndo ||
      showWinPrompt
  );

  onMount(async () => {
    if (!speechSupported) return;
    try {
      const NoSleep = (await import('nosleep.js')).default;
      nosleep = new NoSleep();
      if (voiceOn) {
        try { nosleep.enable(); } catch { /* ignore */ }
      }
    } catch {
      /* ignore */
    }
  });

  onDestroy(() => {
    stopVoice();
  });

  function flashVoiceStatus(text: string): void {
    voiceStatus = text;
    window.clearTimeout(voiceStatusTimer);
    voiceStatusTimer = window.setTimeout(() => {
      voiceStatus = 'Listening';
    }, 3500);
  }

  function startVoice(): void {
    if (!speechSupported || voiceOn) return;
    voiceError = '';
    voiceStatus = 'Listening';
    voiceOn = true;
    initVoiceAudio();
    try { nosleep?.enable(); } catch { /* ignore */ }
    startRecognition();
  }

  function stopVoice(error = ''): void {
    voiceOn = false;
    voiceError = error;
    window.clearTimeout(voiceRestartTimer);
    window.clearTimeout(voiceStatusTimer);
    recognitionRunning = false;
    disarmVoice();
    try { recognition?.abort(); } catch { /* ignore */ }
    try { nosleep?.disable(); } catch { /* ignore */ }
    cancelSpeech();
  }

  function toggleVoice(): void {
    if (voiceOn) stopVoice();
    else startVoice();
  }

  function startRecognition(): void {
    if (!voiceOn) return;
    const Recognition = getSpeechRecognitionCtor();
    if (!Recognition) return;
    if (!recognition) {
      const rec = new Recognition();
      rec.lang = VOICE_LANG;
      rec.continuous = true;
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onstart = () => { recognitionRunning = true; };
      rec.onend = () => {
        recognitionRunning = false;
        if (!voiceOn) return;
        // Chrome on Android ends the session after silence; restart it.
        window.clearTimeout(voiceRestartTimer);
        voiceRestartTimer = window.setTimeout(() => {
          if (voiceOn) startRecognition();
        }, 250);
      };
      rec.onresult = onVoiceResult;
      rec.onerror = (event) => {
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          stopVoice(`Voice error: ${event.error}`);
        }
      };
      recognition = rec;
    }
    if (recognitionRunning) return;
    try {
      recognition.start();
    } catch {
      /* ignored: already started or not available */
    }
  }

  function onVoiceResult(event: SpeechRecognitionEventLike): void {
    if (!voiceOn || voiceBlocked || isSpeechMuted()) return;
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (!result.isFinal) continue;
      handleVoiceTranscript(result[0]?.transcript ?? '');
    }
  }

  function armVoice(slot: Slot | null): void {
    voiceArmed = true;
    armedSlot = slot;
    window.clearTimeout(voiceStatusTimer);
    voiceStatus = 'Ready';
    playTone(TONE_HIGH);
    window.clearTimeout(voiceArmTimer);
    voiceArmTimer = window.setTimeout(() => {
      disarmVoice();
      playTone(TONE_LOW);
      flashVoiceStatus('Again?');
    }, VOICE_ARM_TIMEOUT_MS);
  }

  function disarmVoice(): void {
    voiceArmed = false;
    armedSlot = null;
    window.clearTimeout(voiceArmTimer);
  }

  function handleVoiceTranscript(transcript: string): void {
    const m = app.activeMatch;
    if (!m || !m.leftPlayerId || !m.rightPlayerId) return;
    const leftName = getPlayer(m.leftPlayerId)?.name ?? '';
    const rightName = getPlayer(m.rightPlayerId)?.name ?? '';
    const command = voiceArmed
      ? parseVoiceCompletion(transcript, leftName, rightName, armedSlot)
      : parseVoiceCommand(transcript, leftName, rightName);
    if (!command) return;

    const heard = normalizeTranscript(transcript);
    const now = Date.now();
    if (heard === lastHeard && now - lastHeardAt < 3000) return;
    lastHeard = heard;
    lastHeardAt = now;

    if (command.kind === 'arm') {
      armVoice(command.slot);
      return;
    }
    disarmVoice();

    if (command.kind === 'help') {
      speak(VOICE_HELP_TEXT);
      flashVoiceStatus(heard);
      return;
    }

    if (command.kind === 'undo') {
      if (!undoPoint()) return;
      const s = scoreOf(m);
      speak(`Undone, ${leftName} ${s.left}, ${rightName} ${s.right}`);
      flashVoiceStatus(heard);
      return;
    }

    logPoint(command.slot, command.shotTypeId);
    const s = scoreOf(m);
    const scorerName = command.slot === 'left' ? leftName : rightName;
    const opponentName = command.slot === 'left' ? rightName : leftName;
    const scorerScore = command.slot === 'left' ? s.left : s.right;
    const opponentScore = command.slot === 'left' ? s.right : s.left;
    speak(
      command.attribution === 'error'
        ? `${scorerName}, ${opponentName} ${command.keyword}, ${scorerScore} ${opponentScore}`
        : `${scorerName}, ${command.keyword}, ${scorerScore} ${opponentScore}`
    );
    flashVoiceStatus(heard);
  }
</script>

<div class="flex flex-col h-full border-4 border-transparent" class:border-success={voiceOn}>
  {#if match}
    <!-- Top action bar: Abort / End -->
    <header class="safe-top bg-base-200 border-b border-base-300 grid grid-cols-2 divide-x divide-base-300">
      <button class="py-3 text-error font-medium active:bg-base-300 transition-colors" onclick={() => confirmAbort = true}>Abort</button>
      <button
        class="py-3 text-success font-medium active:bg-base-300 transition-colors disabled:text-base-content/30 disabled:active:bg-transparent"
        disabled={!match.leftPlayerId || !match.rightPlayerId}
        onclick={() => confirmEnd = true}
      >End</button>
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

      <!-- Win probability -->
      {#if winProbs}
        <div class="border-b border-base-300 px-3 py-2.5">
          <div class="relative h-8 rounded-lg bg-base-300 overflow-hidden">
            <div class="absolute inset-y-0 left-0 bg-info/20 transition-all duration-300" style="width: {winProbs.left}%"></div>
            <div class="absolute inset-0 flex items-center justify-between px-3">
              <span class="text-sm font-bold tabular text-info">{winProbs.left}%</span>
              <span class="text-[10px] uppercase tracking-widest text-base-content/30">Win prob</span>
              <span class="text-sm font-bold tabular text-warning">{winProbs.right}%</span>
            </div>
          </div>
        </div>
      {/if}

      <!-- Voice status -->
      {#if voiceOn || voiceError}
        <div class="shrink-0 border-b border-base-300 px-3 py-1.5 text-xs truncate {voiceError ? 'text-error' : 'text-success'}">
          {voiceError || voiceStatus}
        </div>
      {/if}

      <!-- Last points -->
      <div class="flex-1 overflow-y-auto px-3 py-2 min-h-0">
        <div class="flex items-center mb-2 px-1">
          <span class="text-[10px] uppercase tracking-wide text-base-content/50">Last points</span>
          {#if recentPoints.length > 0}
            <span class="text-[10px] uppercase tracking-wide text-base-content/40 flex items-center gap-1 ml-2">
              Newest
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
            </span>
          {/if}
          <div class="ml-auto flex items-center gap-1.5">
            <button class="btn btn-ghost btn-xs" onclick={() => confirmUndo = true} disabled={match.points.length === 0}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-15-6.7L3 13"/></svg>
              Undo last point
            </button>
            {#if speechSupported}
              <button
                class="btn btn-xs {voiceOn ? 'btn-success' : 'btn-ghost'}"
                aria-label={voiceOn ? 'Turn off voice scoring' : 'Turn on voice scoring'}
                aria-pressed={voiceOn}
                onclick={toggleVoice}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
              </button>
            {/if}
          </div>
        </div>
        {#if recentPoints.length === 0}
          <p class="text-center text-sm text-base-content/40 py-4">No points yet</p>
        {:else}
          <ul class="space-y-1">
            {#each recentPoints as entry, i (entry.pointNumber)}
              {@const p = entry.point}
              {@const st = getShotType(p.shotTypeId)}
              {@const isError = st?.attribution === 'error'}
              {@const scoredName = p.scorerSlot === 'left' ? leftName : rightName}
              {@const oppName = p.scorerSlot === 'left' ? rightName : leftName}
              {@const isLeft = p.scorerSlot === 'left'}
              {@const shotColor = st?.attribution === 'winner' ? 'text-success' : st?.attribution === 'error' ? 'text-error' : 'text-base-content/70'}
              <li class="rounded-lg px-3 py-2 text-sm flex items-center gap-2 transition-opacity
                {fadeOpacity(i)}
                {isLeft ? 'bg-info/15 border-l-4 border-info' : 'bg-warning/15 border-r-4 border-warning'}">
                <span class="text-[11px] text-base-content/50 tabular shrink-0 w-7 {isLeft ? '' : 'order-3 text-right'}">#{entry.pointNumber}</span>
                <div class="flex items-center gap-2 min-w-0 flex-1 {isLeft ? '' : 'justify-end text-right order-2'}">
                  <span class="font-semibold truncate {isLeft ? 'text-info' : 'text-warning'} {isLeft ? '' : 'order-2'}">{scoredName}</span>
                  <span class="{shotColor} truncate {isLeft ? '' : 'order-1'}">{isError ? `${oppName} ` : ''}{st?.label ?? '—'}</span>
                </div>
                <span class="text-[10px] text-base-content/40 tabular shrink-0 {isLeft ? 'order-3' : 'order-1'}">{fmtTime(p.timestamp)}</span>
              </li>
            {/each}
          </ul>
        {/if}
      </div>

      <!-- Action row -->
      <div class="border-t border-base-300 px-3 pt-3" style="padding-bottom: max(1.25rem, env(safe-area-inset-bottom))">
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
