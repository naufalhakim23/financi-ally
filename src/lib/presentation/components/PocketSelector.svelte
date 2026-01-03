<script lang="ts">
	/**
	 * Pocket Selector Component
	 *
	 * Dropdown component for selecting a pocket.
	 * Used in TransactionForm to choose which pocket a transaction belongs to.
	 */

	import { pocketStore } from '$lib/application/stores/pocketStore.svelte';
	import { getCurrencySymbol } from '$lib/domain/Pocket';

	interface Props {
		selectedPocketId: string;
		onselect?: (pocketId: string) => void;
	}

	let { selectedPocketId = $bindable(''), onselect }: Props = $props();

	// Load pockets on mount
	$effect(() => {
		if (pocketStore.pockets.length === 0) {
			pocketStore.loadPockets();
		}
	});

	// Set default pocket if no selection
	$effect(() => {
		if (!selectedPocketId && pocketStore.defaultPocket) {
			selectedPocketId = pocketStore.defaultPocket.id;
		}
	});

	function handleChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		const pocketId = target.value;
		selectedPocketId = pocketId;

		if (onselect) {
			onselect(pocketId);
		}
	}
</script>

<div class="pocket-selector">
	<label for="pocket-select">Pocket</label>

	{#if pocketStore.isLoading}
		<div class="loading">Loading pockets...</div>
	{:else if pocketStore.error}
		<div class="error">{pocketStore.error}</div>
	{:else}
		<select
			id="pocket-select"
			value={selectedPocketId}
			onchange={handleChange}
			required
		>
			<option value="" disabled>Select a pocket</option>
			{#each pocketStore.pockets as pocket (pocket.id)}
				<option value={pocket.id}>
					{#if pocket.icon}{pocket.icon}{/if}
					{pocket.name} ({getCurrencySymbol(pocket.currency)})
					{#if pocket.isDefault}• Default{/if}
				</option>
			{/each}
		</select>
	{/if}
</div>

<style>
	.pocket-selector {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin-bottom: var(--space-4);
	}

	label {
		font-weight: var(--font-weight-medium);
		font-size: var(--text-sm);
		color: var(--color-text-primary);
	}

	select {
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--color-border-primary);
		border-radius: var(--radius-md);
		font-size: var(--text-base);
		font-family: var(--font-body);
		background-color: var(--color-bg-primary);
		color: var(--color-text-primary);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	select:hover {
		border-color: var(--color-border-secondary);
	}

	select:focus {
		outline: none;
		border-color: var(--color-border-focus);
		box-shadow: var(--shadow-focus);
	}

	.loading,
	.error {
		padding: var(--space-3);
		border-radius: var(--radius-md);
		font-size: var(--text-sm);
	}

	.loading {
		background-color: var(--color-bg-secondary);
		color: var(--color-text-tertiary);
	}

	.error {
		background-color: var(--color-error-100);
		color: var(--color-error-700);
	}
</style>
