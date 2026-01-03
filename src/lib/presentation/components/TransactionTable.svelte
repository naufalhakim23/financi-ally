<script lang="ts">
	/**
	 * TransactionTable - Notion-style database view for transactions
	 * Refined, spacious layout with expandable row details
	 */

	import type { Transaction } from '$lib/domain/Transaction';
	import { formatAmount, formatDateTime } from '$lib/domain/Transaction';
	import Badge from './ui/Badge.svelte';
	import Button from './ui/Button.svelte';
	import Modal from './ui/Modal.svelte';

	interface TransactionTableProps {
		transactions: Transaction[];
		onCorrect?: (transactionId: string, entryId: string) => void;
		loading?: boolean;
	}

	let {
		transactions = [],
		onCorrect,
		loading = false
	}: TransactionTableProps = $props();

	// Track expanded rows
	let expandedRows = $state<Set<string>>(new Set());

	// Receipt viewer state
	let showReceiptModal = $state(false);
	let currentReceipt = $state<string | null>(null);

	const toggleRow = (transactionId: string) => {
		const newExpanded = new Set(expandedRows);
		if (newExpanded.has(transactionId)) {
			newExpanded.delete(transactionId);
		} else {
			newExpanded.add(transactionId);
		}
		expandedRows = newExpanded;
	};

	const isExpanded = (transactionId: string) => {
		return expandedRows.has(transactionId);
	};

	const openReceiptViewer = (receiptBase64: string) => {
		currentReceipt = receiptBase64;
		showReceiptModal = true;
	};

	const closeReceiptViewer = () => {
		showReceiptModal = false;
		currentReceipt = null;
	};

	const getTypeVariant = (amountCents: number): 'income' | 'expense' => {
		return amountCents >= 0 ? 'income' : 'expense';
	};

	const getTypeLabel = (amountCents: number): string => {
		return amountCents >= 0 ? 'Income' : 'Expense';
	};
</script>

