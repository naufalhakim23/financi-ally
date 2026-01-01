/**
 * Tauri Command Adapter
 *
 * This is the INFRASTRUCTURE ADAPTER that connects our frontend application
 * to the Rust backend via Tauri's IPC mechanism.
 *
 * It provides type-safe wrappers around Tauri's invoke() function and handles
 * error transformation from the backend.
 */

import { invoke } from '@tauri-apps/api/core';
import type {
	CreateTransactionRequest,
	GetTransactionRequest,
	ListTransactionsRequest,
	SearchTransactionsRequest,
	TransactionResponse,
	OptionalTransactionResponse,
	TransactionListResponse,
	ApiResult
} from '$lib/domain/Transaction';
import type {
	CreatePocketRequest,
	UpdatePocketRequest,
	PocketResponse,
	PocketListResponse,
	SuccessResponse
} from '$lib/domain/Pocket';
import type {
	Category,
	CreateCategoryRequest,
	UpdateCategoryRequest,
	CategoryResponse,
	CategoryListResponse,
	CategoryTypeFilter
} from '$lib/domain/Category';

/**
 * Tauri command adapter for transaction operations
 *
 * This class wraps all Tauri command invocations and provides a clean,
 * type-safe interface for the application layer.
 */
export class TauriCommandAdapter {
	/**
	 * Create a new transaction
	 *
	 * @param request - Transaction creation request
	 * @returns Promise resolving to transaction response or error
	 */
	async createTransaction(
		request: CreateTransactionRequest
	): Promise<ApiResult<TransactionResponse>> {
		try {
			const response = await invoke<TransactionResponse>('create_transaction', { request });
			return response;
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Get a transaction by ID
	 *
	 * @param request - Get transaction request
	 * @returns Promise resolving to optional transaction response or error
	 */
	async getTransaction(
		request: GetTransactionRequest
	): Promise<ApiResult<OptionalTransactionResponse>> {
		try {
			const response = await invoke<OptionalTransactionResponse>('get_transaction', {
				request
			});
			return response;
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * List transactions with pagination
	 *
	 * @param request - List transactions request with offset and limit
	 * @returns Promise resolving to transaction list response or error
	 */
	async listTransactions(
		request: ListTransactionsRequest = {}
	): Promise<ApiResult<TransactionListResponse>> {
		try {
			// Set defaults
			const requestWithDefaults = {
				offset: request.offset ?? 0,
				limit: request.limit ?? 100
			};

			const response = await invoke<TransactionListResponse>('list_transactions', {
				request: requestWithDefaults
			});
			return response;
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Search transactions by keyword
	 *
	 * @param request - Search transactions request
	 * @returns Promise resolving to transaction list response or error
	 */
	async searchTransactions(
		request: SearchTransactionsRequest
	): Promise<ApiResult<TransactionListResponse>> {
		try {
			const response = await invoke<TransactionListResponse>('search_transactions', {
				request
			});
			return response;
		} catch (error) {
			return this.handleError(error);
		}
	}

	// ============================================================================
	// Pocket Commands
	// ============================================================================

	/**
	 * Create a new pocket
	 *
	 * @param request - Pocket creation request
	 * @returns Promise resolving to pocket response or error
	 */
	async createPocket(request: CreatePocketRequest): Promise<ApiResult<PocketResponse>> {
		try {
			const response = await invoke<PocketResponse>('create_pocket', { request });
			return response;
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * List all pockets
	 *
	 * @returns Promise resolving to pocket list response or error
	 */
	async listPockets(): Promise<ApiResult<PocketListResponse>> {
		try {
			const response = await invoke<PocketListResponse>('list_pockets');
			return response;
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Get a pocket by ID
	 *
	 * @param pocketId - Pocket ID to retrieve
	 * @returns Promise resolving to pocket response or error
	 */
	async getPocket(pocketId: string): Promise<ApiResult<PocketResponse>> {
		try {
			const response = await invoke<PocketResponse>('get_pocket', { pocketId });
			return response;
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Update an existing pocket
	 *
	 * @param request - Pocket update request
	 * @returns Promise resolving to pocket response or error
	 */
	async updatePocket(request: UpdatePocketRequest): Promise<ApiResult<PocketResponse>> {
		try {
			const response = await invoke<PocketResponse>('update_pocket', { request });
			return response;
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Delete a pocket
	 *
	 * @param pocketId - Pocket ID to delete
	 * @returns Promise resolving to success response or error
	 */
	async deletePocket(pocketId: string): Promise<ApiResult<SuccessResponse>> {
		try {
			const response = await invoke<SuccessResponse>('delete_pocket', { pocketId });
			return response;
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Set a pocket as the default pocket
	 *
	 * @param pocketId - Pocket ID to set as default
	 * @returns Promise resolving to success response or error
	 */
	async setDefaultPocket(pocketId: string): Promise<ApiResult<SuccessResponse>> {
		try {
			const response = await invoke<SuccessResponse>('set_default_pocket', { pocketId });
			return response;
		} catch (error) {
			return this.handleError(error);
		}
	}

	// ============================================================================
	// Category Commands
	// ============================================================================

	/**
	 * Create a new category
	 *
	 * @param request - Category creation request
	 * @returns Promise resolving to category response or error
	 */
	async createCategory(request: CreateCategoryRequest): Promise<ApiResult<CategoryResponse>> {
		try {
			const response = await invoke<CategoryResponse>('create_category', { request });
			return response;
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * List all categories with optional filter
	 *
	 * @param filterType - Optional filter ('expense', 'income', or 'both')
	 * @returns Promise resolving to category list response or error
	 */
	async listCategories(filterType?: CategoryTypeFilter): Promise<ApiResult<CategoryListResponse>> {
		try {
			const request = filterType ? { filterType } : undefined;
			const response = await invoke<CategoryListResponse>('list_categories', { request });
			return response;
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Get a category by ID
	 *
	 * @param categoryId - Category ID to retrieve
	 * @returns Promise resolving to category response or error
	 */
	async getCategory(categoryId: string): Promise<ApiResult<CategoryResponse>> {
		try {
			const response = await invoke<CategoryResponse>('get_category', { categoryId });
			return response;
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Update an existing category
	 *
	 * @param request - Category update request
	 * @returns Promise resolving to category response or error
	 */
	async updateCategory(request: UpdateCategoryRequest): Promise<ApiResult<CategoryResponse>> {
		try {
			const response = await invoke<CategoryResponse>('update_category', { request });
			return response;
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Delete a category
	 *
	 * @param categoryId - Category ID to delete
	 * @returns Promise resolving to success response or error
	 */
	async deleteCategory(categoryId: string): Promise<ApiResult<SuccessResponse>> {
		try {
			const response = await invoke<SuccessResponse>('delete_category', { categoryId });
			return response;
		} catch (error) {
			return this.handleError(error);
		}
	}

	// ============================================================================
	// Error Handling
	// ============================================================================

	/**
	 * Handle errors from Tauri commands
	 *
	 * Tauri errors come as strings, we transform them into ErrorResponse format
	 */
	private handleError(error: unknown): {
		success: false;
		error: string;
		errorType: string;
	} {
		if (typeof error === 'string') {
			// Try to parse as JSON error response
			try {
				const parsed = JSON.parse(error);
				if (parsed.success === false && parsed.error) {
					return parsed;
				}
			} catch {
				// Not JSON, return as generic error
			}

			return {
				success: false,
				error: error,
				errorType: 'TauriError'
			};
		}

		// Unknown error type
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error occurred',
			errorType: 'UnknownError'
		};
	}
}

/**
 * Singleton instance of the Tauri command adapter
 *
 * Export a single instance to be used throughout the application
 */
export const tauriCommandAdapter = new TauriCommandAdapter();
