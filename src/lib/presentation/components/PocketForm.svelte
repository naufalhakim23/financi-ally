<script lang="ts">
	/**
	 * Pocket Form Component
	 *
	 * Form for creating a new pocket.
	 * Includes validation and integrates with pocketStore.
	 */

	import { pocketStore } from '$lib/application/stores/pocketStore.svelte';
	import {
		validatePocketName,
		validateCurrency,
		validateColorHex,
		getDefaultPocketColor
	} from '$lib/domain/Pocket';
	import type { CreatePocketRequest } from '$lib/domain/Pocket';

	// Form state
	let name = $state('');
	let currency = $state('USD');
	let description = $state('');
	let icon = $state('💰');
	let color = $state(getDefaultPocketColor());
	let initialBalance = $state('0.00');

	// Validation errors
	let nameError = $state('');
	let currencyError = $state('');
	let colorError = $state('');
	let balanceError = $state('');

	// Form state
	let isSubmitting = $state(false);
	let successMessage = $state('');

	const CURRENCY_OPTIONS = [
		{ code: 'USD', label: 'US Dollar ($)' },
		{ code: 'EUR', label: 'Euro (€)' },
		{ code: 'IDR', label: 'Indonesian Rupiah (Rp)' }
	];

	const ICON_OPTIONS = ['💰', '💳', '🏦', '💵', '💴', '💶', '💷', '🪙', '📊', '💼'];

	function validateForm(): boolean {
		let isValid = true;

		// Validate name
		const nameValidation = validatePocketName(name);
		if (!nameValidation.valid) {
			nameError = nameValidation.error || '';
			isValid = false;
		} else {
			nameError = '';
		}

		// Validate currency
		const currencyValidation = validateCurrency(currency);
		if (!currencyValidation.valid) {
			currencyError = currencyValidation.error || '';
			isValid = false;
		} else {
			currencyError = '';
		}

		// Validate color
		const colorValidation = validateColorHex(color);
		if (!colorValidation.valid) {
			colorError = colorValidation.error || '';
			isValid = false;
		} else {
			colorError = '';
		}

		// Validate balance (must be a valid number)
		const balanceNum = parseFloat(initialBalance);
		if (isNaN(balanceNum)) {
			balanceError = 'Initial balance must be a valid number';
			isValid = false;
		} else {
			balanceError = '';
		}

		return isValid;
	}

	async function handleSubmit(event: Event) {
		event.preventDefault();
		successMessage = '';

		if (!validateForm()) {
			return;
		}

		isSubmitting = true;

		// Convert initial balance to cents
		const balanceNum = parseFloat(initialBalance);
		const initialBalanceCents = Math.round(balanceNum * 100);

		const request: CreatePocketRequest = {
			name: name.trim(),
			currency,
			description: description.trim() || undefined,
			icon: icon || undefined,
			color,
			initialBalanceCents
		};

		const result = await pocketStore.createPocket(request);

		isSubmitting = false;

		if (result.success) {
			successMessage = `Pocket "${name}" created successfully!`;
			// Clear form
			clearForm();
		}
		// Error is already set in pocketStore.error
	}

	function clearForm() {
		name = '';
		currency = 'USD';
		description = '';
		icon = '💰';
		color = getDefaultPocketColor();
		initialBalance = '0.00';
		nameError = '';
		currencyError = '';
		colorError = '';
		balanceError = '';
	}

	function clearMessages() {
		successMessage = '';
		pocketStore.clearError();
	}
</script>

