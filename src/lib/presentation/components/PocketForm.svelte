<script lang="ts">
	/**
	 * Pocket Form Component - Refactored with new design system
	 * Form for creating a new pocket with validation
	 */

	import { pocketStore } from '$lib/application/stores/pocketStore.svelte';
	import {
		validatePocketName,
		validateCurrency,
		validateColorHex,
		getDefaultPocketColor
	} from '$lib/domain/Pocket';
	import type { CreatePocketRequest } from '$lib/domain/Pocket';
	import Input from './ui/Input.svelte';
	import Select from './ui/Select.svelte';
	import Button from './ui/Button.svelte';
	import Card from './ui/Card.svelte';

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
		{ value: 'USD', label: 'US Dollar ($)' },
		{ value: 'EUR', label: 'Euro (€)' },
		{ value: 'IDR', label: 'Indonesian Rupiah (Rp)' }
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

<Card padding="lg">
	<div class="pocket-form-container">
		<h2 class="form-title">Create New Pocket</h2>

		{#if successMessage}
			<div class="success-message">
				<span>{successMessage}</span>
				<button type="button" class="close-btn" onclick={clearMessages} aria-label="Close">
					×
				</button>
			</div>
		{/if}

		{#if pocketStore.error}
			<div class="error-message">
				<span>{pocketStore.error}</span>
				<button type="button" class="close-btn" onclick={clearMessages} aria-label="Close">
					×
				</button>
			</div>
		{/if}

		<form onsubmit={handleSubmit} class="form">
			<!-- Name Field -->
			<Input
				type="text"
				label="Pocket Name"
				bind:value={name}
				placeholder="e.g., Main Wallet, Savings, Emergency Fund"
				required
				error={nameError}
				maxlength={50}
			/>

			<!-- Currency Field -->
			<Select
				label="Currency"
				bind:value={currency}
				options={CURRENCY_OPTIONS}
				required
				error={currencyError}
			/>

			<!-- Icon Field -->
			<div class="form-field">
				<label class="field-label">Icon</label>
				<div class="icon-selector">
					{#each ICON_OPTIONS as iconOption (iconOption)}
						<button
							type="button"
							class="icon-option"
							class:selected={icon === iconOption}
							onclick={() => (icon = iconOption)}
							aria-label="Select icon {iconOption}"
						>
							{iconOption}
						</button>
					{/each}
				</div>
			</div>

			<!-- Color Field -->
			<div class="form-field">
				<label for="pocket-color" class="field-label">Color</label>
				<div class="color-input-wrapper">
					<input
						id="pocket-color"
						type="color"
						bind:value={color}
						class="color-picker"
						aria-label="Pick a color"
					/>
					<Input
						type="text"
						bind:value={color}
						placeholder="#4299E1"
						maxlength={7}
						error={colorError}
					/>
				</div>
			</div>

			<!-- Initial Balance Field -->
			<Input
				type="number"
				label="Initial Balance"
				bind:value={initialBalance}
				placeholder="0.00"
				step="0.01"
				error={balanceError}
			/>

			<!-- Description Field -->
			<div class="form-field">
				<label for="pocket-description" class="field-label">Description</label>
				<textarea
					id="pocket-description"
					bind:value={description}
					placeholder="Optional description for this pocket"
					rows="3"
					maxlength="200"
					class="textarea-input"
				></textarea>
			</div>

			<!-- Submit Button -->
			<div class="form-actions">
				<Button type="button" variant="secondary" onclick={clearForm} disabled={isSubmitting}>
					Clear
				</Button>
				<Button type="submit" variant="primary" loading={isSubmitting}>
					Create Pocket
				</Button>
			</div>
		</form>
	</div>
</Card>

<style>
	.pocket-form-container {
		width: 100%;
	}

	.form-title {
		margin: 0 0 var(--space-6) 0;
		font-family: var(--font-display);
		font-size: var(--text-2xl);
		font-weight: var(--font-weight-semibold);
		color: var(--color-text-primary);
	}

	.success-message,
	.error-message {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-4);
		border-radius: var(--radius-md);
		margin-bottom: var(--space-6);
		gap: var(--space-4);
	}

	.success-message {
		background-color: var(--color-success-100);
		color: var(--color-success-700);
		border: 1px solid var(--color-success-200);
	}

	.error-message {
		background-color: var(--color-error-100);
		color: var(--color-error-700);
		border: 1px solid var(--color-error-200);
	}

	.close-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		padding: 0;
		background: none;
		border: none;
		font-size: var(--text-2xl);
		line-height: 1;
		cursor: pointer;
		opacity: 0.7;
		transition: opacity var(--transition-fast);
		color: currentColor;
	}

	.close-btn:hover {
		opacity: 1;
	}

	.form {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
	}

	.form-field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.field-label {
		font-size: var(--text-sm);
		font-weight: var(--font-weight-medium);
		color: var(--color-text-primary);
	}

	/* Icon Selector */
	.icon-selector {
		display: flex;
		gap: var(--space-2);
		flex-wrap: wrap;
	}

	.icon-option {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		border: 2px solid var(--color-border-primary);
		border-radius: var(--radius-md);
		background: var(--color-bg-primary);
		font-size: var(--text-2xl);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.icon-option:hover {
		border-color: var(--color-border-secondary);
		transform: scale(1.05);
	}

	.icon-option.selected {
		border-color: var(--color-primary-500);
		background-color: var(--color-primary-50);
	}

	/* Color Input */
	.color-input-wrapper {
		display: flex;
		gap: var(--space-3);
		align-items: flex-start;
	}

	.color-picker {
		width: 60px;
		height: 40px;
		border: 1px solid var(--color-border-primary);
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: border-color var(--transition-fast);
	}

	.color-picker:hover {
		border-color: var(--color-border-secondary);
	}

	.color-input-wrapper :global(.input-wrapper) {
		flex: 1;
	}

	/* Textarea */
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

	/* Form Actions */
	.form-actions {
		display: flex;
		gap: var(--space-3);
		margin-top: var(--space-4);
	}

	.form-actions :global(button) {
		flex: 1;
	}

	/* Responsive */
	@media (max-width: 640px) {
		.form-actions {
			flex-direction: column;
		}

		.form-actions :global(button) {
			width: 100%;
		}
	}
</style>
