<script lang="ts">
	/**
	 * Button Component - Refined, professional button with multiple variants
	 * Notion-inspired minimalism with excellent hover states
	 */

	type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
	type ButtonSize = 'sm' | 'md' | 'lg';

	interface ButtonProps {
		variant?: ButtonVariant;
		size?: ButtonSize;
		loading?: boolean;
		disabled?: boolean;
		type?: 'button' | 'submit' | 'reset';
		onclick?: (event: MouseEvent) => void;
		class?: string;
	}

	let {
		variant = 'primary',
		size = 'md',
		loading = false,
		disabled = false,
		type = 'button',
		onclick,
		class: className = '',
		children
	}: ButtonProps = $props();

	const isDisabled = $derived(disabled || loading);
</script>

<button
	{type}
	class="btn btn-{variant} btn-{size} {className}"
	disabled={isDisabled}
	onclick={onclick}
	aria-busy={loading}
>
	{#if loading}
		<span class="spinner" aria-hidden="true"></span>
	{/if}
	<span class="btn-content" class:loading>
		{@render children?.()}
	</span>
</button>

<style>
	.btn {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		font-family: var(--font-body);
		font-weight: var(--font-weight-medium);
		border-radius: var(--radius-md);
		transition: all var(--transition-fast);
		cursor: pointer;
		white-space: nowrap;
		user-select: none;
		outline: none;
	}

	.btn:focus-visible {
		box-shadow: var(--shadow-focus);
	}

	/* Sizes */
	.btn-sm {
		padding: var(--space-2) var(--space-3);
		font-size: var(--text-sm);
		height: 32px;
	}

	.btn-md {
		padding: var(--space-3) var(--space-4);
		font-size: var(--text-base);
		height: 40px;
	}

	.btn-lg {
		padding: var(--space-4) var(--space-6);
		font-size: var(--text-lg);
		height: 48px;
	}

	/* Variants */
	.btn-primary {
		background: var(--color-primary-500);
		color: var(--color-text-inverse);
		border: 1px solid transparent;
	}

	.btn-primary:hover:not(:disabled) {
		background: var(--color-primary-600);
		transform: translateY(-1px);
		box-shadow: var(--shadow-sm);
	}

	.btn-primary:active:not(:disabled) {
		background: var(--color-primary-700);
		transform: translateY(0);
	}

	.btn-secondary {
		background: var(--color-bg-tertiary);
		color: var(--color-text-primary);
		border: 1px solid var(--color-border-primary);
	}

	.btn-secondary:hover:not(:disabled) {
		background: var(--color-bg-hover);
		border-color: var(--color-border-secondary);
		transform: translateY(-1px);
		box-shadow: var(--shadow-sm);
	}

	.btn-secondary:active:not(:disabled) {
		background: var(--color-bg-active);
		transform: translateY(0);
	}

	.btn-ghost {
		background: transparent;
		color: var(--color-text-secondary);
		border: 1px solid transparent;
	}

	.btn-ghost:hover:not(:disabled) {
		background: var(--color-bg-hover);
		color: var(--color-text-primary);
	}

	.btn-ghost:active:not(:disabled) {
		background: var(--color-bg-active);
	}

	.btn-danger {
		background: var(--color-error-500);
		color: white;
		border: 1px solid transparent;
	}

	.btn-danger:hover:not(:disabled) {
		background: var(--color-error-600);
		transform: translateY(-1px);
		box-shadow: var(--shadow-sm);
	}

	.btn-danger:active:not(:disabled) {
		background: var(--color-error-700);
		transform: translateY(0);
	}

	/* Disabled state */
	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		transform: none;
	}

	/* Loading spinner */
	.spinner {
		display: inline-block;
		width: 14px;
		height: 14px;
		border: 2px solid currentColor;
		border-top-color: transparent;
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.btn-content.loading {
		opacity: 0.7;
	}
</style>
