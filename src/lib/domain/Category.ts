/**
 * Domain interfaces for categories
 *
 * These TypeScript interfaces mirror the Rust DTOs and represent
 * the data structures for categorizing transactions.
 */

/**
 * A category for organizing transactions
 */
export interface Category {
	/** Category ID (UUID v7) */
	id: string;

	/** Category name (required) */
	name: string;

	/** Category code (unique identifier, snake_case) */
	code: string;

	/** Optional description */
	description?: string;

	/** Color hex code for UI display */
	color: string;

	/** Whether this category can be used for expense transactions */
	is_expense: boolean;

	/** Whether this category can be used for income transactions */
	is_income: boolean;

	/** When the category was created (ISO 8601) */
	created_at: string;

	/** When the category was last updated (ISO 8601) */
	updated_at?: string;
}

/**
 * Request to create a new category
 */
export interface CreateCategoryRequest {
	/** Category name (required) */
	name: string;

	/** Category code (unique, snake_case) */
	code: string;

	/** Optional description */
	description?: string;

	/** Color hex code */
	color: string;

	/** Can be used for expenses */
	isExpense: boolean;

	/** Can be used for income */
	isIncome: boolean;
}

/**
 * Request to update an existing category
 */
export interface UpdateCategoryRequest {
	/** Category ID to update */
	categoryId: string;

	/** New name (optional) */
	name?: string;

	/** New description (optional, use null to clear) */
	description?: string | null;

	/** New color (optional) */
	color?: string;

	// Note: code, isExpense, and isIncome are immutable after creation
}

/**
 * Standard API response wrapper for a single category
 */
export interface CategoryResponse {
	success: boolean;
	data: Category;
}

/**
 * API response for list of categories
 */
export interface CategoryListResponse {
	success: boolean;
	data: Category[];
	count: number;
}

/**
 * Filter type for listing categories
 */
export type CategoryTypeFilter = 'expense' | 'income' | 'both';

/**
 * Helper to get category type label
 */
export function getCategoryTypeLabel(category: Category): string {
	if (category.is_expense && category.is_income) {
		return 'Both';
	} else if (category.is_expense) {
		return 'Expense';
	} else if (category.is_income) {
		return 'Income';
	}
	return 'None';
}

/**
 * Helper to check if category matches filter
 */
export function matchesCategoryFilter(
	category: Category,
	filter: CategoryTypeFilter
): boolean {
	switch (filter) {
		case 'expense':
			return category.is_expense;
		case 'income':
			return category.is_income;
		case 'both':
			return category.is_expense && category.is_income;
		default:
			return true;
	}
}

/**
 * Validate category name
 */
export function validateCategoryName(name: string): { valid: boolean; error?: string } {
	if (!name || name.trim().length === 0) {
		return { valid: false, error: 'Category name is required' };
	}
	if (name.length > 50) {
		return { valid: false, error: 'Category name must be 50 characters or less' };
	}
	return { valid: true };
}

/**
 * Validate category code
 */
export function validateCategoryCode(code: string): { valid: boolean; error?: string } {
	if (!code || code.trim().length === 0) {
		return { valid: false, error: 'Category code is required' };
	}
	// Code should be snake_case
	const snakeCaseRegex = /^[a-z][a-z0-9_]*$/;
	if (!snakeCaseRegex.test(code)) {
		return {
			valid: false,
			error: 'Category code must be lowercase snake_case (e.g., food_dining)'
		};
	}
	if (code.length > 50) {
		return { valid: false, error: 'Category code must be 50 characters or less' };
	}
	return { valid: true };
}

/**
 * Validate category color
 */
export function validateCategoryColor(color: string): { valid: boolean; error?: string } {
	const hexRegex = /^#[0-9A-Fa-f]{6}$/;
	if (!hexRegex.test(color)) {
		return { valid: false, error: 'Color must be a valid hex code (e.g., #FF6B6B)' };
	}
	return { valid: true };
}

/**
 * Validate category type selection
 */
export function validateCategoryType(
	isExpense: boolean,
	isIncome: boolean
): { valid: boolean; error?: string } {
	if (!isExpense && !isIncome) {
		return {
			valid: false,
			error: 'Category must be marked as expense, income, or both'
		};
	}
	return { valid: true };
}

/**
 * Helper to generate category code from name
 */
export function generateCategoryCode(name: string): string {
	return name
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9\s]/g, '') // Remove special characters
		.replace(/\s+/g, '_'); // Replace spaces with underscores
}

/**
 * Helper to get default color for new categories
 */
export function getDefaultCategoryColor(): string {
	return '#4299E1'; // Nice blue color
}

/**
 * Predefined category colors for quick selection
 */
export const CATEGORY_COLORS = [
	'#FF6B6B', // Red
	'#4ECDC4', // Teal
	'#45B7D1', // Blue
	'#FFA07A', // Orange
	'#96CEB4', // Green
	'#FF69B4', // Pink
	'#9370DB', // Purple
	'#FFD700', // Gold
	'#FF1493', // Deep Pink
	'#4169E1', // Royal Blue
	'#DA70D6', // Orchid
	'#32CD32', // Lime Green
	'#1E90FF', // Dodger Blue
	'#8A2BE2', // Blue Violet
	'#20B2AA', // Light Sea Green
	'#DEB887', // Burlywood
	'#CD853F', // Peru
	'#B22222', // Fire Brick
	'#808080', // Gray
	'#28A745', // Success Green
	'#17A2B8', // Info Blue
	'#FFC107', // Warning Yellow
	'#6C757D', // Secondary Gray
	'#20C997', // Teal Green
	'#E83E8C', // Magenta
	'#6610F2' // Indigo
];
