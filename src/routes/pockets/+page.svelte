<script lang="ts">
	/**
	 * Pockets Page - Full pocket management with PocketForm and PocketList
	 */

	import PocketForm from '$lib/presentation/components/PocketForm.svelte';
	import PocketList from '$lib/presentation/components/PocketList.svelte';
</script>

<div class="pockets-page">
	<!-- Page Header -->
	<header class="page-header">
		<div>
			<h1 class="page-title">Pockets</h1>
			<p class="page-subtitle">Manage your wallets and financial accounts</p>
		</div>
	</header>

	<!-- Pocket Creation Form -->
	<section class="form-section">
		<PocketForm />
	</section>

	<!-- Pocket List -->
	<section class="list-section">
		<PocketList />
	</section>
</div>

<style>
	.pockets-page {
		display: flex;
		flex-direction: column;
		gap: var(--space-8);
	}

	/* Page Header */
	.page-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-4);
	}

	.page-title {
		margin: 0 0 var(--space-2) 0;
		font-family: var(--font-display);
		font-size: var(--text-4xl);
		font-weight: var(--font-weight-bold);
		color: var(--color-text-primary);
	}

	.page-subtitle {
		margin: 0;
		font-size: var(--text-lg);
		color: var(--color-text-tertiary);
	}

	/* Sections */
	.form-section,
	.list-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	/* Responsive */
	@media (max-width: 640px) {
		.page-header {
			flex-direction: column;
		}

		.pockets-page {
			gap: var(--space-6);
		}
	}
</style>
