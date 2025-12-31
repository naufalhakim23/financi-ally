<script lang="ts">
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
			<button class="clear-button" onclick={clearFilters} type="button"> Clear All </button>
		{/if}
	</div>

	{#if isExpanded}
		<div class="filter-content">
			<div class="filter-grid">
				<!-- Transaction Type Filter -->
				<div class="filter-item">
					<label for="filter-type">Type</label>
					<select id="filter-type" bind:value={filterType} onchange={handleFilterChange}>
						<option value="">All</option>
						<option value="income">Income</option>
						<option value="expense">Expense</option>
					</select>
				</div>

				<!-- Scope Filter -->
				<div class="filter-item">
					<label for="filter-scope">Scope</label>
					<select id="filter-scope" bind:value={filterScope} onchange={handleFilterChange}>
						<option value="">All</option>
						<option value="personal">Personal</option>
						<option value="business">Business</option>
					</select>
				</div>

				<!-- Category Filter -->
				<div class="filter-item">
					<label for="filter-category">Category</label>
					<input
						id="filter-category"
						type="text"
						placeholder="e.g., Food, Transport"
						bind:value={filterCategory}
						oninput={handleFilterChange}
					/>
				</div>

				<!-- Payment Method Filter -->
				<div class="filter-item">
					<label for="filter-payment">Payment Method</label>
					<input
						id="filter-payment"
						type="text"
						placeholder="e.g., Cash, Credit Card"
						bind:value={filterPaymentMethod}
						oninput={handleFilterChange}
					/>
				</div>

				<!-- Date From Filter -->
				<div class="filter-item">
					<label for="filter-date-from">Date From</label>
					<input
						id="filter-date-from"
						type="date"
						bind:value={filterDateFrom}
						onchange={handleFilterChange}
					/>
				</div>

				<!-- Date To Filter -->
				<div class="filter-item">
					<label for="filter-date-to">Date To</label>
					<input
						id="filter-date-to"
						type="date"
						bind:value={filterDateTo}
						onchange={handleFilterChange}
					/>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.filter-panel {
		margin-bottom: 1rem;
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		overflow: hidden;
	}

	.filter-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1rem;
		background: #f8fafc;
	}

	.toggle-button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: none;
		border: none;
		font-size: 1rem;
		cursor: pointer;
		padding: 0.25rem;
	}

	.filter-icon {
		font-size: 1.1rem;
	}

	.filter-text {
		font-weight: 600;
		color: #334155;
	}

	.active-badge {
		color: #8b5cf6;
		font-size: 0.8rem;
	}

	.arrow {
		font-size: 0.8rem;
		opacity: 0.5;
		margin-left: 0.25rem;
	}

	.clear-button {
		background: #fee2e2;
		border: 1px solid #fecaca;
		color: #dc2626;
		padding: 0.4rem 0.8rem;
		border-radius: 6px;
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.clear-button:hover {
		background: #fecaca;
	}

	.filter-content {
		padding: 1rem;
		border-top: 1px solid #e2e8f0;
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
		gap: 1rem;
	}

	.filter-item {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.filter-item label {
		font-size: 0.875rem;
		font-weight: 500;
		color: #64748b;
	}

	.filter-item select,
	.filter-item input {
		padding: 0.5rem;
		border: 1px solid #e2e8f0;
		border-radius: 6px;
		font-size: 0.875rem;
		background: white;
		transition: all 0.2s;
	}

	.filter-item select:focus,
	.filter-item input:focus {
		outline: none;
		border-color: #8b5cf6;
		box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
	}
</style>
