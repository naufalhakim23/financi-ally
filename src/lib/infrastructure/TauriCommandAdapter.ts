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