<div class="pocket-form-container">
	<h2>Create New Pocket</h2>

	{#if successMessage}
		<div class="success-message">
			{successMessage}
			<button type="button" class="close-btn" onclick={clearMessages}>×</button>
		</div>
	{/if}

	{#if pocketStore.error}
		<div class="error-message">
			{pocketStore.error}
			<button type="button" class="close-btn" onclick={clearMessages}>×</button>
		</div>
	{/if}

	<form onsubmit={handleSubmit}>
		<!-- Name Field -->
		<div class="form-field">
			<label for="pocket-name">
				Name <span class="required">*</span>
			</label>
			<input
				id="pocket-name"
				type="text"
				bind:value={name}
				placeholder="e.g., Main Wallet, Savings, Emergency Fund"
				maxlength="50"
				required
				class:error={nameError}
			/>
			{#if nameError}
				<span class="field-error">{nameError}</span>
			{/if}
		</div>

		<!-- Currency Field -->
		<div class="form-field">
			<label for="pocket-currency">
				Currency <span class="required">*</span>
			</label>
			<select id="pocket-currency" bind:value={currency} required class:error={currencyError}>
				{#each CURRENCY_OPTIONS as option (option.code)}
					<option value={option.code}>{option.label}</option>
				{/each}
			</select>
			{#if currencyError}
				<span class="field-error">{currencyError}</span>
			{/if}
		</div>

		<!-- Icon Field -->
		<div class="form-field">
			<label for="pocket-icon">Icon</label>
			<div class="icon-selector">
				{#each ICON_OPTIONS as iconOption (iconOption)}
					<button
						type="button"
						class="icon-option"
						class:selected={icon === iconOption}
						onclick={() => (icon = iconOption)}
					>
						{iconOption}
					</button>
				{/each}
			</div>
		</div>

		<!-- Color Field -->
		<div class="form-field">
			<label for="pocket-color">Color</label>
			<div class="color-input-wrapper">
				<input
					id="pocket-color"
					type="color"
					bind:value={color}
					class:error={colorError}
				/>
				<input
					type="text"
					bind:value={color}
					placeholder="#4299E1"
					maxlength="7"
					class:error={colorError}
				/>
			</div>
			{#if colorError}
				<span class="field-error">{colorError}</span>
			{/if}
		</div>

		<!-- Initial Balance Field -->
		<div class="form-field">
			<label for="pocket-balance">Initial Balance</label>
			<input
				id="pocket-balance"
				type="number"
				step="0.01"
				bind:value={initialBalance}
				placeholder="0.00"
				class:error={balanceError}
			/>
			{#if balanceError}
				<span class="field-error">{balanceError}</span>
			{/if}
		</div>

		<!-- Description Field -->
		<div class="form-field">
			<label for="pocket-description">Description</label>
			<textarea
				id="pocket-description"
				bind:value={description}
				placeholder="Optional description for this pocket"
				rows="3"
				maxlength="200"
			></textarea>
		</div>

		<!-- Submit Button -->
		<button type="submit" class="submit-btn" disabled={isSubmitting}>
			{isSubmitting ? 'Creating...' : 'Create Pocket'}
		</button>
	</form>
</div>

<style>
	.pocket-form-container {
		background: white;
		padding: 1.5rem;
		border-radius: 0.5rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		margin-bottom: 2rem;
	}

	h2 {
		margin: 0 0 1.5rem 0;
		font-size: 1.5rem;
		font-weight: 600;
		color: #1f2937;
	}

	.success-message,
	.error-message {
		padding: 1rem;
		border-radius: 0.375rem;
		margin-bottom: 1rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.success-message {
		background-color: #d1fae5;
		color: #065f46;
	}

	.error-message {
		background-color: #fee2e2;
		color: #dc2626;
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 1.5rem;
		cursor: pointer;
		padding: 0;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0.7;
		transition: opacity 0.2s;
	}

	.close-btn:hover {
		opacity: 1;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.form-field {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	label {
		font-weight: 500;
		font-size: 0.875rem;
		color: #374151;
	}

	.required {
		color: #dc2626;
	}

	input[type='text'],
	input[type='number'],
	select,
	textarea {
		padding: 0.5rem;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		font-size: 1rem;
		transition: border-color 0.2s;
	}

	input[type='text']:focus,
	input[type='number']:focus,
	select:focus,
	textarea:focus {
		outline: none;
		border-color: #4299e1;
		box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
	}

	input.error,
	select.error,
	textarea.error {
		border-color: #dc2626;
	}

	.field-error {
		font-size: 0.75rem;
		color: #dc2626;
	}

	.icon-selector {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.icon-option {
		width: 40px;
		height: 40px;
		border: 2px solid #d1d5db;
		border-radius: 0.375rem;
		background: white;
		font-size: 1.25rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.icon-option:hover {
		border-color: #9ca3af;
		transform: scale(1.1);
	}

	.icon-option.selected {
		border-color: #4299e1;
		background-color: #eff6ff;
	}

	.color-input-wrapper {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	input[type='color'] {
		width: 60px;
		height: 40px;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		cursor: pointer;
	}

	.color-input-wrapper input[type='text'] {
		flex: 1;
	}

	textarea {
		resize: vertical;
		min-height: 60px;
		font-family: inherit;
	}

	.submit-btn {
		padding: 0.75rem;
		background-color: #4299e1;
		color: white;
		border: none;
		border-radius: 0.375rem;
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.submit-btn:hover:not(:disabled) {
		background-color: #3182ce;
	}

	.submit-btn:disabled {
		background-color: #9ca3af;
		cursor: not-allowed;
	}
</style>
