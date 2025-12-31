<script lang="ts">
	import { onMount } from 'svelte';
	import { transactionStore } from '$lib/application/stores/transactionStore.svelte';
	import TransactionForm from '$lib/presentation/components/TransactionForm.svelte';
	import PocketForm from '$lib/presentation/components/PocketForm.svelte';
	import PocketList from '$lib/presentation/components/PocketList.svelte';
	import SearchBar from '$lib/presentation/components/SearchBar.svelte';
	import FilterPanel from '$lib/presentation/components/FilterPanel.svelte';
	import { formatAmount, formatDateTime } from '$lib/domain/Transaction';
	import type { Transaction } from '$lib/domain/Transaction';
	import { invoke } from '@tauri-apps/api/core';

	// Tab state
	let activeTab = $state<'transactions' | 'pockets'>('transactions');

	// Load transactions on mount
	onMount(async () => {
		await transactionStore.loadTransactions();
	});

	// Reactive values from store
	const isLoading = $derived(transactionStore.isLoading);
	const error = $derived(transactionStore.error);
	const hasMore = $derived(transactionStore.hasMore);

	// Search state
	let searchResults = $state<Transaction[]>([]);
	let isSearchActive = $state(false);

	// Filter state
	let filterType = $state<string | undefined>(undefined);
	let filterScope = $state<string | undefined>(undefined);
	let filterCategory = $state<string | undefined>(undefined);
	let filterPaymentMethod = $state<string | undefined>(undefined);
	let filterDateFrom = $state<string | undefined>(undefined);
	let filterDateTo = $state<string | undefined>(undefined);
	let filteredResults = $state<Transaction[]>([]);
	let isFilterActive = $state(false);

	// Determine which transactions to display
	const transactions = $derived(
		isSearchActive ? searchResults : isFilterActive ? filteredResults : transactionStore.filteredTransactions
	);

	/**
	 * Handle search results
	 */
	function handleSearch(results: Transaction[]) {
		searchResults = results;
		// If results array is provided and has items, activate search
		// If empty array is provided (search cleared), deactivate search
		isSearchActive = results.length > 0;
		if (isSearchActive) {
			isFilterActive = false; // Disable filters when searching
		}
	}

	/**
	 * Handle filter changes
	 */
	async function handleFilterChange() {
		const hasFilters =
			!!filterType ||
			!!filterScope ||
			!!filterCategory ||
			!!filterPaymentMethod ||
			!!filterDateFrom ||
			!!filterDateTo;

		if (!hasFilters) {
			isFilterActive = false;
			return;
		}

		try {
			// Convert date strings to ISO 8601 format with time
			const dateFromISO = filterDateFrom ? `${filterDateFrom}T00:00:00.000Z` : undefined;
			const dateToISO = filterDateTo ? `${filterDateTo}T23:59:59.999Z` : undefined;

			const response = (await invoke('list_transactions', {
				request: {
					offset: 0,
					limit: 100,
					filterType: filterType || undefined,
					filterScope: filterScope || undefined,
					filterCategory: filterCategory || undefined,
					filterPaymentMethod: filterPaymentMethod || undefined,
					filterDateFrom: dateFromISO,
					filterDateTo: dateToISO
				}
			})) as any;

			if (response.success) {
				filteredResults = response.data;
				isFilterActive = true;
				isSearchActive = false; // Disable search when filtering
			}
		} catch (error) {
			console.error('Filter error:', error);
		}
	}

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
		return tx.total_amount_cents >= 0 ? 'text-green-600' : 'text-red-600';
	}

	/**
	 * Get display label for transaction type
	 */
	function getTypeLabel(tx: Transaction): string {
		return tx.total_amount_cents >= 0 ? 'Income' : 'Expense';
	}

	// Correction dialog state
	let showCorrectionDialog = $state(false);
	let correctionData = $state({
		transactionId: '',
		entryId: '',
		currentAmount: 0,
		newAmount: '',
		currentCategory: '',
		newCategory: '',
		currentPaymentMethod: '',
		newPaymentMethod: '',
		currentNotes: '',
		newNotes: ''
	});

	// Receipt viewer state
	let showReceiptViewer = $state(false);
	let currentReceiptBase64 = $state<string | null>(null);

	/**
	 * Open receipt viewer
	 */
	function openReceiptViewer(receiptBase64: string | undefined) {
		if (!receiptBase64) return;
		currentReceiptBase64 = receiptBase64;
		showReceiptViewer = true;
	}

	/**
	 * Close receipt viewer
	 */
	function closeReceiptViewer() {
		showReceiptViewer = false;
		currentReceiptBase64 = null;
	}

	/**
	 * Open correction dialog
	 */
	function openCorrectionDialog(transactionId: string, entry: any) {
		correctionData = {
			transactionId,
			entryId: entry.id,
			currentAmount: entry.amount_cents / 100,
			newAmount: (entry.amount_cents / 100).toFixed(2),
			currentCategory: entry.metadata.category || '',
			newCategory: entry.metadata.category || '',
			currentPaymentMethod: entry.metadata.payment_method || '',
			newPaymentMethod: entry.metadata.payment_method || '',
			currentNotes: entry.metadata.notes || '',
			newNotes: entry.metadata.notes || 'Corrected entry'
		};
		showCorrectionDialog = true;
	}

	/**
	 * Submit correction
	 */
	async function submitCorrection() {
		const newAmount = parseFloat(correctionData.newAmount);
		if (isNaN(newAmount) || newAmount <= 0) {
			alert('Please enter a valid amount greater than 0');
			return;
		}

		try {
			const { invoke } = await import('@tauri-apps/api/core');

			await invoke('correct_transaction', {
				request: {
					transactionId: correctionData.transactionId,
					entryId: correctionData.entryId,
					newAmountCents: Math.round(newAmount * 100),
					newCategory: correctionData.newCategory || undefined,
					newPaymentMethod: correctionData.newPaymentMethod || undefined,
					newNotes: correctionData.newNotes || undefined,
					newReceiptBase64: undefined
				}
			});

			// Close dialog and refresh
			showCorrectionDialog = false;
			await transactionStore.refresh();
			alert(
				'✅ Correction successful!\n\nCheck the transaction - it now has 3 entries:\n• Original entry\n• Reversal entry (negates original)\n• Corrected entry (new values)'
			);
		} catch (error) {
			alert(`❌ Correction failed: ${error}`);
			console.error('Correction error:', error);
		}
	}
