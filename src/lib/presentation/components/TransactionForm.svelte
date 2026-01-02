<script lang="ts">
	import { onMount } from 'svelte';
	import { transactionStore } from '$lib/application/stores/transactionStore.svelte';
	import { pocketStore } from '$lib/application/stores/pocketStore.svelte';
	import { dollarsToCents } from '$lib/domain/Transaction';
	import type { CreateTransactionRequest } from '$lib/domain/Transaction';
	import Input from './ui/Input.svelte';
	import Button from './ui/Button.svelte';
	import Card from './ui/Card.svelte';
	import ReceiptUpload from './ReceiptUpload.svelte';
	import PocketSelector from './PocketSelector.svelte';
	import CategorySelector from './CategorySelector.svelte';
	import CategoryCreateForm from './CategoryCreateForm.svelte';

	// Form state using Svelte 5 runes
	let amount = $state('');
	let transactionType = $state<'income' | 'expense'>('expense');
	let scope = $state<'personal' | 'business'>('personal');
	let description = $state('');
	let selectedCategoryId = $state('');
	let category = $state(''); // Legacy free-text category (kept for backward compatibility)
	let paymentMethod = $state('');
	let notes = $state('');
	let receiptBase64 = $state<string | undefined>(undefined);
	let selectedPocketId = $state('');

	// UI state
	let isSubmitting = $state(false);
	let formError = $state<string | null>(null);
	let showSuccess = $state(false);
	let showCategoryCreateForm = $state(false);

	/**
	 * Load pockets on mount and set default pocket
	 */
	onMount(() => {
		pocketStore.loadPockets();
		// Set default pocket ID when available
		if (pocketStore.defaultPocket) {
			selectedPocketId = pocketStore.defaultPocket.id;
		}
	});

	/**
	 * Handle form submission
	 */
	async function handleSubmit(event: Event) {
		event.preventDefault();
		formError = null;
		isSubmitting = true;

		try {
			// Parse amount
			const amountValue = parseFloat(amount);
			if (isNaN(amountValue) || amountValue <= 0) {
				formError = 'Please enter a valid amount greater than 0';
				isSubmitting = false;
				return;
			}

			// Validate pocket is selected
			if (!selectedPocketId) {
				formError = 'Please select a pocket';
				isSubmitting = false;
				return;
			}

			// Build request
			const request: CreateTransactionRequest = {
				amountCents: dollarsToCents(amountValue),
				transactionType,
				scope,
				pocketId: selectedPocketId,
				description: description.trim() || undefined,
				categoryId: selectedCategoryId || undefined,
				category: category.trim() || undefined,
				paymentMethod: paymentMethod.trim() || undefined,
				notes: notes.trim() || undefined,
				receiptBase64: receiptBase64 || undefined
			};

			// Submit
			const result = await transactionStore.createTransaction(request);

			if (result.success) {
				// Show success and reset form
				showSuccess = true;
				setTimeout(() => {
					showSuccess = false;
				}, 3000);

				resetForm();
			} else {
				formError = result.error;
			}
		} catch (error) {
			formError = error instanceof Error ? error.message : 'Unknown error occurred';
		} finally {
			isSubmitting = false;
		}
	}

	/**
	 * Reset form to initial state
	 */
	function resetForm() {
		amount = '';
		transactionType = 'expense';
		scope = 'personal';
		description = '';
		selectedCategoryId = '';
		category = '';
		paymentMethod = '';
		notes = '';
		receiptBase64 = undefined;
		selectedPocketId = pocketStore.defaultPocket?.id || '';
		showCategoryCreateForm = false;
	}

	/**
	 * Handle category creation success
	 */
	function handleCategoryCreated(categoryId: string) {
		selectedCategoryId = categoryId;
		showCategoryCreateForm = false;
	}
</script>

