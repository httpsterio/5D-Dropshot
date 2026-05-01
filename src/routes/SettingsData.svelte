<script lang="ts">
  import { app, exportSnapshot, replaceAll } from '../stores/app.svelte';
  import { validateExportFile } from '../lib/schema';
  import AppBar from '../components/AppBar.svelte';
  import Confirm from '../components/Confirm.svelte';

  let importText = $state('');
  let pendingImport = $state<ReturnType<typeof exportSnapshot> | null>(null);
  let toast = $state<{ msg: string; kind: 'success' | 'error' } | null>(null);
  let fileInput: HTMLInputElement;

  function showToast(msg: string, kind: 'success' | 'error' = 'success') {
    toast = { msg, kind };
    setTimeout(() => { toast = null; }, 3000);
  }

  function doExport() {
    const data = exportSnapshot();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dropshot-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported');
  }

  async function pickFile() {
    fileInput.click();
  }

  async function onFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    importText = await file.text();
    input.value = '';
    parseImport();
  }

  function parseImport() {
    try {
      const raw = JSON.parse(importText);
      const result = validateExportFile(raw);
      if (!result.ok) {
        showToast(`Invalid: ${result.error}`, 'error');
        return;
      }
      pendingImport = result.value;
    } catch (err) {
      showToast('Invalid JSON', 'error');
    }
  }

  function confirmImport() {
    if (!pendingImport) return;
    replaceAll({
      players: pendingImport.data.players,
      shotTypes: pendingImport.data.shotTypes,
      matches: pendingImport.data.matches,
      config: pendingImport.data.config
    });
    pendingImport = null;
    importText = '';
    showToast('Imported');
  }
</script>

<div class="flex flex-col h-full">
  <AppBar title="Data" showBack />
  <div class="flex-1 overflow-y-auto p-4 space-y-5">

    <section>
      <h3 class="font-medium mb-2">Export</h3>
      <p class="text-sm text-base-content/60 mb-3">Save players, shot types, match history, and config to a JSON file.</p>
      <button class="btn btn-primary w-full" onclick={doExport}>Download JSON</button>
    </section>

    <section>
      <h3 class="font-medium mb-2">Import</h3>
      <p class="text-sm text-base-content/60 mb-3">
        <strong>Replaces all current data.</strong> Currently {app.players.length} players, {app.matches.length} matches.
      </p>
      <input bind:this={fileInput} type="file" accept="application/json" class="hidden" onchange={onFileChange} />
      <button class="btn btn-outline w-full" onclick={pickFile}>Choose JSON file</button>
    </section>
  </div>
</div>

<Confirm
  open={pendingImport !== null}
  title="Replace all data?"
  message="The import will overwrite all players, shot types, matches, and config. This cannot be undone."
  confirmLabel="Import"
  danger
  onConfirm={confirmImport}
  onCancel={() => pendingImport = null}
/>

{#if toast}
  <div class="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg {toast.kind === 'success' ? 'bg-success text-success-content' : 'bg-error text-error-content'}">
    {toast.msg}
  </div>
{/if}
