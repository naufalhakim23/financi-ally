<script lang="ts">
	/**
	 * Badge Component - Status badges for categorization
	 * Used for personal/business, income/expense, and other tags
	 */

	type BadgeVariant = 'personal' | 'business' | 'income' | 'expense' | 'neutral' | 'primary';

	interface BadgeProps {
		variant?: BadgeVariant;
		class?: string;
		children?: () => any;
	}

	let {
		variant = 'neutral',
		class: className = '',
		children
	}: BadgeProps = $props();
</script>

<span class="badge badge-{variant} {className}">
	{@render children?.()}
</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-1) var(--space-3);
		font-family: var(--font-body);
		font-size: var(--text-xs);
		font-weight: var(--font-weight-semibold);
		line-height: var(--leading-none);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		border-radius: var(--radius-full);
		white-space: nowrap;
		transition: all var(--transition-fast);
	}

	/* Variant: Personal (Blue) */
	.badge-personal {
		background: var(--color-personal-bg);
		color: var(--color-personal-text);
	}

	/* Variant: Business (Yellow/Amber) */
	.badge-business {
		background: var(--color-business-bg);
		color: var(--color-business-text);
	}

	/* Variant: Income (Green) */
	.badge-income {
		background: var(--color-success-100);
		color: var(--color-success-700);
	}

	/* Variant: Expense (Red) */
	.badge-expense {
		background: var(--color-error-100);
		color: var(--color-error-700);
	}

	/* Variant: Neutral (Gray) */
	.badge-neutral {
		background: var(--color-neutral-100);
		color: var(--color-neutral-700);
	}

	/* Variant: Primary (Brand Blue) */
	.badge-primary {
		background: var(--color-primary-100);
		color: var(--color-primary-700);
	}

	/* Dark mode adjustments */
	:root[data-theme='dark'] .badge-income {
		background: var(--color-success-900);
		color: var(--color-success-300);
	}

	:root[data-theme='dark'] .badge-expense {
		background: var(--color-error-900);
		color: var(--color-error-300);
	}

	:root[data-theme='dark'] .badge-neutral {
		background: var(--color-neutral-800);
		color: var(--color-neutral-300);
	}

	:root[data-theme='dark'] .badge-primary {
		background: var(--color-primary-900);
		color: var(--color-primary-300);
	}
</style>
