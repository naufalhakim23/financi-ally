/**
 * Category Service
 *
 * Application service for category operations.
 * Acts as a facade over the infrastructure layer (TauriCommandAdapter).
 */

import { tauriCommandAdapter } from '$lib/infrastructure/TauriCommandAdapter';
import type {
	Category,
	CreateCategoryRequest,
	UpdateCategoryRequest,
	CategoryResponse,
	CategoryListResponse,
	CategoryTypeFilter
} from '$lib/domain/Category';
import { isErrorResponse } from '$lib/domain/Pocket';

/**
 * Standard service result type
 */
export interface ServiceResult<T> {
	success: boolean;
	data?: T;
	error?: string;
}

/**
 * Category service class
 *
 * Provides business logic layer between UI components and infrastructure.
 */
class CategoryService {
	/**
	 * Create a new category
	 *
	 * @param request - Category creation request
	 * @returns Service result with created category or error
	 */
	async createCategory(request: CreateCategoryRequest): Promise<ServiceResult<Category>> {
		try {
			const response = await tauriCommandAdapter.createCategory(request);

			if (isErrorResponse(response)) {
				return {
					success: false,
					error: response.error
				};
			}

			return {
				success: true,
				data: response.data
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error occurred'
			};
		}
	}

	/**
	 * List categories with optional filter
	 *
	 * @param filterType - Optional filter ('expense', 'income', or 'both')
	 * @returns Service result with array of categories or error
	 */
	async listCategories(filterType?: CategoryTypeFilter): Promise<ServiceResult<Category[]>> {
		try {
			const response = await tauriCommandAdapter.listCategories(filterType);

			if (isErrorResponse(response)) {
				return {
					success: false,
					error: response.error
				};
			}

			return {
				success: true,
				data: response.data
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error occurred'
			};
		}
	}

	/**
	 * Get a specific category by ID
	 *
	 * @param categoryId - Category ID to retrieve
	 * @returns Service result with category or error
	 */
	async getCategory(categoryId: string): Promise<ServiceResult<Category>> {
		try {
			const response = await tauriCommandAdapter.getCategory(categoryId);

			if (isErrorResponse(response)) {
				return {
					success: false,
					error: response.error
				};
			}

			return {
				success: true,
				data: response.data
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error occurred'
			};
		}
	}

	/**
	 * Update an existing category
	 *
	 * @param request - Category update request
	 * @returns Service result with updated category or error
	 */
	async updateCategory(request: UpdateCategoryRequest): Promise<ServiceResult<Category>> {
		try {
			const response = await tauriCommandAdapter.updateCategory(request);

			if (isErrorResponse(response)) {
				return {
					success: false,
					error: response.error
				};
			}

			return {
				success: true,
				data: response.data
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error occurred'
			};
		}
	}

	/**
	 * Delete a category
	 *
	 * @param categoryId - Category ID to delete
	 * @returns Service result with success or error
	 */
	async deleteCategory(categoryId: string): Promise<ServiceResult<void>> {
		try {
			const response = await tauriCommandAdapter.deleteCategory(categoryId);

			if (isErrorResponse(response)) {
				return {
					success: false,
					error: response.error
				};
			}

			return {
				success: true
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error occurred'
			};
		}
	}
}

/**
 * Singleton instance of category service
 */
export const categoryService = new CategoryService();
