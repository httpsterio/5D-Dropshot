<script lang="ts">
  import { onMount } from 'svelte';
  import { app, setConfig } from '../stores/app.svelte';
  import AppBar from '../components/AppBar.svelte';
  import { WAKE_WORD_PRESETS, validateWakeWord } from '../lib/voice';
  import { SHERPA_DOWNLOAD_MB, downloadSherpaAssets, isSherpaCached } from '../lib/sherpaEngine';

  const CUSTOM = 'custom';

  let engineMode = $state(app.config.voiceEngine === 'offline' ? 'offline' : 'chrome');
  let engineBusy = $state(false);
  let engineProgress = $state(0);
  let engineError = $state('');
  let engineReady = $state(false);

  onMount(() => {
    void isSherpaCached().then((cached) => {
      if (!engineBusy) engineReady = cached;
    }).catch(() => {});
  });

  function selectEngine(value: string): void {
    engineError = '';
    if (value === 'chrome') {
      engineMode = 'chrome';
      setConfig({ voiceEngine: 'chrome' });
      return;
    }
    if (engineReady) {
      engineReady = true;
      engineMode = 'offline';
      setConfig({ voiceEngine: 'offline' });
      return;
    }
    engineMode = 'offline';
    void ensureOffline('chrome');
  }

  async function ensureOffline(revertTo: string): Promise<void> {
    if (engineBusy) return;
    engineBusy = true;
    engineProgress = 0;
    engineError = '';
    try {
      await downloadSherpaAssets((loaded, total) => {
        engineProgress = total > 0 ? Math.floor((loaded / total) * 100) : 0;
      });
      engineReady = true;
      if (engineMode === 'offline') {
        setConfig({ voiceEngine: 'offline' });
      }
    } catch (error) {
      // Keep the previous engine and show why loading failed.
      engineError = error instanceof Error ? error.message : String(error);
      if (engineMode === 'offline') engineMode = revertTo;
    } finally {
      engineBusy = false;
    }
  }

  function isPreset(value: string): boolean {
    return WAKE_WORD_PRESETS.includes(value);
  }

  const wakeWord = $derived(app.config.wakeWord || 'point');
  let mode = $state(isPreset(app.config.wakeWord) ? app.config.wakeWord : CUSTOM);
  let custom = $state(isPreset(app.config.wakeWord) ? '' : app.config.wakeWord);
  let customError = $state('');

  function selectMode(value: string): void {
    mode = value;
    customError = '';
    if (value === CUSTOM) {
      custom = isPreset(app.config.wakeWord) ? '' : app.config.wakeWord;
    } else {
      setConfig({ wakeWord: value });
    }
  }

  function onCustomInput(value: string): void {
    custom = value;
    const result = validateWakeWord(value);
    customError = result.ok ? '' : result.reason;
  }

  function onCustomChange(value: string): void {
    const result = validateWakeWord(value);
    if (result.ok) {
      custom = result.value;
      customError = '';
      setConfig({ wakeWord: result.value });
    } else {
      customError = result.reason;
    }
  }
</script>

<div class="flex flex-col h-full">
  <AppBar title="Voice commands" showBack />
  <div class="flex-1 overflow-y-auto p-4 space-y-4">

    <label class="block">
      <span class="text-sm text-base-content/60">Speech engine</span>
      <select class="select select-bordered w-full mt-1" value={engineMode} onchange={(e) => selectEngine(e.currentTarget.value)}>
        <option value="chrome">Chrome (needs internet)</option>
        <option value="offline">Offline (stores about {SHERPA_DOWNLOAD_MB} MB on this device)</option>
      </select>
      {#if engineBusy}
        <span class="text-xs text-base-content/50 block mt-1">Loading… {engineProgress}%</span>
      {:else if engineError}
        <span class="text-xs text-error block mt-1">{engineError}</span>
      {:else if engineMode === 'offline' && engineReady}
        <span class="text-xs text-success block mt-1">Downloaded · model starts when you use the mic</span>
      {:else if engineMode === 'offline'}
        <button class="btn btn-sm btn-outline mt-2" onclick={() => ensureOffline('offline')}>Download offline files</button>
      {/if}
    </label>

    <label class="block">
      <span class="text-sm text-base-content/60">Wake word</span>
      <select class="select select-bordered w-full mt-1" value={mode} onchange={(e) => selectMode(e.currentTarget.value)}>
        {#each WAKE_WORD_PRESETS as preset (preset)}
          <option value={preset}>{preset}</option>
        {/each}
        <option value={CUSTOM}>Custom</option>
      </select>
    </label>

    {#if mode === CUSTOM}
      <label class="block">
        <span class="text-sm text-base-content/60">Custom word</span>
        <input
          type="text"
          class="input input-bordered w-full mt-1"
          placeholder="e.g. shuttle"
          value={custom}
          oninput={(e) => onCustomInput(e.currentTarget.value)}
          onchange={(e) => onCustomChange(e.currentTarget.value)}
        />
        {#if customError}
          <span class="text-xs text-error block mt-1">{customError}</span>
        {/if}
      </label>
    {/if}

    <div class="card bg-base-200">
      <div class="card-body p-4 space-y-4">
        <p class="text-sm">Tap the mic on the match screen. Keep the screen on and the phone near the court.</p>

        <div class="space-y-2">
          <p class="text-sm">Start every command with "{wakeWord}".</p>
          <ul class="text-sm list-disc pl-5 space-y-1">
            <li>{wakeWord} left drive: point to the left player, drive winner</li>
            <li>{wakeWord} right net: point to the right player, the left player hit the net</li>
            <li>{wakeWord} undo: undo the last point</li>
            <li>{wakeWord} help: hear the list of reasons</li>
          </ul>
        </div>

        <div class="space-y-2">
          <h2 class="text-sm font-semibold">Players</h2>
          <ul class="text-sm list-disc pl-5 space-y-1">
            <li>left or player one</li>
            <li>right or player two</li>
            <li>Names work if the phone recognizes them.</li>
          </ul>
        </div>

        <div class="space-y-2">
          <h2 class="text-sm font-semibold">Reasons</h2>
          <ul class="text-sm list-disc pl-5 space-y-1">
            <li>Winners: smash, drop, kill, clear, drive</li>
            <li>Errors by the other player: service, net, out, mishit, error</li>
          </ul>
        </div>

        <div class="space-y-2">
          <h2 class="text-sm font-semibold">Two steps</h2>
          <p class="text-sm">Say "{wakeWord}" and wait for the high tone. Say the rest within 8 seconds. A low tone means it timed out.</p>
        </div>

        <p class="text-sm">The phone reads back each point. If it is wrong, say "{wakeWord} undo".</p>
      </div>
    </div>
  </div>
</div>
