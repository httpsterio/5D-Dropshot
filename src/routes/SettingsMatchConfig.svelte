<script lang="ts">
  import { app, setConfig } from '../stores/app.svelte';
  import AppBar from '../components/AppBar.svelte';

  let threshold = $state(app.config.winThreshold);
  let margin = $state(app.config.winByMargin);

  $effect(() => {
    if (Number.isFinite(threshold) && threshold > 0) {
      setConfig({ winThreshold: Math.floor(threshold) });
    }
  });

  $effect(() => {
    if (Number.isFinite(margin) && margin >= 0) {
      setConfig({ winByMargin: Math.floor(margin) });
    }
  });
</script>

<div class="flex flex-col h-full">
  <AppBar title="Match config" showBack />
  <div class="flex-1 overflow-y-auto p-4 space-y-4">

    <label class="block">
      <span class="text-sm text-base-content/60">Win threshold (play to)</span>
      <input type="number" min="1" class="input input-bordered w-full mt-1 tabular" bind:value={threshold} />
      <span class="text-xs text-base-content/50 block mt-1">Score needed to win the match.</span>
    </label>

    <label class="block">
      <span class="text-sm text-base-content/60">Win by margin</span>
      <input type="number" min="0" class="input input-bordered w-full mt-1 tabular" bind:value={margin} />
      <span class="text-xs text-base-content/50 block mt-1">Required lead at the threshold (0 = no lead required).</span>
    </label>

    <div class="card bg-base-200">
      <div class="card-body p-3">
        <p class="text-sm">When threshold is met with the required lead, you'll be asked once whether to end. If you keep playing, no further prompt — end the match manually whenever you're done.</p>
      </div>
    </div>
  </div>
</div>
