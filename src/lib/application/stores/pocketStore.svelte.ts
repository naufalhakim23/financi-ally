/**
 * Pocket Store
 *
 * Svelte 5 runes-based state management for pockets.
 * Manages pocket list, loading state, and provides reactive access to default pocket.
 */

import { pocketService } from '../services/PocketService';
import type {
	Pocket,
	CreatePocketRequest,
	UpdatePocketRequest
} from '$lib/domain/Pocket';
import type { ServiceResult } from '../services/PocketService';

/**
 * Pocket store class using Svelte 5 runes
 *
 * Provides reactive state management for pockets with:
 * - Reactive pocket list
 * - Loading and error states
 * - Derived default pocket
 * - CRUD operations
 */
class PocketStore {
	/** Reactive list of all pockets */
	pockets = $state<Pocket[]>([]);

	/** Loading state for async operations */
	isLoading = $state(false);

	/** Error message from last operation */
	error = $state<string | null>(null);

	/**
	 * Derived default pocket
	 * Returns the pocket marked as default, or first pocket if none marked
	 */
	defaultPocket = $derived(
		this.pockets.find((p) => p.isDefault) || this.pockets[0] || null
	);

	/**
	 * Load all pockets from backend
	 *
	 * Sets loading state and updates pocket list.
	 * Clears previous errors on successful load.
	 */
	async loadPockets(): Promise<void> {
		this.isLoading = true;
		this.error = null;

		const result = await pocketService.listPockets();

		this.isLoading = false;

		if (result.success && result.data) {
			this.pockets = result.data;
		} else {
			this.error = result.error || 'Failed to load pockets';
		}
	}

	/**
	 * Create a new pocket
	 *
	 * @param request - Pocket creation request
	 * @returns Service result with created pocket or error
	 */
	async createPocket(request: CreatePocketRequest): Promise<ServiceResult<Pocket>> {
		this.isLoading = true;
		this.error = null;

		const result = await pocketService.createPocket(request);

		this.isLoading = false;

		if (result.success && result.data) {
			// Add new pocket to the list
			this.pockets = [...this.pockets, result.data];
		} else {
			this.error = result.error || 'Failed to create pocket';
		}

		return result;
	}

	/**
	 * Update an existing pocket
	 *
	 * @param request - Pocket update request
	 * @returns Service result with updated pocket or error
	 */
	async updatePocket(request: UpdatePocketRequest): Promise<ServiceResult<Pocket>> {
		this.isLoading = true;
		this.error = null;

		const result = await pocketService.updatePocket(request);

		this.isLoading = false;

		if (result.success && result.data) {
			// Update pocket in the list
			this.pockets = this.pockets.map((p) =>
				p.id === result.data!.id ? result.data! : p
			);
		} else {
			this.error = result.error || 'Failed to update pocket';
		}

		return result;
	}

	/**
	 * Delete a pocket
	 *
	 * Only succeeds if pocket has no transactions.
	 *
	 * @param pocketId - Pocket ID to delete
	 * @returns Service result with success or error
	 */
	async deletePocket(pocketId: string): Promise<ServiceResult<void>> {
		this.isLoading = true;
		this.error = null;

		const result = await pocketService.deletePocket(pocketId);

		this.isLoading = false;

		if (result.success) {
			// Remove pocket from the list
			this.pockets = this.pockets.filter((p) => p.id !== pocketId);
		} else {
			this.error = result.error || 'Failed to delete pocket';
		}

		return result;
	}

	/**
	 * Set a pocket as the default pocket
	 *
	 * Atomically unsets previous default and sets new default.
	 *
	 * @param pocketId - Pocket ID to set as default
	 * @returns Service result with success or error
	 */
	async setDefaultPocket(pocketId: string): Promise<ServiceResult<void>> {
		this.isLoading = true;
		this.error = null;

		const result = await pocketService.setDefaultPocket(pocketId);

		this.isLoading = false;

		if (result.success) {
			// Update isDefault flags in the list
			this.pockets = this.pockets.map((p) => ({
				...p,
				isDefault: p.id === pocketId
			}));
		} else {
			this.error = result.error || 'Failed to set default pocket';
		}

		return result;
	}

	/**
	 * Clear the current error message
	 */
	clearError(): void {
		this.error = null;
	}
}

/**
 * Singleton instance of pocket store
 *
 * Use this throughout the application for pocket state management.
 */
export const pocketStore = new PocketStore();