</script>

<main class="app-container">
	<header class="app-header">
		<h1>Pocket Log</h1>
		<p class="subtitle">Immutable Financial Ledger</p>

		<!-- Tab Navigation -->
		<nav class="tabs">
			<button
				class="tab-button"
				class:active={activeTab === 'transactions'}
				onclick={() => (activeTab = 'transactions')}
			>
				Transactions
			</button>
			<button
				class="tab-button"
				class:active={activeTab === 'pockets'}
				onclick={() => (activeTab = 'pockets')}
			>
				Pockets
			</button>
		</nav>
	</header>

	{#if activeTab === 'transactions'}
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

			<!-- Search and Filter Components -->
			<SearchBar onSearch={handleSearch} />
			<FilterPanel
				bind:filterType
				bind:filterScope
				bind:filterCategory
				bind:filterPaymentMethod
				bind:filterDateFrom
				bind:filterDateTo
				onFilterChange={handleFilterChange}
			/>

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
										<span class="transaction-date">{formatDateTime(transaction.occurred_at)}</span>
									</p>
								</div>
								<div class="transaction-amount">
									<span class={getTypeColor(transaction)}>
										{formatAmount(transaction.total_amount_cents)}
									</span>
									<span class="transaction-type {getTypeColor(transaction)}">
										{getTypeLabel(transaction)}
									</span>
								</div>
							</div>

							<!-- Entry details -->
							{#each transaction.entries as entry}
								<div class="entry-details">
									<div class="entry-info">
										<span class="detail-item">
											{#if entry.is_correction}
												<strong class="correction-badge">
													{entry.amount_cents < 0 ? '↩️ Reversal' : '✏️ Corrected'}
												</strong>
											{:else}
												💰 Original Entry
											{/if}
											| ${Math.abs(entry.amount_cents / 100).toFixed(2)}
										</span>
										{#if entry.metadata.category}
											<span class="detail-item">📂 {entry.metadata.category}</span>
										{/if}
										{#if entry.metadata.payment_method}
											<span class="detail-item">💳 {entry.metadata.payment_method}</span>
										{/if}
										{#if entry.metadata.notes}
											<span class="detail-item">📝 {entry.metadata.notes}</span>
										{/if}
									</div>
									{#if !entry.is_correction}
										<button
											class="btn-correct"
											onclick={() => openCorrectionDialog(transaction.id, entry)}
										>
											Correct
										</button>
									{/if}
								</div>
								{#if entry.metadata.receipt_base64}
									<div class="receipt-thumbnail-container">
										<button
											type="button"
											class="receipt-thumbnail-button"
											onclick={() => openReceiptViewer(entry.metadata.receipt_base64)}
											title="View receipt in full size"
										>
											<img
												src="data:image/jpeg;base64,{entry.metadata.receipt_base64}"
												alt="Receipt"
												class="receipt-thumbnail"
											/>
										</button>
										<span class="receipt-label">📎 Receipt (click to view)</span>
									</div>
								{/if}
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
	{:else}
	<!-- Pockets View -->
	<div class="pockets-view">
		<PocketForm />
		<PocketList />
	</div>
	{/if}

	<!-- Correction Dialog Modal -->
	{#if showCorrectionDialog}
		<div
			class="modal-overlay"
			role="presentation"
			onclick={() => (showCorrectionDialog = false)}
			onkeydown={(e) => e.key === 'Escape' && (showCorrectionDialog = false)}
		>
			<div
				class="modal-content"
				role="dialog"
				aria-modal="true"
				tabindex="0"
				onclick={(e) => e.stopPropagation()}
				onkeydown={(e) => e.stopPropagation()}
			>
				<h2 class="modal-title">Correct Entry</h2>

				<div class="form-group">
					<label for="amount-input">
						Amount (current: ${correctionData.currentAmount.toFixed(2)})
					</label>
					<input
						id="amount-input"
						type="number"
						step="0.01"
						bind:value={correctionData.newAmount}
						placeholder="Enter new amount"
					/>
				</div>

				<div class="form-group">
					<label for="category-input">
						Category (current: {correctionData.currentCategory || 'none'})
					</label>
					<input
						id="category-input"
						type="text"
						bind:value={correctionData.newCategory}
						placeholder="Enter category"
					/>
				</div>

				<div class="form-group">
					<label for="payment-method-input">
						Payment Method (current: {correctionData.currentPaymentMethod || 'none'})
					</label>
					<input
						id="payment-method-input"
						type="text"
						bind:value={correctionData.newPaymentMethod}
						placeholder="Enter payment method"
					/>
				</div>

				<div class="form-group">
					<label for="notes-input"> Notes (current: {correctionData.currentNotes || 'none'}) </label>
					<textarea
						id="notes-input"
						bind:value={correctionData.newNotes}
						placeholder="Enter notes"
						rows="3"
					></textarea>
				</div>

				<div class="modal-actions">
					<button class="btn btn-secondary" onclick={() => (showCorrectionDialog = false)}>
						Cancel
					</button>
					<button class="btn btn-primary" onclick={submitCorrection}> Submit Correction </button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Receipt Viewer Modal -->
	{#if showReceiptViewer && currentReceiptBase64}
		<div
			class="modal-overlay"
			role="presentation"
			onclick={closeReceiptViewer}
			onkeydown={(e) => e.key === 'Escape' && closeReceiptViewer()}
		>
			<div
				class="modal-content receipt-modal"
				role="dialog"
				aria-modal="true"
				tabindex="0"
				onclick={(e) => e.stopPropagation()}
				onkeydown={(e) => e.stopPropagation()}
			>
				<div class="receipt-modal-header">
					<h2 class="modal-title">Receipt</h2>
					<button class="btn-close" onclick={closeReceiptViewer} type="button"> ✕ </button>
				</div>

				<div class="receipt-image-container">
					<img
						src="data:image/jpeg;base64,{currentReceiptBase64}"
						alt="Receipt full size"
						class="receipt-full-size"
					/>
				</div>

				<div class="modal-actions">
					<button class="btn btn-secondary" onclick={closeReceiptViewer}> Close </button>
				</div>
			</div>
		</div>
	{/if}
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

	/* Tab Navigation */
	.tabs {
		display: flex;
		justify-content: center;
		gap: 1rem;
		margin-top: 1.5rem;
		padding: 0.5rem;
		background-color: #f7fafc;
		border-radius: 8px;
		max-width: 400px;
		margin-left: auto;
		margin-right: auto;
	}

	.tab-button {
		flex: 1;
		padding: 0.75rem 1.5rem;
		background-color: transparent;
		color: #718096;
		border: none;
		border-radius: 6px;
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
	}

	.tab-button:hover {
		background-color: #e2e8f0;
		color: #2d3748;
	}

	.tab-button.active {
		background-color: #4299e1;
		color: white;
		box-shadow: 0 2px 4px rgba(66, 153, 225, 0.3);
	}

	/* Pockets View */
	.pockets-view {
		max-width: 1200px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 2rem;
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
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid #e2e8f0;
	}

	.entry-info {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		flex: 1;
	}

	.detail-item {
		font-size: 0.875rem;
		color: #4a5568;
	}

	.correction-badge {
		color: #805ad5;
		font-weight: 600;
	}

	.btn-correct {
		padding: 0.5rem 1rem;
		background-color: #805ad5;
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.2s;
		white-space: nowrap;
	}

	.btn-correct:hover {
		background-color: #6b46c1;
	}

	.receipt-thumbnail-container {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
	}
	.receipt-thumbnail-button {
		padding: 0;
		background: none;
		border: none;
		cursor: pointer;
	}

	.receipt-thumbnail {
		max-width: 150px;
		max-height: 150px;
		object-fit: cover;
		border-radius: 4px;
		border: 1px solid #e2e8f0;
		transition: all 0.2s;
		display: block;
	}

	.receipt-thumbnail-button:hover .receipt-thumbnail {
		border-color: #8b5cf6;
		box-shadow: 0 2px 8px rgba(139, 92, 246, 0.2);
		transform: scale(1.05);
	}

	.receipt-thumbnail:hover {
		border-color: #8b5cf6;
		box-shadow: 0 2px 8px rgba(139, 92, 246, 0.2);
		transform: scale(1.05);
	}

	.receipt-label {
		font-size: 0.75rem;
		color: #718096;
		font-style: italic;
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

	/* Modal styles */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.modal-content {
		background: white;
		padding: 2rem;
		border-radius: 8px;
		max-width: 500px;
		width: 90%;
		max-height: 80vh;
		overflow-y: auto;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
	}

	.modal-title {
		margin: 0 0 1.5rem 0;
		font-size: 1.5rem;
		font-weight: 600;
		color: #2d3748;
	}

	.modal-actions {
		display: flex;
		gap: 1rem;
		margin-top: 1.5rem;
	}

	.form-group {
		margin-bottom: 1.25rem;
	}

	.form-group label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
		color: #4a5568;
		font-size: 0.875rem;
	}

	.form-group input[type='text'],
	.form-group input[type='number'],
	.form-group textarea {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #cbd5e0;
		border-radius: 4px;
		font-size: 1rem;
		transition: border-color 0.2s;
	}

	.form-group input:focus,
	.form-group textarea:focus {
		outline: none;
		border-color: #4299e1;
		box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
	}

	.btn {
		flex: 1;
		padding: 0.75rem 1.5rem;
		border: none;
		border-radius: 4px;
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-primary {
		background-color: #4299e1;
		color: white;
	}

	.btn-primary:hover {
		background-color: #3182ce;
	}

	.btn-secondary {
		background-color: #e2e8f0;
		color: #2d3748;
	}

	.btn-secondary:hover {
		background-color: #cbd5e0;
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

		.modal-content {
			padding: 1.5rem;
		}

		.modal-actions {
			flex-direction: column;
		}
	}

	/* Receipt Viewer Modal */
	.receipt-modal {
		max-width: 90vw;
		max-height: 90vh;
		padding: 1.5rem;
	}

	.receipt-modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.receipt-modal-header .modal-title {
		margin: 0;
	}

	.btn-close {
		background: none;
		border: none;
		font-size: 1.5rem;
		color: #718096;
		cursor: pointer;
		padding: 0.25rem 0.5rem;
		transition: color 0.2s;
	}

	.btn-close:hover {
		color: #2d3748;
	}

	.receipt-image-container {
		display: flex;
		justify-content: center;
		align-items: center;
		max-height: 70vh;
		overflow: auto;
		background: #f7fafc;
		border-radius: 4px;
		padding: 1rem;
	}

	.receipt-full-size {
		max-width: 100%;
		max-height: 100%;
		height: auto;
		object-fit: contain;
		border-radius: 4px;
	}
</style>