<div class="transaction-table-container">
	{#if loading}
		<div class="loading-state">
			<div class="spinner"></div>
			<p>Loading transactions...</p>
		</div>
	{:else if transactions.length === 0}
		<div class="empty-state">
			<div class="empty-icon">📊</div>
			<h3>No transactions yet</h3>
			<p>Start tracking your finances by creating your first transaction</p>
		</div>
	{:else}
		<!-- Desktop Table View -->
		<div class="table-wrapper desktop-view">
			<table class="transaction-table">
				<thead>
					<tr>
						<th class="col-expand"></th>
						<th class="col-date">Date</th>
						<th class="col-description">Description</th>
						<th class="col-scope">Scope</th>
						<th class="col-amount">Amount</th>
						<th class="col-type">Type</th>
						<th class="col-actions">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each transactions as transaction (transaction.id)}
						<tr
							class="transaction-row"
							class:expanded={isExpanded(transaction.id)}
							onclick={() => toggleRow(transaction.id)}
						>
							<td class="col-expand">
								<button
									type="button"
									class="expand-button"
									aria-label={isExpanded(transaction.id) ? 'Collapse' : 'Expand'}
								>
									<svg
										class="expand-icon"
										class:rotated={isExpanded(transaction.id)}
										width="16"
										height="16"
										viewBox="0 0 16 16"
										fill="none"
									>
										<path
											d="M6 4L10 8L6 12"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
										/>
									</svg>
								</button>
							</td>
							<td class="col-date">
								<span class="date-text">{formatDateTime(transaction.occurred_at)}</span>
							</td>
							<td class="col-description">
								<span class="description-text">
									{transaction.description || 'No description'}
								</span>
							</td>
							<td class="col-scope">
								<Badge variant={transaction.scope}>{transaction.scope}</Badge>
							</td>
							<td class="col-amount">
								<span
									class="amount-text"
									class:positive={transaction.total_amount_cents >= 0}
									class:negative={transaction.total_amount_cents < 0}
								>
									{formatAmount(transaction.total_amount_cents)}
								</span>
							</td>
							<td class="col-type">
								<Badge variant={getTypeVariant(transaction.total_amount_cents)}>
									{getTypeLabel(transaction.total_amount_cents)}
								</Badge>
							</td>
							<td class="col-actions" onclick={(e) => e.stopPropagation()}>
								<div class="action-buttons">
									<Button
										variant="ghost"
										size="sm"
										onclick={() => toggleRow(transaction.id)}
									>
										Details
									</Button>
								</div>
							</td>
						</tr>

						<!-- Expanded Row Details -->
						{#if isExpanded(transaction.id)}
							<tr class="expanded-row">
								<td colspan="7">
									<div class="entry-details-container">
										<h4 class="entries-title">Transaction Entries</h4>
										<div class="entries-list">
											{#each transaction.entries as entry (entry.id)}
												<div class="entry-card">
													<div class="entry-header">
														<div class="entry-type">
															{#if entry.is_correction}
																<span class="correction-badge">
																	{entry.amount_cents < 0 ? '↩️ Reversal' : '✏️ Corrected'}
																</span>
															{:else}
																<span class="original-badge">💰 Original Entry</span>
															{/if}
														</div>
														<span class="entry-amount">
															{formatAmount(Math.abs(entry.amount_cents))}
														</span>
													</div>

													<div class="entry-metadata">
														{#if entry.metadata.category}
															<div class="meta-item">
																<span class="meta-label">Category:</span>
																<span class="meta-value">{entry.metadata.category}</span>
															</div>
														{/if}
														{#if entry.metadata.payment_method}
															<div class="meta-item">
																<span class="meta-label">Payment:</span>
																<span class="meta-value">{entry.metadata.payment_method}</span>
															</div>
														{/if}
														{#if entry.metadata.notes}
															<div class="meta-item">
																<span class="meta-label">Notes:</span>
																<span class="meta-value">{entry.metadata.notes}</span>
															</div>
														{/if}
													</div>

													{#if entry.metadata.receipt_base64}
														<button
															type="button"
															class="receipt-button"
															onclick={() => openReceiptViewer(entry.metadata.receipt_base64!)}
														>
															<img
																src="data:image/jpeg;base64,{entry.metadata.receipt_base64}"
																alt="Receipt thumbnail"
																class="receipt-thumbnail"
															/>
															<span>View Receipt</span>
														</button>
													{/if}

													{#if !entry.is_correction && onCorrect}
														<div class="entry-actions">
															<Button
																variant="secondary"
																size="sm"
																onclick={() => onCorrect?.(transaction.id, entry.id)}
															>
																Correct Entry
															</Button>
														</div>
													{/if}
												</div>
											{/each}
										</div>
									</div>
								</td>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Mobile Card View -->
		<div class="mobile-view">
			{#each transactions as transaction (transaction.id)}
				<div class="transaction-card">
					<div class="card-header" onclick={() => toggleRow(transaction.id)}>
						<div class="card-main-info">
							<div class="card-title-row">
								<span class="card-description">
									{transaction.description || 'No description'}
								</span>
								<button
									type="button"
									class="expand-button-mobile"
									aria-label={isExpanded(transaction.id) ? 'Collapse' : 'Expand'}
								>
									<svg
										class="expand-icon"
										class:rotated={isExpanded(transaction.id)}
										width="16"
										height="16"
										viewBox="0 0 16 16"
										fill="none"
									>
										<path
											d="M6 4L10 8L6 12"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
										/>
									</svg>
								</button>
							</div>
							<div class="card-meta">
								<Badge variant={transaction.scope}>{transaction.scope}</Badge>
								<span class="card-date">{formatDateTime(transaction.occurred_at)}</span>
							</div>
						</div>
						<div class="card-amount-section">
							<span
								class="card-amount"
								class:positive={transaction.total_amount_cents >= 0}
								class:negative={transaction.total_amount_cents < 0}
							>
								{formatAmount(transaction.total_amount_cents)}
							</span>
							<Badge variant={getTypeVariant(transaction.total_amount_cents)}>
								{getTypeLabel(transaction.total_amount_cents)}
							</Badge>
						</div>
					</div>

					<!-- Expanded Details (Mobile) -->
					{#if isExpanded(transaction.id)}
						<div class="card-expanded">
							<div class="entries-list">
								{#each transaction.entries as entry (entry.id)}
									<div class="entry-card">
										<div class="entry-header">
											<div class="entry-type">
												{#if entry.is_correction}
													<span class="correction-badge">
														{entry.amount_cents < 0 ? '↩️ Reversal' : '✏️ Corrected'}
													</span>
												{:else}
													<span class="original-badge">💰 Original</span>
												{/if}
											</div>
											<span class="entry-amount">
												{formatAmount(Math.abs(entry.amount_cents))}
											</span>
										</div>

										<div class="entry-metadata">
											{#if entry.metadata.category}
												<div class="meta-item">
													<span class="meta-label">Category:</span>
													<span class="meta-value">{entry.metadata.category}</span>
												</div>
											{/if}
											{#if entry.metadata.payment_method}
												<div class="meta-item">
													<span class="meta-label">Payment:</span>
													<span class="meta-value">{entry.metadata.payment_method}</span>
												</div>
											{/if}
											{#if entry.metadata.notes}
												<div class="meta-item">
													<span class="meta-label">Notes:</span>
													<span class="meta-value">{entry.metadata.notes}</span>
												</div>
											{/if}
										</div>

										{#if entry.metadata.receipt_base64}
											<button
												type="button"
												class="receipt-button"
												onclick={() => openReceiptViewer(entry.metadata.receipt_base64!)}
											>
												<img
													src="data:image/jpeg;base64,{entry.metadata.receipt_base64}"
													alt="Receipt thumbnail"
													class="receipt-thumbnail"
												/>
												<span>View Receipt</span>
											</button>
										{/if}

										{#if !entry.is_correction && onCorrect}
											<div class="entry-actions">
												<Button
													variant="secondary"
													size="sm"
													onclick={() => onCorrect?.(transaction.id, entry.id)}
												>
													Correct Entry
												</Button>
											</div>
										{/if}
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Receipt Viewer Modal -->
{#if showReceiptModal && currentReceipt}
	<Modal open={showReceiptModal} onClose={closeReceiptViewer} title="Receipt" size="lg">
		<div class="receipt-viewer">
			<img
				src="data:image/jpeg;base64,{currentReceipt}"
				alt="Receipt full size"
				class="receipt-full"
			/>
		</div>
		{#snippet footer()}
			<Button variant="secondary" onclick={closeReceiptViewer}>Close</Button>
		{/snippet}
	</Modal>
{/if}

<style>
	.transaction-table-container {
		width: 100%;
	}

	/* Loading State */
	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--space-16);
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

	/* Empty State */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--space-16) var(--space-4);
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

	/* Desktop Table View */
	.desktop-view {
		display: block;
	}

	.mobile-view {
		display: none;
	}

	@media (max-width: 640px) {
		.desktop-view {
			display: none;
		}

		.mobile-view {
			display: block;
		}
	}

	.table-wrapper {
		width: 100%;
		overflow-x: auto;
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-border-primary);
		background: var(--color-bg-primary);
	}

	.transaction-table {
		width: 100%;
		border-collapse: collapse;
	}

	/* Table Header */
	thead {
		background: var(--color-bg-tertiary);
		border-bottom: 1px solid var(--color-border-primary);
	}

	thead th {
		padding: var(--space-4) var(--space-4);
		text-align: left;
		font-family: var(--font-body);
		font-size: var(--text-sm);
		font-weight: var(--font-weight-semibold);
		color: var(--color-text-secondary);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		white-space: nowrap;
	}

	.col-expand {
		width: 40px;
	}

	.col-date {
		width: 180px;
	}

	.col-description {
		width: auto;
		min-width: 200px;
	}

	.col-scope {
		width: 120px;
	}

	.col-amount {
		width: 140px;
	}

	.col-type {
		width: 120px;
	}

	.col-actions {
		width: 120px;
	}

	/* Table Body */
	tbody tr.transaction-row {
		border-bottom: 1px solid var(--color-border-primary);
		transition: background var(--transition-fast);
		cursor: pointer;
	}

	tbody tr.transaction-row:hover {
		background: var(--color-bg-hover);
	}

	tbody tr.transaction-row.expanded {
		background: var(--color-bg-hover);
	}

	tbody td {
		padding: var(--space-4) var(--space-4);
		font-size: var(--text-base);
		color: var(--color-text-primary);
	}

	.expand-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		padding: 0;
		color: var(--color-text-tertiary);
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.expand-button:hover {
		background: var(--color-bg-active);
		color: var(--color-text-primary);
	}

	.expand-icon {
		transition: transform var(--transition-base);
	}

	.expand-icon.rotated {
		transform: rotate(90deg);
	}

	.date-text {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		color: var(--color-text-secondary);
	}

	.description-text {
		font-weight: var(--font-weight-medium);
		color: var(--color-text-primary);
	}

	.amount-text {
		font-family: var(--font-display);
		font-size: var(--text-lg);
		font-weight: var(--font-weight-semibold);
	}

	.amount-text.positive {
		color: var(--color-success-600);
	}

	.amount-text.negative {
		color: var(--color-error-600);
	}

	.action-buttons {
		display: flex;
		gap: var(--space-2);
	}

	/* Expanded Row */
	.expanded-row {
		background: var(--color-bg-secondary);
		border-bottom: 1px solid var(--color-border-primary);
	}

	.expanded-row td {
		padding: 0;
	}

	.entry-details-container {
		padding: var(--space-6);
		animation: slideDown 0.3s ease-out;
	}

	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.entries-title {
		margin: 0 0 var(--space-4) 0;
		font-size: var(--text-lg);
		font-weight: var(--font-weight-semibold);
		color: var(--color-text-primary);
	}

	.entries-list {
		display: grid;
		gap: var(--space-4);
	}

	.entry-card {
		padding: var(--space-4);
		background: var(--color-bg-primary);
		border: 1px solid var(--color-border-primary);
		border-radius: var(--radius-md);
	}

	.entry-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--space-3);
	}

	.entry-type {
		font-size: var(--text-sm);
		font-weight: var(--font-weight-medium);
	}

	.correction-badge {
		color: var(--color-primary-600);
	}

	.original-badge {
		color: var(--color-text-secondary);
	}

	.entry-amount {
		font-family: var(--font-display);
		font-size: var(--text-lg);
		font-weight: var(--font-weight-semibold);
		color: var(--color-text-primary);
	}

	.entry-metadata {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin-bottom: var(--space-3);
	}

	.meta-item {
		display: flex;
		gap: var(--space-2);
		font-size: var(--text-sm);
	}

	.meta-label {
		font-weight: var(--font-weight-medium);
		color: var(--color-text-tertiary);
	}

	.meta-value {
		color: var(--color-text-primary);
	}

	.receipt-button {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3);
		margin-bottom: var(--space-3);
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border-primary);
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: all var(--transition-fast);
		font-size: var(--text-sm);
		color: var(--color-text-secondary);
	}

	.receipt-button:hover {
		background: var(--color-bg-hover);
		border-color: var(--color-border-secondary);
	}

	.receipt-thumbnail {
		width: 60px;
		height: 60px;
		object-fit: cover;
		border-radius: var(--radius-sm);
	}

	.entry-actions {
		display: flex;
		gap: var(--space-2);
	}

	/* Mobile Card View */
	.transaction-card {
		background: var(--color-bg-primary);
		border: 1px solid var(--color-border-primary);
		border-radius: var(--radius-lg);
		margin-bottom: var(--space-4);
		overflow: hidden;
	}

	.card-header {
		padding: var(--space-4);
		cursor: pointer;
		transition: background var(--transition-fast);
	}

	.card-header:active {
		background: var(--color-bg-hover);
	}

	.card-main-info {
		margin-bottom: var(--space-3);
	}

	.card-title-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-3);
		margin-bottom: var(--space-2);
	}

	.card-description {
		flex: 1;
		font-size: var(--text-base);
		font-weight: var(--font-weight-medium);
		color: var(--color-text-primary);
	}

	.expand-button-mobile {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		padding: 0;
		color: var(--color-text-tertiary);
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
	}

	.card-meta {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.card-date {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--color-text-tertiary);
	}

	.card-amount-section {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.card-amount {
		font-family: var(--font-display);
		font-size: var(--text-xl);
		font-weight: var(--font-weight-bold);
	}

	.card-amount.positive {
		color: var(--color-success-600);
	}

	.card-amount.negative {
		color: var(--color-error-600);
	}

	.card-expanded {
		padding: var(--space-4);
		background: var(--color-bg-secondary);
		border-top: 1px solid var(--color-border-primary);
		animation: slideDown 0.3s ease-out;
	}

	/* Receipt Viewer */
	.receipt-viewer {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-4);
		background: var(--color-bg-secondary);
		border-radius: var(--radius-md);
	}

	.receipt-full {
		max-width: 100%;
		max-height: 70vh;
		border-radius: var(--radius-sm);
	}
</style>
