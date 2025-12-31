/**
 * Domain interfaces for pockets
 *
 * These TypeScript interfaces mirror the Rust DTOs and represent
 * the data structures for organizing transactions into wallets/pockets.
 */

/**
 * A pocket (wallet) for organizing transactions
 */
export interface Pocket {
	/** Pocket ID (UUID v7) */
	id: string;

	/** Pocket name (unique, required) */
	name: string;

	/** Currency code (USD, EUR, IDR) */
	currency: string;

	/** Optional description */
	description?: string;

	/** Optional icon (emoji) */
	icon?: string;

	/** Color hex code */
	color: string;

	/** Initial balance in cents (immutable) */
	initialBalanceCents: number;

	/** Current balance in cents (computed) */
	currentBalanceCents: number;

	/** Whether this is the default pocket */
	isDefault: boolean;

	/** When the pocket was created (ISO 8601) */
	createdAt: string;

	/** When the pocket was last updated (ISO 8601) */
	updatedAt?: string;
}

/**
 * Request to create a new pocket
 */
export interface CreatePocketRequest {
	/** Pocket name (unique, required) */
	name: string;

	/** Currency code (USD, EUR, IDR) */
	currency: string;

	/** Optional description */
	description?: string;

	/** Optional icon (emoji) */
	icon?: string;

	/** Color hex code */
	color: string;

	/** Initial balance in cents */
	initialBalanceCents: number;
}

/**
 * Request to update an existing pocket
 */
export interface UpdatePocketRequest {
	/** Pocket ID to update */
	pocketId: string;

	/** New name (optional) */
	name?: string;

	/** New description (optional, use null to clear) */
	description?: string | null;

	/** New icon (optional, use null to clear) */
	icon?: string | null;

	/** New color (optional) */
	color?: string;
}

/**
 * Standard API response wrapper for a single pocket
 */
export interface PocketResponse {
	success: boolean;
	data: Pocket;
}

/**
 * API response for list of pockets
 */
export interface PocketListResponse {
	success: boolean;
	data: Pocket[];
	count: number;
}

/**
 * Generic success response
 */
export interface SuccessResponse {
	success: boolean;
	message: string;
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
 * Helper to format pocket balance with currency symbol
 */
export function formatPocketBalance(pocket: Pocket): string {
	const amount = Math.abs(pocket.currentBalanceCents) / 100;
	const currencySymbol = getCurrencySymbol(pocket.currency);
	const formatted = new Intl.NumberFormat('en-US', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	}).format(amount);

	const sign = pocket.currentBalanceCents < 0 ? '-' : '';
	return `${sign}${currencySymbol}${formatted}`;
}

/**
 * Get currency symbol from currency code
 */
export function getCurrencySymbol(currency: string): string {
	switch (currency.toUpperCase()) {
		case 'USD':
			return '$';
		case 'EUR':
			return '€';
		case 'IDR':
			return 'Rp';
		default:
			return currency;
	}
}

/**
 * Helper to format amount in cents to currency string for a specific pocket
 */
export function formatAmountForPocket(amountCents: number, pocket: Pocket): string {
	const amount = Math.abs(amountCents) / 100;
	const currencySymbol = getCurrencySymbol(pocket.currency);
	const formatted = new Intl.NumberFormat('en-US', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	}).format(amount);

	const sign = amountCents < 0 ? '-' : '';
	return `${sign}${currencySymbol}${formatted}`;
}

/**
 * Helper to get default color for new pockets
 */
export function getDefaultPocketColor(): string {
	return '#4299E1'; // Nice blue color
}

/**
 * Validate pocket name
 */
export function validatePocketName(name: string): { valid: boolean; error?: string } {
	if (!name || name.trim().length === 0) {
		return { valid: false, error: 'Pocket name is required' };
	}
	if (name.length > 50) {
		return { valid: false, error: 'Pocket name must be 50 characters or less' };
	}
	return { valid: true };
}

/**
 * Validate currency code
 */
export function validateCurrency(currency: string): { valid: boolean; error?: string } {
	const validCurrencies = ['USD', 'EUR', 'IDR'];
	if (!validCurrencies.includes(currency.toUpperCase())) {
		return {
			valid: false,
			error: `Currency must be one of: ${validCurrencies.join(', ')}`
		};
	}
	return { valid: true };
}

/**
 * Validate color hex code
 */
export function validateColorHex(color: string): { valid: boolean; error?: string } {
	const hexRegex = /^#[0-9A-Fa-f]{6}$/;
	if (!hexRegex.test(color)) {
		return { valid: false, error: 'Color must be a valid hex code (e.g., #4299E1)' };
	}
	return { valid: true };
}
