<script lang="ts">
	/**
	 * Pocket List Component
	 *
	 * Displays all pockets as cards with actions.
	 * Allows setting default pocket and deleting pockets.
	 */

	import { onMount } from 'svelte';
	import { pocketStore } from '$lib/application/stores/pocketStore.svelte';
	import { formatPocketBalance } from '$lib/domain/Pocket';
	import type { Pocket } from '$lib/domain/Pocket';

	// Load pockets on mount
	onMount(() => {
		pocketStore.loadPockets();
	});

	async function handleSetDefault(pocket: Pocket) {
		if (pocket.isDefault) return;

		const confirmed = confirm(`Set "${pocket.name}" as your default pocket?`);
		if (!confirmed) return;

		await pocketStore.setDefaultPocket(pocket.id);
	}

	async function handleDelete(pocket: Pocket) {
		if (pocket.isDefault) {
			alert('Cannot delete the default pocket. Please set another pocket as default first.');
			return;
		}

		const confirmed = confirm(
			`Are you sure you want to delete "${pocket.name}"?\n\nThis will only work if the pocket has no transactions.`
		);
		if (!confirmed) return;

		const result = await pocketStore.deletePocket(pocket.id);

		if (!result.success) {
			alert(
				result.error ||
					'Failed to delete pocket. Make sure it has no transactions.'
			);
		}
	}
</script>

<div class="pocket-list-container">
	<h2>Your Pockets</h2>

	{#if pocketStore.isLoading}
		<div class="loading-state">
			<p>Loading pockets...</p>
		</div>
	{:else if pocketStore.error}
		<div class="error-state">
			<p>{pocketStore.error}</p>
			<button onclick={() => pocketStore.loadPockets()}>Retry</button>
		</div>
	{:else if pocketStore.pockets.length === 0}
		<div class="empty-state">
			<p>No pockets yet. Create your first pocket above!</p>
		</div>
	{:else}
		<div class="pocket-grid">
			{#each pocketStore.pockets as pocket (pocket.id)}
				<div class="pocket-card" style="border-left: 4px solid {pocket.color}">
					<div class="pocket-header">
						<div class="pocket-title">
							{#if pocket.icon}
								<span class="pocket-icon">{pocket.icon}</span>
							{/if}
							<h3>{pocket.name}</h3>
						</div>
						{#if pocket.isDefault}
							<span class="default-badge">Default</span>
						{/if}
					</div>

					<div class="pocket-balance">
						<span class="balance-label">Balance:</span>
						<span class="balance-amount">{formatPocketBalance(pocket)}</span>
					</div>

					{#if pocket.description}
						<p class="pocket-description">{pocket.description}</p>
					{/if}

					<div class="pocket-meta">
						<span class="currency-badge">{pocket.currency}</span>
						<span class="initial-balance">
							Initial: {formatPocketBalance({
								...pocket,
								current_balance_cents: pocket.initial_balance_cents
							})}
						</span>
					</div>

					<div class="pocket-actions">
						{#if !pocket.isDefault}
							<button
								class="btn-secondary"
								onclick={() => handleSetDefault(pocket)}
							>
								Set as Default
							</button>
						{/if}
						<button
							class="btn-danger"
							onclick={() => handleDelete(pocket)}
							disabled={pocket.isDefault}
						>
							Delete
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.pocket-list-container {
		background: white;
		padding: 1.5rem;
		border-radius: 0.5rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	h2 {
		margin: 0 0 1.5rem 0;
		font-size: 1.5rem;
		font-weight: 600;
		color: #1f2937;
	}

	.loading-state,
	.error-state,
	.empty-state {
		padding: 2rem;
		text-align: center;
		color: #6b7280;
	}

	.error-state {
		color: #dc2626;
	}

	.error-state button {
		margin-top: 1rem;
		padding: 0.5rem 1rem;
		background-color: #4299e1;
		color: white;
		border: none;
		border-radius: 0.375rem;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.error-state button:hover {
		background-color: #3182ce;
	}

	.pocket-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 1.5rem;
	}

	.pocket-card {
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 0.5rem;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		transition: box-shadow 0.2s;
	}

	.pocket-card:hover {
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	.pocket-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
	}

	.pocket-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.pocket-icon {
		font-size: 1.5rem;
	}

	.pocket-title h3 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: #1f2937;
	}

	.default-badge {
		background-color: #dbeafe;
		color: #1e40af;
		padding: 0.25rem 0.5rem;
		border-radius: 0.25rem;
		font-size: 0.75rem;
		font-weight: 500;
	}

	.pocket-balance {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.balance-label {
		font-size: 0.875rem;
		color: #6b7280;
	}

	.balance-amount {
		font-size: 1.5rem;
		font-weight: 700;
		color: #1f2937;
	}

	.pocket-description {
		margin: 0;
		font-size: 0.875rem;
		color: #6b7280;
		line-height: 1.5;
	}

	.pocket-meta {
		display: flex;
		gap: 1rem;
		font-size: 0.75rem;
		color: #6b7280;
	}

	.currency-badge {
		background-color: #f3f4f6;
		padding: 0.25rem 0.5rem;
		border-radius: 0.25rem;
		font-weight: 500;
	}

	.pocket-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: auto;
	}

	.pocket-actions button {
		flex: 1;
		padding: 0.5rem;
		border: none;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-secondary {
		background-color: #f3f4f6;
		color: #374151;
	}

	.btn-secondary:hover {
		background-color: #e5e7eb;
	}

	.btn-danger {
		background-color: #fee2e2;
		color: #dc2626;
	}

	.btn-danger:hover:not(:disabled) {
		background-color: #fecaca;
	}

	.btn-danger:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
