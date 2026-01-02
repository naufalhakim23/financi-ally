<script lang="ts">
	import Input from './ui/Input.svelte';
	import Select from './ui/Select.svelte';
	import Button from './ui/Button.svelte';

	// Props
	let {
		filterType = $bindable(),
		filterScope = $bindable(),
		filterCategory = $bindable(),
		filterPaymentMethod = $bindable(),
		filterDateFrom = $bindable(),
		filterDateTo = $bindable(),
		onFilterChange = () => {}
	}: {
		filterType?: string;
		filterScope?: string;
		filterCategory?: string;
		filterPaymentMethod?: string;
		filterDateFrom?: string;
		filterDateTo?: string;
		onFilterChange?: () => void;
	} = $props();

	// State
	let isExpanded = $state(false);

	// Check if any filters are active
	let hasActiveFilters = $derived(
		!!filterType || !!filterScope || !!filterCategory || !!filterPaymentMethod || !!filterDateFrom || !!filterDateTo
	);

	// Toggle panel
	function togglePanel() {
		isExpanded = !isExpanded;
	}

	// Clear all filters
	function clearFilters() {
		filterType = undefined;
		filterScope = undefined;
		filterCategory = undefined;
		filterPaymentMethod = undefined;
		filterDateFrom = undefined;
		filterDateTo = undefined;
		onFilterChange();
	}

	// Handle filter changes
	function handleFilterChange() {
		onFilterChange();
	}

	// Options for select dropdowns
	const TYPE_OPTIONS = [
		{ value: '', label: 'All' },
		{ value: 'income', label: 'Income' },
		{ value: 'expense', label: 'Expense' }
	];

	const SCOPE_OPTIONS = [
		{ value: '', label: 'All' },
		{ value: 'personal', label: 'Personal' },
		{ value: 'business', label: 'Business' }
	];
</script>

<div class="filter-panel">
	<div class="filter-header">
		<button class="toggle-button" onclick={togglePanel} type="button">
			<span class="filter-icon">🔧</span>
			<span class="filter-text">Filters</span>
			{#if hasActiveFilters}
				<span class="active-badge">●</span>
			{/if}
			<span class="arrow">{isExpanded ? '▲' : '▼'}</span>
		</button>
		{#if hasActiveFilters}
			<Button variant="danger" size="sm" onclick={clearFilters}>Clear All</Button>
		{/if}
	</div>

	{#if isExpanded}
		<div class="filter-content">
			<div class="filter-grid">
				<!-- Transaction Type Filter -->
				<Select
					label="Type"
					bind:value={filterType}
					options={TYPE_OPTIONS}
					onchange={handleFilterChange}
				/>

				<!-- Scope Filter -->
				<Select
					label="Scope"
					bind:value={filterScope}
					options={SCOPE_OPTIONS}
					onchange={handleFilterChange}
				/>

				<!-- Category Filter -->
				<Input
					type="text"
					label="Category"
					bind:value={filterCategory}
					placeholder="e.g., Food, Transport"
					oninput={handleFilterChange}
				/>

				<!-- Payment Method Filter -->
				<Input
					type="text"
					label="Payment Method"
					bind:value={filterPaymentMethod}
					placeholder="e.g., Cash, Credit Card"
					oninput={handleFilterChange}
				/>

				<!-- Date From Filter -->
				<Input
					type="date"
					label="Date From"
					bind:value={filterDateFrom}
					onchange={handleFilterChange}
				/>

				<!-- Date To Filter -->
				<Input
					type="date"
					label="Date To"
					bind:value={filterDateTo}
					onchange={handleFilterChange}
				/>
			</div>
		</div>
	{/if}
</div>

<style>
	.filter-panel {
		margin-bottom: var(--space-4);
		background: var(--color-bg-primary);
		border: 1px solid var(--color-border-primary);
		border-radius: var(--radius-lg);
		overflow: hidden;
	}

	.filter-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--space-3) var(--space-4);
		background: var(--color-bg-secondary);
	}

	.toggle-button {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		background: none;
		border: none;
		font-size: var(--text-base);
		font-family: var(--font-body);
		cursor: pointer;
		padding: var(--space-1);
		color: var(--color-text-primary);
		transition: opacity var(--transition-fast);
	}

	.toggle-button:hover {
		opacity: 0.8;
	}

	.filter-icon {
		font-size: var(--text-lg);
	}

	.filter-text {
		font-weight: var(--font-weight-semibold);
		color: var(--color-text-primary);
	}

	.active-badge {
		color: var(--color-primary-500);
		font-size: var(--text-sm);
	}

	.arrow {
		font-size: var(--text-sm);
		opacity: 0.5;
		margin-left: var(--space-1);
	}

	.filter-content {
		padding: var(--space-4);
		border-top: 1px solid var(--color-border-primary);
		animation: slideDown 0.2s ease-out;
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

	.filter-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: var(--space-4);
	}
</style>
