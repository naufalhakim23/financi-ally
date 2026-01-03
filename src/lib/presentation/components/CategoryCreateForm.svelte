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
	import Input from './ui/Input.svelte';
	import Button from './ui/Button.svelte';

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
	<h3 class="form-title">Create New Category</h3>

	<!-- Name -->
	<Input
		type="text"
		label="Name"
		bind:value={name}
		placeholder="e.g., Food & Dining"
		required
		error={nameError}
	/>

	<!-- Code (auto-generated, editable) -->
	<div class="form-group">
		<Input
			type="text"
			label="Code"
			bind:value={code}
			placeholder="e.g., food_dining"
			required
			error={codeError}
		/>
		<span class="help-text">Auto-generated from name, lowercase snake_case</span>
	</div>

	<!-- Description (optional) -->
	<Input
		type="text"
		label="Description"
		bind:value={description}
		placeholder="Optional description"
	/>

	<!-- Color picker -->
	<div class="form-group">
		<label class="field-label">Color</label>
		<div class="color-picker">
			{#each CATEGORY_COLORS as colorOption}
				<button
					type="button"
					class="color-option"
					class:selected={color === colorOption}
					style="background-color: {colorOption}"
					onclick={() => (color = colorOption)}
					title={colorOption}
					aria-label="Select color {colorOption}"
				></button>
			{/each}
		</div>
		<Input type="text" bind:value={color} placeholder="#4299E1" error={colorError} />
	</div>

	<!-- Type checkboxes -->
	<div class="form-group">
		<label class="field-label">Category Type</label>
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
			<Button variant="secondary" onclick={handleCancel}>Cancel</Button>
		{/if}
		<Button type="submit" variant="primary" loading={isSubmitting}>
			Create Category
		</Button>
	</div>
</form>

<style>
	.category-create-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding: var(--space-6);
		background-color: var(--color-bg-primary);
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-border-primary);
	}

	.form-title {
		margin: 0 0 var(--space-2) 0;
		font-family: var(--font-display);
		font-size: var(--text-xl);
		font-weight: var(--font-weight-semibold);
		color: var(--color-text-primary);
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.field-label {
		font-weight: var(--font-weight-medium);
		font-size: var(--text-sm);
		color: var(--color-text-primary);
	}

	.help-text {
		font-size: var(--text-xs);
		color: var(--color-text-tertiary);
		margin-top: calc(var(--space-2) * -1);
	}

	.error-text {
		font-size: var(--text-xs);
		color: var(--color-error-600);
	}

	.error-banner {
		padding: var(--space-3);
		background-color: var(--color-error-100);
		color: var(--color-error-700);
		border-radius: var(--radius-md);
		font-size: var(--text-sm);
		border: 1px solid var(--color-error-200);
	}

	/* Color picker */
	.color-picker {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
	}

	.color-option {
		width: 32px;
		height: 32px;
		border-radius: var(--radius-md);
		border: 2px solid transparent;
		cursor: pointer;
		transition: transform var(--transition-fast);
	}

	.color-option:hover {
		transform: scale(1.1);
	}

	.color-option.selected {
		border-color: var(--color-text-primary);
		box-shadow: 0 0 0 2px var(--color-bg-primary), 0 0 0 4px var(--color-text-primary);
	}

	/* Checkboxes */
	.checkbox-group {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-2) 0;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-weight: normal;
		font-size: var(--text-sm);
		color: var(--color-text-primary);
		cursor: pointer;
	}

	.checkbox-label input[type='checkbox'] {
		width: 18px;
		height: 18px;
		cursor: pointer;
	}

	/* Form actions */
	.form-actions {
		display: flex;
		gap: var(--space-3);
		justify-content: flex-end;
		margin-top: var(--space-2);
	}
</style>
