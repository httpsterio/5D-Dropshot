<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    open: boolean;
    title?: string;
    onClose?: () => void;
    children: Snippet;
    actions?: Snippet;
  }

  let { open, title, onClose, children, actions }: Props = $props();

  function handleBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget && onClose) onClose();
  }
</script>

{#if open}
  <div
    role="presentation"
    class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 safe-bottom"
    onclick={handleBackdrop}
  >
    <div class="bg-base-100 rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[90dvh] flex flex-col shadow-xl">
      {#if title}
        <div class="px-4 pt-4 pb-2 border-b border-base-300">
          <h2 class="text-lg font-semibold">{title}</h2>
        </div>
      {/if}
      <div class="overflow-y-auto p-4 flex-1">
        {@render children()}
      </div>
      {#if actions}
        <div class="border-t border-base-300 p-3 flex gap-2 justify-end">
          {@render actions()}
        </div>
      {/if}
    </div>
  </div>
{/if}
