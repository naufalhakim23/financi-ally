/**
 * Pocket Service
 *
 * Application service for pocket operations.
 * Acts as a facade over the infrastructure layer (TauriCommandAdapter).
 */

import { tauriCommandAdapter } from '$lib/infrastructure/TauriCommandAdapter';
import type {
	Pocket,
	CreatePocketRequest,
	UpdatePocketRequest,
	PocketResponse,
	PocketListResponse,
	SuccessResponse
} from '$lib/domain/Pocket';
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
 * Pocket service class
 *
 * Provides business logic layer between UI components and infrastructure.
 */
class PocketService {
	/**
	 * Create a new pocket
	 *
	 * @param request - Pocket creation request
	 * @returns Service result with created pocket or error
	 */
	async createPocket(request: CreatePocketRequest): Promise<ServiceResult<Pocket>> {
		try {
			const response = await tauriCommandAdapter.createPocket(request);

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
	 * List all pockets
	 *
	 * @returns Service result with array of pockets or error
	 */
	async listPockets(): Promise<ServiceResult<Pocket[]>> {
		try {
			const response = await tauriCommandAdapter.listPockets();

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
	 * Get a specific pocket by ID
	 *
	 * @param pocketId - Pocket ID to retrieve
	 * @returns Service result with pocket or error
	 */
	async getPocket(pocketId: string): Promise<ServiceResult<Pocket>> {
		try {
			const response = await tauriCommandAdapter.getPocket(pocketId);

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
	 * Update an existing pocket
	 *
	 * @param request - Pocket update request
	 * @returns Service result with updated pocket or error
	 */
	async updatePocket(request: UpdatePocketRequest): Promise<ServiceResult<Pocket>> {
		try {
			const response = await tauriCommandAdapter.updatePocket(request);

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
	 * Delete a pocket
	 *
	 * @param pocketId - Pocket ID to delete
	 * @returns Service result with success or error
	 */
	async deletePocket(pocketId: string): Promise<ServiceResult<void>> {
		try {
			const response = await tauriCommandAdapter.deletePocket(pocketId);

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

	/**
	 * Set a pocket as the default pocket
	 *
	 * @param pocketId - Pocket ID to set as default
	 * @returns Service result with success or error
	 */
	async setDefaultPocket(pocketId: string): Promise<ServiceResult<void>> {
		try {
			const response = await tauriCommandAdapter.setDefaultPocket(pocketId);

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
 * Singleton instance of pocket service
 */
export const pocketService = new PocketService();
