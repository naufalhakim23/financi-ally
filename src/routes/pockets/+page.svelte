<script lang="ts">
	/**
	 * Pockets Page - Wallet/pocket management
	 * TODO: Will be enhanced with refactored components in Phase 4
	 */

	import Card from '$lib/presentation/components/ui/Card.svelte';
	import Button from '$lib/presentation/components/ui/Button.svelte';
</script>

<div class="pockets-page">
	<header class="page-header">
		<div>
			<h1 class="page-title">Pockets</h1>
			<p class="page-subtitle">Manage your wallets and financial accounts</p>
		</div>
		<div class="header-actions">
			<Button variant="primary">New Pocket</Button>
		</div>
	</header>

	<Card padding="lg">
		<p style="text-align: center; color: var(--color-text-tertiary); padding: var(--space-12);">
			Pocket management coming in Phase 4...
		</p>
	</Card>
</div>

<style>
	.pockets-page {
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
	}

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
</style>
