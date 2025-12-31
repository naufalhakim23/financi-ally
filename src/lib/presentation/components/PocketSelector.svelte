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
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	label {
		font-weight: 500;
		font-size: 0.875rem;
		color: #374151;
	}

	select {
		padding: 0.5rem;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		font-size: 1rem;
		background-color: white;
		cursor: pointer;
		transition: border-color 0.2s;
	}

	select:hover {
		border-color: #9ca3af;
	}

	select:focus {
		outline: none;
		border-color: #4299e1;
		box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
	}

	.loading,
	.error {
		padding: 0.5rem;
		border-radius: 0.375rem;
		font-size: 0.875rem;
	}

	.loading {
		background-color: #f3f4f6;
		color: #6b7280;
	}

	.error {
		background-color: #fee2e2;
		color: #dc2626;
	}
</style>
