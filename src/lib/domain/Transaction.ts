/**
 * Domain interfaces for transactions
 *
 * These TypeScript interfaces mirror the Rust DTOs and represent the
 * data structures that cross the IPC boundary from Rust to TypeScript.
 */

/**
 * Entry metadata containing optional fields
 */
export interface EntryMetadata {
	category?: string;
	payment_method?: string;
	notes?: string;
	receiptBase64?: string;
}

/**
 * A single ledger entry (income or expense)
 */
export interface LedgerEntry {
	/** Entry ID (UUID v7) */
	id: string;

	/** Transaction ID this entry belongs to */
	transaction_id: string;

	/** Amount in cents (positive value) */
	amount_cents: number;

	/** Entry type: "income" or "expense" */
	type: 'income' | 'expense';

	/** Whether this is a correction entry */
	is_correction: boolean;

	/** Parent entry ID if this is a correction */
	parent_entry_id?: string;

	/** Entry metadata */
	metadata: EntryMetadata;

	/** When the entry was created (ISO 8601) */
	created_at: string;
}

/**
 * A transaction containing one or more ledger entries
 */
export interface Transaction {
	/** Transaction ID (UUID v7) */
	id: string;

	/** Optional description */
	description?: string;

	/** When the transaction occurred (ISO 8601) */
	occurred_at: string;

	/** Scope: "personal" or "business" */
	scope: 'personal' | 'business';

	/** Status: "active", "corrected", or "voided" */
	status: 'active' | 'corrected' | 'voided';

	/** When the transaction was created (ISO 8601) */
	created_at: string;

	/** List of ledger entries */
	entries: LedgerEntry[];

	/**
	 * Total amount in cents (computed from entries)
	 * Positive for net income, negative for net expense
	 */
	total_amount_cents: number;
}

/**
 * Request to create a new transaction
 */
export interface CreateTransactionRequest {
	/** Amount in cents (positive value) */
	amount_cents: number;

	/** Type: "income" or "expense" */
	transaction_type: 'income' | 'expense';

	/** Scope: "personal" or "business" */
	scope: 'personal' | 'business';

	/** Optional description */
	description?: string;

	/** Optional category */
	category?: string;

	/** Optional payment method */
	payment_method?: string;

	/** Optional notes */
	notes?: string;

	/** Optional receipt as Base64 */
	receipt_base64?: string;

	/** When the transaction occurred (ISO 8601), defaults to now if not provided */
	occurred_at?: string;
}

/**
 * Request to get a transaction by ID
 */
export interface GetTransactionRequest {
	transaction_id: string;
}

/**
 * Request to list transactions with pagination
 */
export interface ListTransactionsRequest {
	/** Offset for pagination (default: 0) */
	offset?: number;

	/** Limit/page size (default: 100, max: 1000) */
	limit?: number;
}

/**
 * Request to search transactions
 */
export interface SearchTransactionsRequest {
	/** Search query string */
	query: string;
}

/**
 * Standard API response wrapper for a single transaction
 */
export interface TransactionResponse {
	success: boolean;
	data: Transaction;
}

/**
 * API response for optional transaction (get by ID)
 */
export interface OptionalTransactionResponse {
	success: boolean;
	data: Transaction | null;
}

/**
 * API response for list of transactions
 */
export interface TransactionListResponse {
	success: boolean;
	data: Transaction[];
	count: number;
}

/**
 * Standard error response
 */
export interface ErrorResponse {
	success: false;
	error: string;
	errorType: string;
}

/**
 * Utility type for API responses (success or error)
 */
export type ApiResult<T> = T | ErrorResponse;

/**
 * Type guard to check if response is an error
 */
export function isErrorResponse(response: unknown): response is ErrorResponse {
	return (
		typeof response === 'object' &&
		response !== null &&
		'success' in response &&
		response.success === false &&
		'error' in response
	);
}

/**
 * Helper to format amount in cents to currency string
 */
export function formatAmount(amountCents: number, currency: string = 'USD'): string {
	const dollars = Math.abs(amountCents) / 100;
	const formatted = new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency
	}).format(dollars);

	return amountCents < 0 ? `-${formatted}` : formatted;
}

/**
 * Helper to convert dollars to cents
 */
export function dollarsToCents(dollars: number): number {
	return Math.round(dollars * 100);
}

/**
 * Helper to format ISO timestamp to readable date
 */
export function formatDate(isoString: string): string {
	return new Date(isoString).toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric'
	});
}

/**
 * Helper to format ISO timestamp to readable date and time
 */
export function formatDateTime(isoString: string): string {
	return new Date(isoString).toLocaleString('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}
