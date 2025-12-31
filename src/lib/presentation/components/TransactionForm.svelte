<script lang="ts">
	import { transactionStore } from '$lib/application/stores/transactionStore.svelte';
	import { dollarsToCents } from '$lib/domain/Transaction';
	import type { CreateTransactionRequest } from '$lib/domain/Transaction';
	import ReceiptUpload from './ReceiptUpload.svelte';

	// Form state using Svelte 5 runes
	let amount = $state('');
	let transactionType = $state<'income' | 'expense'>('expense');
	let scope = $state<'personal' | 'business'>('personal');
	let description = $state('');
	let category = $state('');
	let paymentMethod = $state('');
	let notes = $state('');
	let receiptBase64 = $state<string | undefined>(undefined);

	// UI state
	let isSubmitting = $state(false);
	let formError = $state<string | null>(null);
	let showSuccess = $state(false);

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

			// Build request
			const request: CreateTransactionRequest = {
				amountCents: dollarsToCents(amountValue),
				transactionType,
				scope,
				description: description.trim() || undefined,
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
		category = '';
		paymentMethod = '';
		notes = '';
		receiptBase64 = undefined;
	}
</script>

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
	<div class="form-group">
		<label for="amount">Amount *</label>
		<input
			id="amount"
			type="number"
			step="0.01"
			min="0.01"
			bind:value={amount}
			placeholder="0.00"
			required
			disabled={isSubmitting}
		/>
	</div>

	<!-- Transaction Type -->
	<div class="form-group">
		<label>Type *</label>
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
		<label>Scope *</label>
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
	<div class="form-group">
		<label for="description">Description</label>
		<input
			id="description"
			type="text"
			bind:value={description}
			placeholder="What was this for?"
			maxlength="500"
			disabled={isSubmitting}
		/>
	</div>

	<!-- Category -->
	<div class="form-group">
		<label for="category">Category</label>
		<input
			id="category"
			type="text"
			bind:value={category}
			placeholder="e.g., Food, Transportation"
			maxlength="100"
			disabled={isSubmitting}
		/>
	</div>

	<!-- Payment Method -->
	<div class="form-group">
		<label for="paymentMethod">Payment Method</label>
		<input
			id="paymentMethod"
			type="text"
			bind:value={paymentMethod}
			placeholder="e.g., Cash, Credit Card"
			maxlength="100"
			disabled={isSubmitting}
		/>
	</div>

	<!-- Notes -->
	<div class="form-group">
		<label for="notes">Notes</label>
		<textarea
			id="notes"
			bind:value={notes}
			placeholder="Additional notes..."
			maxlength="1000"
			rows="3"
			disabled={isSubmitting}
		></textarea>
	</div>

	<!-- Receipt Upload -->
	<div class="form-group">
		<ReceiptUpload bind:receiptBase64 />
	</div>

	<!-- Actions -->
	<div class="form-actions">
		<button type="button" onclick={resetForm} disabled={isSubmitting} class="btn btn-secondary">
			Clear
		</button>
		<button type="submit" disabled={isSubmitting} class="btn btn-primary">
			{isSubmitting ? 'Creating...' : 'Create Transaction'}
		</button>
	</div>
</form>

<style>
	.transaction-form {
		max-width: 600px;
		margin: 0 auto;
		padding: 1.5rem;
		background: white;
		border-radius: 8px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.form-title {
		margin: 0 0 1.5rem 0;
		font-size: 1.5rem;
		font-weight: 600;
		color: #1a202c;
	}

	.form-group {
		margin-bottom: 1.25rem;
	}

	label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
		color: #4a5568;
	}

	input[type='text'],
	input[type='number'],
	textarea {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #cbd5e0;
		border-radius: 4px;
		font-size: 1rem;
		transition: border-color 0.2s;
	}

	input[type='text']:focus,
	input[type='number']:focus,
	textarea:focus {
		outline: none;
		border-color: #4299e1;
		box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
	}

	input:disabled,
	textarea:disabled {
		background-color: #f7fafc;
		cursor: not-allowed;
	}

	.radio-group {
		display: flex;
		gap: 1rem;
	}

	.radio-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
	}

	.radio-label input[type='radio'] {
		width: auto;
		cursor: pointer;
	}

	.radio-label span {
		font-weight: normal;
	}

	.form-actions {
		display: flex;
		gap: 1rem;
		margin-top: 1.5rem;
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

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-primary {
		background-color: #4299e1;
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background-color: #3182ce;
	}

	.btn-secondary {
		background-color: #e2e8f0;
		color: #2d3748;
	}

	.btn-secondary:hover:not(:disabled) {
		background-color: #cbd5e0;
	}

	.alert {
		padding: 1rem;
		border-radius: 4px;
		margin-bottom: 1rem;
	}

	.alert-success {
		background-color: #c6f6d5;
		color: #22543d;
		border: 1px solid #9ae6b4;
	}

	.alert-error {
		background-color: #fed7d7;
		color: #742a2a;
		border: 1px solid #fc8181;
	}

	/* Mobile optimizations */
	@media (max-width: 640px) {
		.transaction-form {
			padding: 1rem;
		}

		.form-title {
			font-size: 1.25rem;
		}

		.form-actions {
			flex-direction: column;
		}

		.btn {
			width: 100%;
		}
	}
</style>
