<script lang="ts">
	import { onMount } from 'svelte';
	import { transactionStore } from '$lib/application/stores/transactionStore.svelte';
	import TransactionForm from '$lib/presentation/components/TransactionForm.svelte';
	import { formatAmount, formatDateTime } from '$lib/domain/Transaction';
	import type { Transaction } from '$lib/domain/Transaction';

	// Load transactions on mount
	onMount(async () => {
		await transactionStore.loadTransactions();
	});

	// Reactive values from store
	const transactions = $derived(transactionStore.filteredTransactions);
	const isLoading = $derived(transactionStore.isLoading);
	const error = $derived(transactionStore.error);
	const hasMore = $derived(transactionStore.hasMore);

	/**
	 * Handle load more
	 */
	async function handleLoadMore() {
		await transactionStore.loadMore();
	}

	/**
	 * Get display color for transaction type
	 */
	function getTypeColor(tx: Transaction): string {
		return tx.totalAmountCents >= 0 ? 'text-green-600' : 'text-red-600';
	}

	/**
	 * Get display label for transaction type
	 */
	function getTypeLabel(tx: Transaction): string {
		return tx.totalAmountCents >= 0 ? 'Income' : 'Expense';
	}
</script>

<main class="app-container">
	<header class="app-header">
		<h1>Pocket Log</h1>
		<p class="subtitle">Immutable Financial Ledger</p>
	</header>

	<div class="content-grid">
		<!-- Left column: Transaction Form -->
		<section class="form-section">
			<TransactionForm />
		</section>

		<!-- Right column: Transaction Timeline -->
		<section class="timeline-section">
			<div class="timeline-header">
				<h2>Timeline</h2>
				<button
					class="btn-refresh"
					onclick={() => transactionStore.refresh()}
					disabled={isLoading}
				>
					{isLoading ? 'Loading...' : 'Refresh'}
				</button>
			</div>

			<!-- Error message -->
			{#if error}
				<div class="alert alert-error">
					<p>{error}</p>
					<button onclick={() => transactionStore.clearError()}>Dismiss</button>
				</div>
			{/if}

			<!-- Transaction list -->
			<div class="transaction-list">
				{#if transactions.length === 0 && !isLoading}
					<div class="empty-state">
						<p>No transactions yet</p>
						<p class="empty-subtitle">Create your first transaction to get started</p>
					</div>
				{:else}
					{#each transactions as transaction (transaction.id)}
						<div class="transaction-card">
							<div class="transaction-header">
								<div class="transaction-info">
									<h3 class="transaction-description">
										{transaction.description || 'No description'}
									</h3>
									<p class="transaction-meta">
										<span class="badge badge-{transaction.scope}">{transaction.scope}</span>
										<span class="transaction-date">{formatDateTime(transaction.occurredAt)}</span>
									</p>
								</div>
								<div class="transaction-amount">
									<span class={getTypeColor(transaction)}>
										{formatAmount(transaction.totalAmountCents)}
									</span>
									<span class="transaction-type {getTypeColor(transaction)}">
										{getTypeLabel(transaction)}
									</span>
								</div>
							</div>

							<!-- Entry details -->
							{#each transaction.entries as entry}
								<div class="entry-details">
									{#if entry.metadata.category}
										<span class="detail-item">📂 {entry.metadata.category}</span>
									{/if}
									{#if entry.metadata.paymentMethod}
										<span class="detail-item">💳 {entry.metadata.paymentMethod}</span>
									{/if}
									{#if entry.metadata.notes}
										<span class="detail-item">📝 {entry.metadata.notes}</span>
									{/if}
								</div>
							{/each}
						</div>
					{/each}

					<!-- Load more button -->
					{#if hasMore}
						<button class="btn-load-more" onclick={handleLoadMore} disabled={isLoading}>
							{isLoading ? 'Loading...' : 'Load More'}
						</button>
					{/if}
				{/if}
			</div>
		</section>
	</div>
</main>

<style>
	* {
		box-sizing: border-box;
	}

	:global(body) {
		margin: 0;
		padding: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
			sans-serif;
		background-color: #f7fafc;
		color: #1a202c;
	}

	.app-container {
		min-height: 100vh;
		padding: 2rem;
	}

	.app-header {
		text-align: center;
		margin-bottom: 2rem;
	}

	.app-header h1 {
		margin: 0;
		font-size: 2.5rem;
		font-weight: 700;
		color: #2d3748;
	}

	.subtitle {
		margin: 0.5rem 0 0 0;
		color: #718096;
		font-size: 1rem;
	}

	.content-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 2rem;
		max-width: 1400px;
		margin: 0 auto;
	}

	.form-section,
	.timeline-section {
		min-height: 400px;
	}

	.timeline-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
		padding: 0 0.5rem;
	}

	.timeline-header h2 {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 600;
		color: #2d3748;
	}

	.btn-refresh {
		padding: 0.5rem 1rem;
		background-color: #4299e1;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-weight: 500;
		transition: background-color 0.2s;
	}

	.btn-refresh:hover:not(:disabled) {
		background-color: #3182ce;
	}

	.btn-refresh:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.transaction-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.transaction-card {
		background: white;
		padding: 1.25rem;
		border-radius: 8px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		transition: box-shadow 0.2s;
	}

	.transaction-card:hover {
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	.transaction-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
	}

	.transaction-info {
		flex: 1;
	}

	.transaction-description {
		margin: 0 0 0.5rem 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: #2d3748;
	}

	.transaction-meta {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		margin: 0;
		font-size: 0.875rem;
		color: #718096;
	}

	.badge {
		display: inline-block;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
	}

	.badge-personal {
		background-color: #bee3f8;
		color: #2c5282;
	}

	.badge-business {
		background-color: #faf089;
		color: #744210;
	}

	.transaction-date {
		font-size: 0.875rem;
	}

	.transaction-amount {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.25rem;
	}

	.transaction-amount span:first-child {
		font-size: 1.5rem;
		font-weight: 700;
	}

	.transaction-type {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
	}

	.text-green-600 {
		color: #38a169;
	}

	.text-red-600 {
		color: #e53e3e;
	}

	.entry-details {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid #e2e8f0;
	}

	.detail-item {
		font-size: 0.875rem;
		color: #4a5568;
	}

	.empty-state {
		text-align: center;
		padding: 4rem 2rem;
		color: #a0aec0;
	}

	.empty-state p {
		margin: 0.5rem 0;
	}

	.empty-subtitle {
		font-size: 0.875rem;
	}

	.btn-load-more {
		width: 100%;
		padding: 0.75rem;
		background-color: #edf2f7;
		color: #2d3748;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-weight: 500;
		transition: background-color 0.2s;
	}

	.btn-load-more:hover:not(:disabled) {
		background-color: #e2e8f0;
	}

	.btn-load-more:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.alert {
		padding: 1rem;
		border-radius: 4px;
		margin-bottom: 1rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.alert-error {
		background-color: #fed7d7;
		color: #742a2a;
		border: 1px solid #fc8181;
	}

	.alert button {
		background: none;
		border: none;
		color: #742a2a;
		text-decoration: underline;
		cursor: pointer;
	}

	/* Mobile responsive */
	@media (max-width: 1024px) {
		.content-grid {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 640px) {
		.app-container {
			padding: 1rem;
		}

		.app-header h1 {
			font-size: 2rem;
		}

		.transaction-header {
			flex-direction: column;
			align-items: flex-start;
		}

		.transaction-amount {
			align-items: flex-start;
		}
	}
</style>
