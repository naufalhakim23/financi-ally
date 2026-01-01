<script lang="ts">
	/**
	 * Category Create Form Component
	 *
	 * Inline form for creating a new category quickly.
	 * Compact design suitable for embedding in modals or inline sections.
	 */

	import { categoryStore } from '$lib/application/stores/categoryStore.svelte';
	import {
		validateCategoryName,
		validateCategoryCode,
		validateCategoryColor,
		validateCategoryType,
		generateCategoryCode,
		getDefaultCategoryColor,
		CATEGORY_COLORS
	} from '$lib/domain/Category';
	import type { CreateCategoryRequest } from '$lib/domain/Category';

	interface Props {
		transactionType?: 'income' | 'expense';
		oncancel?: () => void;
		onsuccess?: (categoryId: string) => void;
	}

	let { transactionType, oncancel, onsuccess }: Props = $props();

	// Form state
	let name = $state('');
	let code = $state('');
	let description = $state('');
	let color = $state(getDefaultCategoryColor());
	let isExpense = $state(transactionType === 'expense' || !transactionType);
	let isIncome = $state(transactionType === 'income' || !transactionType);

	// Auto-generate code from name
	$effect(() => {
		if (name && !code) {
			code = generateCategoryCode(name);
		}
	});

	// Validation errors
	let nameError = $state('');
	let codeError = $state('');
	let colorError = $state('');
	let typeError = $state('');

	// Form state
	let isSubmitting = $state(false);

	function validateForm(): boolean {
		let isValid = true;

		// Validate name
		const nameValidation = validateCategoryName(name);
		if (!nameValidation.valid) {
			nameError = nameValidation.error || '';
			isValid = false;
		} else {
			nameError = '';
		}

		// Validate code
		const codeValidation = validateCategoryCode(code);
		if (!codeValidation.valid) {
			codeError = codeValidation.error || '';
			isValid = false;
		} else {
			codeError = '';
		}

		// Validate color
		const colorValidation = validateCategoryColor(color);
		if (!colorValidation.valid) {
			colorError = colorValidation.error || '';
			isValid = false;
		} else {
			colorError = '';
		}

		// Validate type
		const typeValidation = validateCategoryType(isExpense, isIncome);
		if (!typeValidation.valid) {
			typeError = typeValidation.error || '';
			isValid = false;
		} else {
			typeError = '';
		}

		return isValid;
	}

	async function handleSubmit(event: Event) {
		event.preventDefault();

		if (!validateForm()) {
			return;
		}

		isSubmitting = true;

		const request: CreateCategoryRequest = {
			name: name.trim(),
			code: code.trim(),
			description: description.trim() || undefined,
			color,
			isExpense,
			isIncome
		};

		const result = await categoryStore.createCategory(request);

		isSubmitting = false;

		if (result.success && result.data) {
			// Reset form
			name = '';
			code = '';
			description = '';
			color = getDefaultCategoryColor();

			// Call success callback
			if (onsuccess) {
				onsuccess(result.data.id);
			}
		}
	}

	function handleCancel() {
		if (oncancel) {
			oncancel();
		}
	}
</script>

