/**
 * Category Store
 *
 * Svelte 5 runes-based state management for categories.
 * Manages category list, loading state, and provides reactive access to filtered categories.
 */

import { categoryService } from '../services/CategoryService';
import type {
	Category,
	CreateCategoryRequest,
	UpdateCategoryRequest
} from '$lib/domain/Category';
import type { ServiceResult } from '../services/CategoryService';

/**
 * Category store class using Svelte 5 runes
 *
 * Provides reactive state management for categories with:
 * - Reactive category list
 * - Loading and error states
 * - Derived filtered lists (expense/income)
 * - CRUD operations
 */
class CategoryStore {
	/** Reactive list of all categories */
	categories = $state<Category[]>([]);

	/** Loading state for async operations */
	isLoading = $state(false);

	/** Error message from last operation */
	error = $state<string | null>(null);

	/**
	 * Derived list of expense categories
	 * Returns categories where is_expense is true
	 */
	expenseCategories = $derived(
		this.categories.filter((c) => c.is_expense)
	);

	/**
	 * Derived list of income categories
	 * Returns categories where is_income is true
	 */
	incomeCategories = $derived(
		this.categories.filter((c) => c.is_income)
	);

	/**
	 * Load all categories from backend
	 *
	 * Sets loading state and updates category list.
	 * Clears previous errors on successful load.
	 */
	async loadCategories(): Promise<void> {
		this.isLoading = true;
		this.error = null;

		const result = await categoryService.listCategories();

		this.isLoading = false;

		if (result.success && result.data) {
			this.categories = result.data;
		} else {
			this.error = result.error || 'Failed to load categories';
		}
	}

	/**
	 * Create a new category
	 *
	 * @param request - Category creation request
	 * @returns Service result with created category or error
	 */
	async createCategory(request: CreateCategoryRequest): Promise<ServiceResult<Category>> {
		this.isLoading = true;
		this.error = null;

		const result = await categoryService.createCategory(request);

		this.isLoading = false;

		if (result.success && result.data) {
			// Add new category to the list
			this.categories = [...this.categories, result.data];
		} else {
			this.error = result.error || 'Failed to create category';
		}

		return result;
	}

	/**
	 * Update an existing category
	 *
	 * @param request - Category update request
	 * @returns Service result with updated category or error
	 */
	async updateCategory(request: UpdateCategoryRequest): Promise<ServiceResult<Category>> {
		this.isLoading = true;
		this.error = null;

		const result = await categoryService.updateCategory(request);

		this.isLoading = false;

		if (result.success && result.data) {
			// Update category in the list
			this.categories = this.categories.map((c) =>
				c.id === result.data!.id ? result.data! : c
			);
		} else {
			this.error = result.error || 'Failed to update category';
		}

		return result;
	}

	/**
	 * Delete a category
	 *
	 * Only succeeds if category is not in use by any transactions.
	 *
	 * @param categoryId - Category ID to delete
	 * @returns Service result with success or error
	 */
	async deleteCategory(categoryId: string): Promise<ServiceResult<void>> {
		this.isLoading = true;
		this.error = null;

		const result = await categoryService.deleteCategory(categoryId);

		this.isLoading = false;

		if (result.success) {
			// Remove category from the list
			this.categories = this.categories.filter((c) => c.id !== categoryId);
		} else {
			this.error = result.error || 'Failed to delete category';
		}

		return result;
	}

	/**
	 * Find a category by ID
	 *
	 * @param categoryId - Category ID to find
	 * @returns Category if found, undefined otherwise
	 */
	findById(categoryId: string): Category | undefined {
		return this.categories.find((c) => c.id === categoryId);
	}

	/**
	 * Find a category by code
	 *
	 * @param code - Category code to find
	 * @returns Category if found, undefined otherwise
	 */
	findByCode(code: string): Category | undefined {
		return this.categories.find((c) => c.code === code);
	}

	/**
	 * Get categories for a specific transaction type
	 *
	 * @param transactionType - 'income' or 'expense'
	 * @returns Filtered list of categories
	 */
	getCategoriesForType(transactionType: 'income' | 'expense'): Category[] {
		if (transactionType === 'income') {
			return this.incomeCategories;
		} else {
			return this.expenseCategories;
		}
	}

	/**
	 * Clear the current error message
	 */
	clearError(): void {
		this.error = null;
	}
}

/**
 * Singleton instance of category store
 *
 * Use this throughout the application for category state management.
 */
export const categoryStore = new CategoryStore();
