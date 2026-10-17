<script lang="ts">
  import { app, setConfig } from '../stores/app.svelte';
  import AppBar from '../components/AppBar.svelte';
  import { WAKE_WORD_PRESETS, validateWakeWord } from '../lib/voice';

  const CUSTOM = 'custom';

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
      <div class="card-body p-3 space-y-1.5">
        <p class="text-sm">Say "{wakeWord} &lt;player&gt; &lt;reason&gt;" to score, e.g. "{wakeWord} Sami smash".</p>
        <p class="text-sm">Say "{wakeWord} undo" to remove the most recent score.</p>
        <p class="text-sm">Say "{wakeWord} help" to hear every reason read out.</p>
        <p class="text-sm">Say "{wakeWord}" or "{wakeWord} &lt;player&gt;", wait for the ready tone, then say the rest without the wake word.</p>
      </div>
    </div>
  </div>
</div>
