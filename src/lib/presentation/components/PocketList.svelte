<script lang="ts">
	/**
	 * Pocket List Component - Refactored with new design system
	 * Displays all pockets as cards with actions
	 */

	import { onMount } from 'svelte';
	import { pocketStore } from '$lib/application/stores/pocketStore.svelte';
	import { formatPocketBalance } from '$lib/domain/Pocket';
	import type { Pocket } from '$lib/domain/Pocket';
	import Card from './ui/Card.svelte';
	import Button from './ui/Button.svelte';
	import Badge from './ui/Badge.svelte';

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
			alert(result.error || 'Failed to delete pocket. Make sure it has no transactions.');
		}
	}
</script>

<div class="pocket-list-container">
	<h2 class="section-title">Your Pockets</h2>

	{#if pocketStore.isLoading}
		<div class="loading-state">
			<div class="spinner"></div>
			<p>Loading pockets...</p>
		</div>
	{:else if pocketStore.error}
		<Card padding="lg">
			<div class="error-state">
				<p>{pocketStore.error}</p>
				<Button variant="primary" size="sm" onclick={() => pocketStore.loadPockets()}>
					Retry
				</Button>
			</div>
		</Card>
	{:else if pocketStore.pockets.length === 0}
		<Card padding="lg">
			<div class="empty-state">
				<div class="empty-icon">💰</div>
				<h3>No pockets yet</h3>
				<p>Create your first pocket above to start tracking your finances!</p>
			</div>
		</Card>
	{:else}
		<div class="pocket-grid">
			{#each pocketStore.pockets as pocket (pocket.id)}
				<Card padding="lg">
					<div class="pocket-card" style="border-left: 4px solid {pocket.color}">
						<div class="pocket-header">
							<div class="pocket-title-row">
								{#if pocket.icon}
									<span class="pocket-icon">{pocket.icon}</span>
								{/if}
								<h3 class="pocket-name">{pocket.name}</h3>
							</div>
							{#if pocket.isDefault}
								<Badge variant="primary">Default</Badge>
							{/if}
						</div>

						<div class="pocket-balance">
							<span class="balance-label">Current Balance</span>
							<span class="balance-amount">{formatPocketBalance(pocket)}</span>
						</div>

						{#if pocket.description}
							<p class="pocket-description">{pocket.description}</p>
						{/if}

						<div class="pocket-meta">
							<Badge variant="neutral">{pocket.currency}</Badge>
							<span class="initial-balance">
								Initial: {formatPocketBalance({
									...pocket,
									current_balance_cents: pocket.initial_balance_cents
								})}
							</span>
						</div>

						<div class="pocket-actions">
							{#if !pocket.isDefault}
								<Button
									variant="secondary"
									size="sm"
									onclick={() => handleSetDefault(pocket)}
								>
									Set as Default
								</Button>
							{/if}
							<Button
								variant="danger"
								size="sm"
								onclick={() => handleDelete(pocket)}
								disabled={pocket.isDefault}
							>
								Delete
							</Button>
						</div>
					</div>
				</Card>
			{/each}
		</div>
	{/if}
</div>

<style>
	.pocket-list-container {
		width: 100%;
	}

	.section-title {
		margin: 0 0 var(--space-6) 0;
		font-family: var(--font-display);
		font-size: var(--text-2xl);
		font-weight: var(--font-weight-semibold);
		color: var(--color-text-primary);
	}

	/* Loading State */
	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--space-12);
		gap: var(--space-4);
		color: var(--color-text-tertiary);
	}

	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid var(--color-border-primary);
		border-top-color: var(--color-primary-500);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* Error State */
	.error-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-4);
		padding: var(--space-6);
		text-align: center;
	}

	.error-state p {
		margin: 0;
		color: var(--color-error-600);
		font-weight: var(--font-weight-medium);
	}

	/* Empty State */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: var(--space-12) var(--space-4);
		text-align: center;
	}

	.empty-icon {
		font-size: var(--text-5xl);
		margin-bottom: var(--space-4);
		opacity: 0.5;
	}

	.empty-state h3 {
		margin: 0 0 var(--space-2) 0;
		font-size: var(--text-xl);
		font-weight: var(--font-weight-semibold);
		color: var(--color-text-primary);
	}

	.empty-state p {
		margin: 0;
		color: var(--color-text-tertiary);
	}

	/* Pocket Grid */
	.pocket-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: var(--space-6);
	}

	.pocket-card {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding-left: var(--space-4);
		border-radius: var(--radius-md);
	}

	.pocket-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--space-3);
	}

	.pocket-title-row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		flex: 1;
	}

	.pocket-icon {
		font-size: var(--text-3xl);
		line-height: 1;
	}

	.pocket-name {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--text-xl);
		font-weight: var(--font-weight-semibold);
		color: var(--color-text-primary);
	}

	.pocket-balance {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.balance-label {
		font-size: var(--text-sm);
		font-weight: var(--font-weight-medium);
		color: var(--color-text-tertiary);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
	}

	.balance-amount {
		font-family: var(--font-display);
		font-size: var(--text-3xl);
		font-weight: var(--font-weight-bold);
		color: var(--color-text-primary);
	}

	.pocket-description {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--color-text-secondary);
		line-height: var(--leading-relaxed);
	}

	.pocket-meta {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding-top: var(--space-2);
		border-top: 1px solid var(--color-border-primary);
	}

	.initial-balance {
		font-size: var(--text-sm);
		color: var(--color-text-tertiary);
	}

	.pocket-actions {
		display: flex;
		gap: var(--space-2);
		margin-top: auto;
		padding-top: var(--space-4);
	}

	.pocket-actions :global(button) {
		flex: 1;
	}

	/* Responsive */
	@media (max-width: 640px) {
		.pocket-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
