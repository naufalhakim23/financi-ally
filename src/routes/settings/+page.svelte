<script lang="ts">
	/**
	 * Settings Page - App configuration and preferences
	 */

	import Card from '$lib/presentation/components/ui/Card.svelte';
	import ThemeToggle from '$lib/presentation/components/ui/ThemeToggle.svelte';
	import { themeStore } from '$lib/application/stores/themeStore.svelte';

	const currentTheme = $derived(themeStore.currentTheme);
</script>

<div class="settings-page">
	<header class="page-header">
		<div>
			<h1 class="page-title">Settings</h1>
			<p class="page-subtitle">Configure your preferences</p>
		</div>
	</header>

	<!-- Appearance Settings -->
	<section>
		<h2 class="section-title">Appearance</h2>
		<Card padding="lg">
			<div class="setting-item">
				<div class="setting-info">
					<h3 class="setting-title">Theme</h3>
					<p class="setting-description">
						Choose between light and dark mode. Current: <strong>{currentTheme}</strong>
					</p>
				</div>
				<div class="setting-control">
					<ThemeToggle />
				</div>
			</div>
		</Card>
	</section>

	<!-- App Info -->
	<section>
		<h2 class="section-title">About</h2>
		<Card padding="lg">
			<div class="app-info">
				<h3 style="margin: 0 0 var(--space-2) 0; color: var(--color-text-primary);">Pocket Log</h3>
				<p style="margin: 0; color: var(--color-text-tertiary);">Immutable Financial Ledger</p>
				<p style="margin: var(--space-4) 0 0 0; font-size: var(--text-sm); color: var(--color-text-tertiary);">
					Version 1.0.0
				</p>
			</div>
		</Card>
	</section>
</div>

<style>
	.settings-page {
		display: flex;
		flex-direction: column;
		gap: var(--space-8);
		max-width: 800px;
	}

	.page-header {
		margin-bottom: var(--space-4);
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

	section {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.section-title {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--text-xl);
		font-weight: var(--font-weight-semibold);
		color: var(--color-text-primary);
	}

	.setting-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-6);
	}

	.setting-info {
		flex: 1;
	}

	.setting-title {
		margin: 0 0 var(--space-1) 0;
		font-size: var(--text-lg);
		font-weight: var(--font-weight-medium);
		color: var(--color-text-primary);
	}

	.setting-description {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--color-text-secondary);
	}

	.setting-control {
		flex-shrink: 0;
	}

	.app-info {
		text-align: center;
		padding: var(--space-4) 0;
	}

	@media (max-width: 640px) {
		.setting-item {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>
