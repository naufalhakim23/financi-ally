<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';
	import type { Transaction, TransactionListResponse } from '$lib/domain/Transaction';

	// Props
	let { onSearch = () => {} }: { onSearch?: (results: Transaction[]) => void } = $props();

	// State
	let searchQuery = $state('');
	let isSearching = $state(false);
	let debounceTimer: number | null = $state(null);

	// Debounced search function (300ms delay as per FR-07 requirement)
	function handleSearchInput() {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}

		// If search query is empty, trigger immediate search (clear results)
		if (searchQuery.trim() === '') {
			performSearch();
			return;
		}

		// Debounce search for 300ms
		debounceTimer = setTimeout(() => {
			performSearch();
		}, 300) as unknown as number;
	}

	// Perform the search
	async function performSearch() {
		if (searchQuery.trim() === '') {
			onSearch([]);
			return;
		}

		isSearching = true;

		try {
			const response = (await invoke('search_transactions', {
				request: {
					query: searchQuery.trim()
				}
			})) as TransactionListResponse;

			if (response.success) {
				onSearch(response.data);
			}
		} catch (error) {
			console.error('Search error:', error);
		} finally {
			isSearching = false;
		}
	}

	// Clear search
	function clearSearch() {
		searchQuery = '';
		onSearch([]);
	}
</script>

<div class="search-bar">
	<div class="search-input-wrapper">
		<span class="search-icon">🔍</span>
		<input
			type="text"
			placeholder="Search transactions..."
			bind:value={searchQuery}
			oninput={handleSearchInput}
			class="search-input"
		/>
		{#if searchQuery}
			<button class="clear-button" onclick={clearSearch} type="button"> ✕ </button>
		{/if}
		{#if isSearching}
			<span class="spinner">⏳</span>
		{/if}
	</div>
</div>

<style>
	.search-bar {
		margin-bottom: var(--space-4);
	}

	.search-input-wrapper {
		position: relative;
		display: flex;
		align-items: center;
		background: var(--color-bg-primary);
		border: 1px solid var(--color-border-primary);
		border-radius: var(--radius-md);
		padding: var(--space-2) var(--space-4);
		transition: all var(--transition-fast);
	}

	.search-input-wrapper:focus-within {
		border-color: var(--color-border-focus);
		box-shadow: var(--shadow-focus);
	}

	.search-icon {
		font-size: var(--text-lg);
		margin-right: var(--space-2);
		opacity: 0.5;
		color: var(--color-text-tertiary);
	}

	.search-input {
		flex: 1;
		border: none;
		outline: none;
		font-size: var(--text-base);
		font-family: var(--font-body);
		background: transparent;
		color: var(--color-text-primary);
	}

	.search-input::placeholder {
		color: var(--color-text-tertiary);
	}

	.clear-button {
		background: none;
		border: none;
		font-size: var(--text-xl);
		cursor: pointer;
		opacity: 0.4;
		transition: opacity var(--transition-fast);
		padding: var(--space-1);
		margin-left: var(--space-2);
		color: var(--color-text-secondary);
	}

	.clear-button:hover {
		opacity: 0.8;
	}

	.spinner {
		font-size: var(--text-base);
		margin-left: var(--space-2);
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>