<form class="category-create-form" onsubmit={handleSubmit}>
	<h3>Create New Category</h3>

	<!-- Name -->
	<div class="form-group">
		<label for="category-name">Name *</label>
		<input
			id="category-name"
			type="text"
			bind:value={name}
			placeholder="e.g., Food & Dining"
			required
		/>
		{#if nameError}
			<span class="error-text">{nameError}</span>
		{/if}
	</div>

	<!-- Code (auto-generated, editable) -->
	<div class="form-group">
		<label for="category-code">Code *</label>
		<input
			id="category-code"
			type="text"
			bind:value={code}
			placeholder="e.g., food_dining"
			required
		/>
		<span class="help-text">Auto-generated from name, lowercase snake_case</span>
		{#if codeError}
			<span class="error-text">{codeError}</span>
		{/if}
	</div>

	<!-- Description (optional) -->
	<div class="form-group">
		<label for="category-description">Description</label>
		<input
			id="category-description"
			type="text"
			bind:value={description}
			placeholder="Optional description"
		/>
	</div>

	<!-- Color picker -->
	<div class="form-group">
		<label for="category-color">Color *</label>
		<div class="color-picker">
			{#each CATEGORY_COLORS as colorOption}
				<button
					type="button"
					class="color-option"
					class:selected={color === colorOption}
					style="background-color: {colorOption}"
					onclick={() => (color = colorOption)}
					title={colorOption}
				></button>
			{/each}
		</div>
		<input
			id="category-color"
			type="text"
			bind:value={color}
			placeholder="#4299E1"
			pattern="^#[0-9A-Fa-f]{6}$"
		/>
		{#if colorError}
			<span class="error-text">{colorError}</span>
		{/if}
	</div>

	<!-- Type checkboxes -->
	<div class="form-group">
		<label>Category Type *</label>
		<div class="checkbox-group">
			<label class="checkbox-label">
				<input type="checkbox" bind:checked={isExpense} />
				Can be used for Expenses
			</label>
			<label class="checkbox-label">
				<input type="checkbox" bind:checked={isIncome} />
				Can be used for Income
			</label>
		</div>
		{#if typeError}
			<span class="error-text">{typeError}</span>
		{/if}
	</div>

	<!-- Store error -->
	{#if categoryStore.error}
		<div class="error-banner">{categoryStore.error}</div>
	{/if}

	<!-- Actions -->
	<div class="form-actions">
		{#if oncancel}
			<button type="button" class="btn-secondary" onclick={handleCancel}>
				Cancel
			</button>
		{/if}
		<button type="submit" class="btn-primary" disabled={isSubmitting}>
			{isSubmitting ? 'Creating...' : 'Create Category'}
		</button>
	</div>
</form>

<style>
	.category-create-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.5rem;
		background-color: white;
		border-radius: 0.5rem;
		border: 1px solid #e5e7eb;
	}

	h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: #111827;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	label {
		font-weight: 500;
		font-size: 0.875rem;
		color: #374151;
	}

	input[type='text'] {
		padding: 0.5rem;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		transition: border-color 0.2s;
	}

	input[type='text']:focus {
		outline: none;
		border-color: #4299e1;
		box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
	}

	.help-text {
		font-size: 0.75rem;
		color: #6b7280;
	}

	.error-text {
		font-size: 0.75rem;
		color: #dc2626;
	}

	.error-banner {
		padding: 0.75rem;
		background-color: #fee2e2;
		color: #dc2626;
		border-radius: 0.375rem;
		font-size: 0.875rem;
	}

	/* Color picker */
	.color-picker {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.color-option {
		width: 2rem;
		height: 2rem;
		border-radius: 0.25rem;
		border: 2px solid transparent;
		cursor: pointer;
		transition: transform 0.2s;
	}

	.color-option:hover {
		transform: scale(1.1);
	}

	.color-option.selected {
		border-color: #111827;
		box-shadow: 0 0 0 2px white, 0 0 0 4px #111827;
	}

	/* Checkboxes */
	.checkbox-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.5rem 0;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: normal;
		cursor: pointer;
	}

	.checkbox-label input[type='checkbox'] {
		width: 1.125rem;
		height: 1.125rem;
		cursor: pointer;
	}

	/* Form actions */
	.form-actions {
		display: flex;
		gap: 0.75rem;
		justify-content: flex-end;
		margin-top: 0.5rem;
	}

	.btn-primary,
	.btn-secondary {
		padding: 0.5rem 1rem;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
		border: none;
	}

	.btn-primary {
		background-color: #4299e1;
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background-color: #3182ce;
	}

	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-secondary {
		background-color: #f3f4f6;
		color: #374151;
		border: 1px solid #d1d5db;
	}

	.btn-secondary:hover {
		background-color: #e5e7eb;
	}
</style>