<Card padding="lg">
	<form onsubmit={handleSubmit} class="transaction-form">
		<h2 class="form-title">New Transaction</h2>

		<!-- Success message -->
		{#if showSuccess}
			<div class="alert alert-success">Transaction created successfully!</div>
		{/if}

		<!-- Error message -->
		{#if formError}
			<div class="alert alert-error">{formError}</div>
		{/if}

		<!-- Amount -->
		<Input
			type="number"
			label="Amount"
			bind:value={amount}
			placeholder="0.00"
			step="0.01"
			required
			disabled={isSubmitting}
		/>

		<!-- Pocket Selector -->
		<PocketSelector
			bind:selectedPocketId={selectedPocketId}
			onselect={(id) => (selectedPocketId = id)}
		/>

		<!-- Transaction Type -->
		<div class="form-group">
			<label class="field-label">Type</label>
			<div class="radio-group">
				<label class="radio-label">
					<input
						type="radio"
						bind:group={transactionType}
						value="expense"
						disabled={isSubmitting}
					/>
					<span>Expense</span>
				</label>
				<label class="radio-label">
					<input
						type="radio"
						bind:group={transactionType}
						value="income"
						disabled={isSubmitting}
					/>
					<span>Income</span>
				</label>
			</div>
		</div>

		<!-- Scope -->
		<div class="form-group">
			<label class="field-label">Scope</label>
			<div class="radio-group">
				<label class="radio-label">
					<input type="radio" bind:group={scope} value="personal" disabled={isSubmitting} />
					<span>Personal</span>
				</label>
				<label class="radio-label">
					<input type="radio" bind:group={scope} value="business" disabled={isSubmitting} />
					<span>Business</span>
				</label>
			</div>
		</div>

		<!-- Description -->
		<Input
			type="text"
			label="Description"
			bind:value={description}
			placeholder="What was this for?"
			maxlength={500}
			disabled={isSubmitting}
		/>

		<!-- Category Selector -->
		{#if !showCategoryCreateForm}
			<CategorySelector
				bind:selectedCategoryId={selectedCategoryId}
				transactionType={transactionType}
				onselect={(id) => (selectedCategoryId = id)}
				oncreatenew={() => (showCategoryCreateForm = true)}
			/>
		{:else}
			<CategoryCreateForm
				transactionType={transactionType}
				oncancel={() => (showCategoryCreateForm = false)}
				onsuccess={handleCategoryCreated}
			/>
		{/if}

		<!-- Payment Method -->
		<Input
			type="text"
			label="Payment Method"
			bind:value={paymentMethod}
			placeholder="e.g., Cash, Credit Card"
			maxlength={100}
			disabled={isSubmitting}
		/>

		<!-- Notes -->
		<div class="form-group">
			<label for="notes" class="field-label">Notes</label>
			<textarea
				id="notes"
				bind:value={notes}
				placeholder="Additional notes..."
				maxlength="1000"
				rows="3"
				disabled={isSubmitting}
				class="textarea-input"
			></textarea>
		</div>

		<!-- Receipt Upload -->
		<div class="form-group">
			<ReceiptUpload bind:receiptBase64 />
		</div>

		<!-- Actions -->
		<div class="form-actions">
			<Button variant="secondary" onclick={resetForm} disabled={isSubmitting}>Clear</Button>
			<Button type="submit" variant="primary" loading={isSubmitting}>
				Create Transaction
			</Button>
		</div>
	</form>
</Card>

<style>
	.transaction-form {
		max-width: 600px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
	}

	.form-title {
		margin: 0 0 var(--space-4) 0;
		font-family: var(--font-display);
		font-size: var(--text-2xl);
		font-weight: var(--font-weight-semibold);
		color: var(--color-text-primary);
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.field-label {
		display: block;
		font-weight: var(--font-weight-medium);
		font-size: var(--text-sm);
		color: var(--color-text-primary);
	}

	.radio-group {
		display: flex;
		gap: var(--space-4);
		padding: var(--space-2) 0;
	}

	.radio-label {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		cursor: pointer;
		font-size: var(--text-base);
		color: var(--color-text-primary);
	}

	.radio-label input[type='radio'] {
		width: auto;
		cursor: pointer;
	}

	.radio-label span {
		font-weight: normal;
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
		min-height: 80px;
	}

	.textarea-input::placeholder {
		color: var(--color-text-tertiary);
	}

	.textarea-input:hover {
		border-color: var(--color-border-secondary);
	}

	.textarea-input:focus {
		border-color: var(--color-border-focus);
		box-shadow: var(--shadow-focus);
	}

	.textarea-input:disabled {
		background-color: var(--color-bg-secondary);
		cursor: not-allowed;
		opacity: 0.6;
	}

	.form-actions {
		display: flex;
		gap: var(--space-3);
		margin-top: var(--space-4);
	}

	.form-actions :global(button) {
		flex: 1;
	}

	.alert {
		padding: var(--space-4);
		border-radius: var(--radius-md);
		margin-bottom: var(--space-4);
	}

	.alert-success {
		background-color: var(--color-success-100);
		color: var(--color-success-700);
		border: 1px solid var(--color-success-200);
	}

	.alert-error {
		background-color: var(--color-error-100);
		color: var(--color-error-700);
		border: 1px solid var(--color-error-200);
	}

	/* Mobile optimizations */
	@media (max-width: 640px) {
		.form-actions {
			flex-direction: column;
		}

		.form-actions :global(button) {
			width: 100%;
		}
	}
</style>
