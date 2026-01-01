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
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	label {
		font-weight: 500;
		font-size: 0.875rem;
		color: #374151;
	}

	select {
		padding: 0.5rem;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		font-size: 1rem;
		background-color: white;
		cursor: pointer;
		transition: border-color 0.2s;
	}

	select:hover {
		border-color: #9ca3af;
	}

	select:focus {
		outline: none;
		border-color: #4299e1;
		box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
	}

	.loading,
	.error {
		padding: 0.5rem;
		border-radius: 0.375rem;
		font-size: 0.875rem;
	}

	.loading {
		background-color: #f3f4f6;
		color: #6b7280;
	}

	.error {
		background-color: #fee2e2;
		color: #dc2626;
	}

	/* Note: Can't style option elements with color indicators in most browsers */
	/* Color will be visible in a custom dropdown implementation if needed */
</style>
