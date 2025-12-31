/**
 * Transaction Store (Svelte 5 Runes)
 *
 * This store manages the application state for transactions using Svelte 5's
 * new Runes system ($state, $derived) for reactive state management.
 *
 * Benefits of Runes over traditional stores:
 * - Fine-grained reactivity
 * - Better TypeScript integration
 * - Simpler mental model (just reactive variables)
 * - Built-in to Svelte 5, no external library needed
 */

import { transactionService, type ServiceResult } from '$lib/application/services/TransactionService';
import type { Transaction, CreateTransactionRequest } from '$lib/domain/Transaction';

/**
 * Store state
 */
class TransactionStore {
	/** List of transactions */
	transactions = $state<Transaction[]>([]);

	/** Loading state */
	isLoading = $state(false);

	/** Error state */
	error = $state<string | null>(null);

	/** Search query */
	searchQuery = $state('');

	/** Current pagination offset */
	offset = $state(0);

	/** Pagination limit */
	limit = $state(100);

	/** Whether there are more transactions to load */
	hasMore = $state(true);

	/**
	 * Derived: filtered transactions based on search query
	 * If search query is empty, return all transactions
	 */
	filteredTransactions = $derived(
		this.searchQuery.trim()
			? this.transactions.filter((tx) => this.matchesSearch(tx, this.searchQuery))
			: this.transactions
	);

	/**
	 * Derived: total count of filtered transactions
	 */
	totalCount = $derived(this.filteredTransactions.length);

	/**
	 * Create a new transaction
	 */
	async createTransaction(request: CreateTransactionRequest): Promise<ServiceResult<Transaction>> {
		this.isLoading = true;
		this.error = null;

		const result = await transactionService.createTransaction(request);

		if (result.success) {
			// Add to beginning of list (most recent first)
			this.transactions = [result.data, ...this.transactions];
		} else {
			this.error = result.error;
		}

		this.isLoading = false;
		return result;
	}

	/**
	 * Load transactions (initial load or pagination)
	 */
	async loadTransactions(append: boolean = false): Promise<void> {
		this.isLoading = true;
		this.error = null;

		const result = await transactionService.listTransactions(this.offset, this.limit);

		if (result.success) {
			if (append) {
				this.transactions = [...this.transactions, ...result.data];
			} else {
				this.transactions = result.data;
			}

			// Update hasMore based on results
			this.hasMore = result.data.length === this.limit;

			// Update offset for next load
			if (append) {
				this.offset += result.data.length;
			}
		} else {
			this.error = result.error;
		}

		this.isLoading = false;
	}

	/**
	 * Load more transactions (pagination)
	 */
	async loadMore(): Promise<void> {
		if (!this.hasMore || this.isLoading) return;
		await this.loadTransactions(true);
	}

	/**
	 * Search transactions
	 */
	async search(query: string): Promise<void> {
		this.searchQuery = query;

		// If query is empty, show all loaded transactions
		if (!query.trim()) {
			return;
		}

		this.isLoading = true;
		this.error = null;

		const result = await transactionService.searchTransactions(query);

		if (result.success) {
			this.transactions = result.data;
			this.hasMore = false; // Search results don't paginate
		} else {
			this.error = result.error;
		}

		this.isLoading = false;
	}

	/**
	 * Clear search and reload
	 */
	async clearSearch(): Promise<void> {
		this.searchQuery = '';
		this.offset = 0;
		this.hasMore = true;
		await this.loadTransactions(false);
	}

	/**
	 * Refresh transactions (reload from beginning)
	 */
	async refresh(): Promise<void> {
		this.offset = 0;
		this.hasMore = true;
		await this.loadTransactions(false);
	}

	/**
	 * Get a single transaction by ID
	 */
	async getTransaction(id: string): Promise<Transaction | null> {
		// First check if we already have it in local state
		const local = this.transactions.find((tx) => tx.id === id);
		if (local) return local;

		// Otherwise fetch from backend
		const result = await transactionService.getTransaction(id);
		return result.success ? result.data : null;
	}

	/**
	 * Clear error state
	 */
	clearError(): void {
		this.error = null;
	}

	/**
	 * Helper: Check if transaction matches search query
	 */
	private matchesSearch(tx: Transaction, query: string): boolean {
		const lowerQuery = query.toLowerCase();

		// Search in description
		if (tx.description?.toLowerCase().includes(lowerQuery)) return true;

		// Search in entries metadata
		return tx.entries.some((entry) => {
			const meta = entry.metadata;
			return (
				meta.category?.toLowerCase().includes(lowerQuery) ||
				meta.payment_method?.toLowerCase().includes(lowerQuery) ||
				meta.notes?.toLowerCase().includes(lowerQuery)
			);
		});
	}
}

/**
 * Create and export the transaction store instance
 *
 * In Svelte 5, we create a class instance with $state runes.
 * This instance is shared across the entire application.
 */
export const transactionStore = new TransactionStore();
