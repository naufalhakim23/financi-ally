/**
 * Transaction Service
 *
 * This is the APPLICATION SERVICE layer that orchestrates transaction operations.
 * It provides a higher-level API than the raw Tauri adapter and handles:
 * - Business logic validation
 * - Error handling and transformation
 * - Coordination between infrastructure and presentation layers
 *
 * This service is used by Svelte stores and components.
 */

import { tauriCommandAdapter } from '$lib/infrastructure/TauriCommandAdapter';
import type {
	Transaction,
	CreateTransactionRequest,
	GetTransactionRequest,
	ListTransactionsRequest,
	SearchTransactionsRequest,
	isErrorResponse
} from '$lib/domain/Transaction';
import { isErrorResponse as checkIsError } from '$lib/domain/Transaction';

/**
 * Result type for service operations
 */
export type ServiceResult<T> =
	| { success: true; data: T }
	| { success: false; error: string; errorType: string };

/**
 * Transaction service providing high-level transaction operations
 */
export class TransactionService {
	/**
	 * Create a new transaction
	 *
	 * @param request - Transaction creation request
	 * @returns Service result with created transaction or error
	 */
	async createTransaction(request: CreateTransactionRequest): Promise<ServiceResult<Transaction>> {
		// Validate request
		const validation = this.validateCreateRequest(request);
		if (!validation.valid) {
			return {
				success: false,
				error: validation.error!,
				errorType: 'ValidationError'
			};
		}

		// Call Tauri backend
		const response = await tauriCommandAdapter.createTransaction(request);

		// Handle response
		if (checkIsError(response)) {
			return {
				success: false,
				error: response.error,
				errorType: response.errorType
			};
		}

		return {
			success: true,
			data: response.data
		};
	}

	/**
	 * Get a transaction by ID
	 *
	 * @param transactionId - Transaction ID to retrieve
	 * @returns Service result with transaction (or null if not found) or error
	 */
	async getTransaction(transactionId: string): Promise<ServiceResult<Transaction | null>> {
		const request: GetTransactionRequest = { transactionId };
		const response = await tauriCommandAdapter.getTransaction(request);

		if (checkIsError(response)) {
			return {
				success: false,
				error: response.error,
				errorType: response.errorType
			};
		}

		return {
			success: true,
			data: response.data
		};
	}

	/**
	 * List transactions with pagination
	 *
	 * @param offset - Offset for pagination (default: 0)
	 * @param limit - Limit/page size (default: 100, max: 1000)
	 * @returns Service result with array of transactions or error
	 */
	async listTransactions(
		offset: number = 0,
		limit: number = 100
	): Promise<ServiceResult<Transaction[]>> {
		const request: ListTransactionsRequest = { offset, limit };
		const response = await tauriCommandAdapter.listTransactions(request);

		if (checkIsError(response)) {
			return {
				success: false,
				error: response.error,
				errorType: response.errorType
			};
		}

		return {
			success: true,
			data: response.data
		};
	}

	/**
	 * Search transactions by keyword
	 *
	 * @param query - Search query string
	 * @returns Service result with array of matching transactions or error
	 */
	async searchTransactions(query: string): Promise<ServiceResult<Transaction[]>> {
		// Empty query returns empty results
		if (!query.trim()) {
			return {
				success: true,
				data: []
			};
		}

		const request: SearchTransactionsRequest = { query };
		const response = await tauriCommandAdapter.searchTransactions(request);

		if (checkIsError(response)) {
			return {
				success: false,
				error: response.error,
				errorType: response.errorType
			};
		}

		return {
			success: true,
			data: response.data
		};
	}

	/**
	 * Validate create transaction request
	 */
	private validateCreateRequest(
		request: CreateTransactionRequest
	): { valid: boolean; error?: string } {
		// Amount must be positive
		if (request.amountCents <= 0) {
			return { valid: false, error: 'Amount must be greater than 0' };
		}

		// Transaction type must be valid
		if (request.transactionType !== 'income' && request.transactionType !== 'expense') {
			return { valid: false, error: 'Transaction type must be "income" or "expense"' };
		}

		// Scope must be valid
		if (request.scope !== 'personal' && request.scope !== 'business') {
			return { valid: false, error: 'Scope must be "personal" or "business"' };
		}

		// Description length check (if provided)
		if (request.description && request.description.length > 500) {
			return { valid: false, error: 'Description must be 500 characters or less' };
		}

		// Category length check (if provided)
		if (request.category && request.category.length > 100) {
			return { valid: false, error: 'Category must be 100 characters or less' };
		}

		// Notes length check (if provided)
		if (request.notes && request.notes.length > 1000) {
			return { valid: false, error: 'Notes must be 1000 characters or less' };
		}

		return { valid: true };
	}
}

/**
 * Singleton instance of the transaction service
 *
 * Export a single instance to be used throughout the application
 */
export const transactionService = new TransactionService();
