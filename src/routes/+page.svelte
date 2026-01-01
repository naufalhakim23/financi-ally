<script lang="ts">
	/**
	 * Dashboard Page - Overview of financial status
	 * Shows quick stats, recent transactions, and quick actions
	 */

	import { onMount } from 'svelte';
	import { transactionStore } from '$lib/application/stores/transactionStore.svelte';
	import { pocketStore } from '$lib/application/stores/pocketStore.svelte';
	import Card from '$lib/presentation/components/ui/Card.svelte';
	import Badge from '$lib/presentation/components/ui/Badge.svelte';
	import Button from '$lib/presentation/components/ui/Button.svelte';
	import { formatAmount, formatDateTime } from '$lib/domain/Transaction';

	onMount(async () => {
		await Promise.all([
			transactionStore.loadTransactions(),
			pocketStore.loadPockets()
		]);
	});

	const recentTransactions = $derived(
		transactionStore.filteredTransactions.slice(0, 5)
	);
	const totalPockets = $derived(pocketStore.pockets.length);

	// Calculate total balance across all pockets
	const totalBalance = $derived(
		pocketStore.pockets.reduce((sum, pocket) => sum + pocket.current_balance_cents, 0)
	);
</script>

<div class="dashboard">
	<!-- Page Header -->
	<header class="page-header">
		<div>
			<h1 class="page-title">Dashboard</h1>
			<p class="page-subtitle">Welcome back! Here's your financial overview.</p>
		</div>
		<div class="header-actions">
			<Button variant="primary" onclick={() => (window.location.href = '/transactions')}>
				New Transaction
			</Button>
		</div>
	</header>

	<!-- Stats Cards -->
	<section class="stats-grid">
		<Card padding="md">
			<div class="stat-card">
				<div class="stat-icon stat-icon-primary">
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
						<path
							d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
							stroke="currentColor"
							stroke-width="2"
						/>
						<path d="M12 7V12L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
					</svg>
				</div>
				<div class="stat-content">
					<p class="stat-label">Total Balance</p>
					<p class="stat-value">{formatAmount(totalBalance)}</p>
				</div>
			</div>
		</Card>

		<Card padding="md">
			<div class="stat-card">
				<div class="stat-icon stat-icon-success">
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
						<path
							d="M20 7H4C2.89543 7 2 7.89543 2 9V19C2 20.1046 2.89543 21 4 21H20C21.1046 21 22 20.1046 22 19V9C22 7.89543 21.1046 7 20 7Z"
							stroke="currentColor"
							stroke-width="2"
						/>
						<path d="M6 7V5C6 3.89543 6.89543 3 8 3H16C17.1046 3 18 3.89543 18 5V7" stroke="currentColor" stroke-width="2" />
					</svg>
				</div>
				<div class="stat-content">
					<p class="stat-label">Active Pockets</p>
					<p class="stat-value">{totalPockets}</p>
				</div>
			</div>
		</Card>

		<Card padding="md">
			<div class="stat-card">
				<div class="stat-icon stat-icon-info">
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
						<path
							d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15"
							stroke="currentColor"
							stroke-width="2"
						/>
						<path d="M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5V7H9V5Z" stroke="currentColor" stroke-width="2" />
					</svg>
				</div>
				<div class="stat-content">
					<p class="stat-label">Transactions</p>
					<p class="stat-value">{transactionStore.filteredTransactions.length}</p>
				</div>
			</div>
		</Card>
	</section>

	<!-- Recent Transactions -->
	<section class="recent-section">
		<Card padding="lg">
			<div class="section-header">
				<h2 class="section-title">Recent Transactions</h2>
				<Button variant="ghost" onclick={() => (window.location.href = '/transactions')}>
					View All
				</Button>
			</div>

			{#if recentTransactions.length === 0}
				<div class="empty-state">
					<p>No transactions yet</p>
					<p class="empty-subtitle">Create your first transaction to get started</p>
				</div>
			{:else}
				<div class="transactions-list">
					{#each recentTransactions as transaction (transaction.id)}
						<div class="transaction-item">
							<div class="transaction-info">
								<p class="transaction-description">
									{transaction.description || 'No description'}
								</p>
								<div class="transaction-meta">
									<Badge variant={transaction.scope}>{transaction.scope}</Badge>
									<span class="transaction-date">{formatDateTime(transaction.occurred_at)}</span>
								</div>
							</div>
							<div class="transaction-amount">
								<span class="amount" class:positive={transaction.total_amount_cents >= 0} class:negative={transaction.total_amount_cents < 0}>
									{formatAmount(transaction.total_amount_cents)}
								</span>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</Card>
	</section>

	<!-- Quick Actions -->
	<section class="quick-actions">
		<h2 class="section-title">Quick Actions</h2>
		<div class="actions-grid">
			<Card padding="md" clickable onclick={() => (window.location.href = '/transactions')}>
				<div class="action-card">
					<div class="action-icon">📝</div>
					<h3 class="action-title">New Transaction</h3>
					<p class="action-description">Record income or expense</p>
				</div>
			</Card>

			<Card padding="md" clickable onclick={() => (window.location.href = '/pockets')}>
				<div class="action-card">
					<div class="action-icon">💰</div>
					<h3 class="action-title">Manage Pockets</h3>
					<p class="action-description">View and organize wallets</p>
				</div>
			</Card>

			<Card padding="md" clickable onclick={() => (window.location.href = '/settings')}>
				<div class="action-card">
					<div class="action-icon">⚙️</div>
					<h3 class="action-title">Settings</h3>
					<p class="action-description">Configure preferences</p>
				</div>
			</Card>
		</div>
	</section>
</div>

<style>
	.dashboard {
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

	.header-actions {
		display: flex;
		gap: var(--space-3);
	}

	/* Stats Grid */
	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: var(--space-6);
	}

	.stat-card {
		display: flex;
		align-items: center;
		gap: var(--space-4);
	}

	.stat-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		border-radius: var(--radius-md);
		flex-shrink: 0;
	}

	.stat-icon-primary {
		background: var(--color-primary-100);
		color: var(--color-primary-600);
	}

	.stat-icon-success {
		background: var(--color-success-100);
		color: var(--color-success-600);
	}

	.stat-icon-info {
		background: var(--color-info-100);
		color: var(--color-info-600);
	}

	.stat-content {
		flex: 1;
	}

	.stat-label {
		margin: 0 0 var(--space-1) 0;
		font-size: var(--text-sm);
		font-weight: var(--font-weight-medium);
		color: var(--color-text-tertiary);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
	}

	.stat-value {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--text-3xl);
		font-weight: var(--font-weight-bold);
		color: var(--color-text-primary);
	}

	/* Recent Section */
	.recent-section {
		width: 100%;
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--space-6);
	}

	.section-title {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--text-2xl);
		font-weight: var(--font-weight-semibold);
		color: var(--color-text-primary);
	}

	.transactions-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.transaction-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		padding: var(--space-4);
		border-radius: var(--radius-md);
		transition: background var(--transition-fast);
	}

	.transaction-item:hover {
		background: var(--color-bg-hover);
	}

	.transaction-info {
		flex: 1;
	}

	.transaction-description {
		margin: 0 0 var(--space-2) 0;
		font-size: var(--text-base);
		font-weight: var(--font-weight-medium);
		color: var(--color-text-primary);
	}

	.transaction-meta {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.transaction-date {
		font-size: var(--text-sm);
		color: var(--color-text-tertiary);
	}

	.transaction-amount .amount {
		font-family: var(--font-display);
		font-size: var(--text-xl);
		font-weight: var(--font-weight-semibold);
	}

	.amount.positive {
		color: var(--color-success-600);
	}

	.amount.negative {
		color: var(--color-error-600);
	}

	.empty-state {
		padding: var(--space-12) var(--space-4);
		text-align: center;
		color: var(--color-text-tertiary);
	}

	.empty-state p {
		margin: var(--space-2) 0;
	}

	.empty-subtitle {
		font-size: var(--text-sm);
	}

	/* Quick Actions */
	.quick-actions {
		width: 100%;
	}

	.quick-actions .section-title {
		margin-bottom: var(--space-4);
	}

	.actions-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: var(--space-4);
	}

	.action-card {
		text-align: center;
	}

	.action-icon {
		font-size: var(--text-4xl);
		margin-bottom: var(--space-3);
	}

	.action-title {
		margin: 0 0 var(--space-2) 0;
		font-size: var(--text-lg);
		font-weight: var(--font-weight-semibold);
		color: var(--color-text-primary);
	}

	.action-description {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--color-text-tertiary);
	}

	/* Responsive */
	@media (max-width: 640px) {
		.page-header {
			flex-direction: column;
		}

		.header-actions {
			width: 100%;
		}

		.header-actions :global(button) {
			flex: 1;
		}

		.stats-grid {
			grid-template-columns: 1fr;
		}

		.actions-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
