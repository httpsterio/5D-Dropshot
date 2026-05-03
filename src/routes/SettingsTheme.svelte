<script lang="ts">
  import { app, setConfig } from '../stores/app.svelte';
  import AppBar from '../components/AppBar.svelte';

  const themes = [
    { id: 'dropdark', name: 'Drop Dark', desc: 'Near-black with teal accent' },
    { id: 'bumblebee', name: 'Bumblebee', desc: 'Yellow & black' },
    { id: 'retro', name: 'Retro', desc: 'Beige & orange' },
    { id: 'cmyk', name: 'CMYK', desc: 'Cyan, magenta, yellow' },
    { id: 'business', name: 'Business', desc: 'Professional dark' },
    { id: 'sunset', name: 'Sunset', desc: 'Deep purple & orange' },
    { id: 'abyss', name: 'Abyss', desc: 'Deep blue dark' }
  ];

  function select(id: string) {
    setConfig({ theme: id });
  }
</script>

<div class="flex flex-col h-full">
  <AppBar title="Theme" showBack />
  <div class="flex-1 overflow-y-auto">
    <div class="grid grid-cols-1 divide-y divide-base-300">
      {#each themes as t}
        <button 
          class="w-full text-left px-4 py-4 active:bg-base-200 flex justify-between items-center"
          onclick={() => select(t.id)}
        >
          <div class="flex items-center gap-4">
            <!-- Theme preview swatch -->
            <div data-theme={t.id} class="w-10 h-10 rounded-lg bg-base-100 border border-base-300 flex items-center justify-center shrink-0">
              <div class="flex gap-0.5">
                <div class="w-2 h-2 rounded-full bg-primary"></div>
                <div class="w-2 h-2 rounded-full bg-secondary"></div>
                <div class="w-2 h-2 rounded-full bg-accent"></div>
              </div>
            </div>
            <div>
              <div class="font-medium">{t.name}</div>
              <div class="text-xs text-base-content/60">{t.desc}</div>
            </div>
          </div>
          {#if app.config.theme === t.id}
            <div class="badge badge-primary">Active</div>
          {/if}
        </button>
      {/each}
    </div>
  </div>
</div>
