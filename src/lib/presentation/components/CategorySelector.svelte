<script lang="ts">
	/**
	 * Category Selector Component
	 *
	 * Dropdown component for selecting a category.
	 * Used in TransactionForm to choose which category a transaction belongs to.
	 * Filters categories based on transaction type (expense or income).
	 */

	import { categoryStore } from '$lib/application/stores/categoryStore.svelte';

	interface Props {
		selectedCategoryId: string;
		transactionType: 'income' | 'expense';
		onselect?: (categoryId: string) => void;
		oncreatenew?: () => void;
	}

	let { selectedCategoryId = $bindable(''), transactionType, onselect, oncreatenew }: Props = $props();

	// Load categories on mount
	$effect(() => {
		if (categoryStore.categories.length === 0) {
			categoryStore.loadCategories();
		}
	});

	// Get filtered categories based on transaction type
	let filteredCategories = $derived(
		categoryStore.getCategoriesForType(transactionType)
	);

	function handleChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		const categoryId = target.value;

		if (categoryId === '__create_new__') {
			// User selected "Create New Category"
			if (oncreatenew) {
				oncreatenew();
			}
			return;
		}

		selectedCategoryId = categoryId;

		if (onselect) {
			onselect(categoryId);
		}
	}
</script>

<div class="category-selector">
	<label for="category-select">Category (Optional)</label>

	{#if categoryStore.isLoading}
		<div class="loading">Loading categories...</div>
	{:else if categoryStore.error}
		<div class="error">{categoryStore.error}</div>
	{:else}
		<select
			id="category-select"
			value={selectedCategoryId}
			onchange={handleChange}
		>
			<option value="">None</option>
			{#each filteredCategories as category (category.id)}
				<option value={category.id}>
					{category.name}
				</option>
			{/each}
			<option value="__create_new__" class="create-new">+ Create New Category</option>
		</select>
	{/if}
</div>

<style>
	.category-selector {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin-bottom: var(--space-4);
	}

	label {
		font-weight: var(--font-weight-medium);
		font-size: var(--text-sm);
		color: var(--color-text-primary);
	}

	select {
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--color-border-primary);
		border-radius: var(--radius-md);
		font-size: var(--text-base);
		font-family: var(--font-body);
		background-color: var(--color-bg-primary);
		color: var(--color-text-primary);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	select:hover {
		border-color: var(--color-border-secondary);
	}

	select:focus {
		outline: none;
		border-color: var(--color-border-focus);
		box-shadow: var(--shadow-focus);
	}

	.loading,
	.error {
		padding: var(--space-3);
		border-radius: var(--radius-md);
		font-size: var(--text-sm);
	}

	.loading {
		background-color: var(--color-bg-secondary);
		color: var(--color-text-tertiary);
	}

	.error {
		background-color: var(--color-error-100);
		color: var(--color-error-700);
	}
</style>
