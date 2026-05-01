<script lang="ts">
  import { back } from '../stores/router.svelte';

  interface Props {
    title: string;
    showBack?: boolean;
    onBack?: () => void;
  }

  let { title, showBack = false, onBack }: Props = $props();

  function handleBack() {
    if (onBack) onBack();
    else back();
  }
</script>

<header class="safe-top bg-base-200 border-b border-base-300">
  <div class="flex items-center h-14 px-3 gap-2">
    {#if showBack}
      <button class="btn btn-ghost btn-sm btn-square" aria-label="Back" onclick={handleBack}>
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
    {/if}
    <h1 class="text-lg font-semibold truncate">{title}</h1>
  </div>
</header>
