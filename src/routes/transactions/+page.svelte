<script lang="ts">
	/**
	 * Transactions Page - Full transaction management with TransactionTable
	 */

	import { onMount } from 'svelte';
	import { transactionStore } from '$lib/application/stores/transactionStore.svelte';
	import Card from '$lib/presentation/components/ui/Card.svelte';
	import Button from '$lib/presentation/components/ui/Button.svelte';
	import Modal from '$lib/presentation/components/ui/Modal.svelte';
	import Input from '$lib/presentation/components/ui/Input.svelte';
	import TransactionTable from '$lib/presentation/components/TransactionTable.svelte';
	import TransactionForm from '$lib/presentation/components/TransactionForm.svelte';
	import SearchBar from '$lib/presentation/components/SearchBar.svelte';
	import FilterPanel from '$lib/presentation/components/FilterPanel.svelte';
	import type { Transaction } from '$lib/domain/Transaction';
	import { invoke } from '@tauri-apps/api/core';

	// Load transactions on mount
	onMount(async () => {
		await transactionStore.loadTransactions();
	});

	const isLoading = $derived(transactionStore.isLoading);
	const error = $derived(transactionStore.error);

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

	// Transaction form modal
	let showTransactionForm = $state(false);

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

	/**
	 * Handle search results
	 */
	function handleSearch(results: Transaction[]) {
		searchResults = results;
		isSearchActive = results.length > 0;
		if (isSearchActive) {
			isFilterActive = false;
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
				isSearchActive = false;
			}
		} catch (error) {
			console.error('Filter error:', error);
		}
	}

	/**
	 * Handle correction request from table
	 */
	async function handleCorrection(transactionId: string, entryId: string) {
		// Find the transaction and entry
		const transaction = transactions.find((t) => t.id === transactionId);
		if (!transaction) return;

		const entry = transaction.entries.find((e) => e.id === entryId);
		if (!entry) return;

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

<div class="transactions-page">
	<!-- Page Header -->
	<header class="page-header">
		<div>
			<h1 class="page-title">Transactions</h1>
			<p class="page-subtitle">View and manage all your financial transactions</p>
		</div>
		<div class="header-actions">
			<Button variant="primary" onclick={() => (showTransactionForm = true)}>
				New Transaction
			</Button>
		</div>
	</header>

	<!-- Search and Filters -->
	<div class="filters-section">
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
	</div>

	<!-- Error Display -->
	{#if error}
		<Card padding="md">
			<div class="error-banner">
				<span>{error}</span>
				<Button variant="ghost" size="sm" onclick={() => transactionStore.clearError()}>
					Dismiss
				</Button>
			</div>
		</Card>
	{/if}

	<!-- Transaction Table -->
	<TransactionTable
		transactions={transactions}
		loading={isLoading}
		onCorrect={handleCorrection}
	/>
</div>

<!-- New Transaction Modal -->
<Modal
	open={showTransactionForm}
	onClose={() => (showTransactionForm = false)}
	title="New Transaction"
	size="lg"
>
	<TransactionForm />
	{#snippet footer()}
		<Button variant="secondary" onclick={() => (showTransactionForm = false)}>Close</Button>
	{/snippet}
</Modal>

<!-- Correction Dialog -->
<Modal
	open={showCorrectionDialog}
	onClose={() => (showCorrectionDialog = false)}
	title="Correct Entry"
	size="md"
>
	<div class="correction-form">
		<Input
			type="number"
			label="Amount (current: ${correctionData.currentAmount.toFixed(2)})"
			bind:value={correctionData.newAmount}
			placeholder="Enter new amount"
			step="0.01"
		/>

		<Input
			type="text"
			label="Category (current: {correctionData.currentCategory || 'none'})"
			bind:value={correctionData.newCategory}
			placeholder="Enter category"
		/>

		<Input
			type="text"
			label="Payment Method (current: {correctionData.currentPaymentMethod || 'none'})"
			bind:value={correctionData.newPaymentMethod}
			placeholder="Enter payment method"
		/>

		<div class="form-group">
			<label for="notes-input">Notes (current: {correctionData.currentNotes || 'none'})</label>
			<textarea
				id="notes-input"
				bind:value={correctionData.newNotes}
				placeholder="Enter notes"
				rows="3"
				class="textarea-input"
			></textarea>
		</div>
	</div>

	{#snippet footer()}
		<Button variant="secondary" onclick={() => (showCorrectionDialog = false)}>Cancel</Button>
		<Button variant="primary" onclick={submitCorrection}>Submit Correction</Button>
	{/snippet}
</Modal>

<style>
	.transactions-page {
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
	}

	/* Page Header */
	.page-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-4);
	}

	.page-title {
		margin: 0 0 var(--space-2) 0;
		font-family: var(--font-display);
		font-size: var(--text-4xl);
		font-weight: var(--font-weight-bold);
		color: var(--color-text-primary);
	}

	.page-subtitle {
		margin: 0;
		font-size: var(--text-lg);
		color: var(--color-text-tertiary);
	}

	.header-actions {
		display: flex;
		gap: var(--space-3);
	}

	/* Filters Section */
	.filters-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	/* Error Banner */
	.error-banner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		padding: var(--space-4);
		background: var(--color-error-50);
		color: var(--color-error-700);
		border-radius: var(--radius-md);
		border: 1px solid var(--color-error-200);
	}

	/* Correction Form */
	.correction-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.form-group label {
		font-size: var(--text-sm);
		font-weight: var(--font-weight-medium);
		color: var(--color-text-primary);
	}

	.textarea-input {
		width: 100%;
		padding: var(--space-3) var(--space-4);
		font-family: var(--font-body);
		font-size: var(--text-base);
		color: var(--color-text-primary);
		background: var(--color-bg-primary);
		border: 1px solid var(--color-border-primary);
		border-radius: var(--radius-md);
		outline: none;
		transition: all var(--transition-fast);
		resize: vertical;
	}

	.textarea-input:hover {
		border-color: var(--color-border-secondary);
	}

	.textarea-input:focus {
		border-color: var(--color-border-focus);
		box-shadow: var(--shadow-focus);
	}

	/* Responsive */
	@media (max-width: 640px) {
		.page-header {
			flex-direction: column;
		}

		.header-actions {
			width: 100%;
		}

		.header-actions :global(button) {
			flex: 1;
		}
	}
</style>
