<script lang="ts">
  import Modal from './Modal.svelte';

  interface Props {
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  }

  let {
    open,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    danger = false,
    onConfirm,
    onCancel
  }: Props = $props();
</script>

<Modal {open} {title} onClose={onCancel}>
  <p class="text-base-content/80">{message}</p>
  {#snippet actions()}
    <button class="btn btn-ghost" onclick={onCancel}>{cancelLabel}</button>
    <button class="btn {danger ? 'btn-error' : 'btn-primary'}" onclick={onConfirm}>{confirmLabel}</button>
  {/snippet}
</Modal>
