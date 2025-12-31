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
		margin-bottom: 1rem;
	}

	.search-input-wrapper {
		position: relative;
		display: flex;
		align-items: center;
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		padding: 0.5rem 1rem;
		transition: all 0.2s ease;
	}

	.search-input-wrapper:focus-within {
		border-color: #8b5cf6;
		box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
	}

	.search-icon {
		font-size: 1.1rem;
		margin-right: 0.5rem;
		opacity: 0.5;
	}

	.search-input {
		flex: 1;
		border: none;
		outline: none;
		font-size: 1rem;
		background: transparent;
	}

	.clear-button {
		background: none;
		border: none;
		font-size: 1.2rem;
		cursor: pointer;
		opacity: 0.4;
		transition: opacity 0.2s;
		padding: 0.25rem;
		margin-left: 0.5rem;
	}

	.clear-button:hover {
		opacity: 0.8;
	}

	.spinner {
		font-size: 1rem;
		margin-left: 0.5rem;
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
