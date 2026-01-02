<script lang="ts">
	/**
	 * Card Component - Clean container with subtle elevation
	 * Notion-inspired with refined shadows and hover effects
	 */

	interface CardProps {
		clickable?: boolean;
		onclick?: (event: MouseEvent) => void;
		padding?: 'none' | 'sm' | 'md' | 'lg';
		class?: string;
		children?: () => any;
	}

	let {
		clickable = false,
		onclick,
		padding = 'md',
		class: className = '',
		children
	}: CardProps = $props();

	const handleClick = (event: MouseEvent) => {
		if (clickable && onclick) {
			onclick(event);
		}
	};

	const handleKeyDown = (event: KeyboardEvent) => {
		if (clickable && onclick && (event.key === 'Enter' || event.key === ' ')) {
			event.preventDefault();
			onclick(event as any);
		}
	};
</script>

<div
	class="card padding-{padding} {className}"
	class:clickable
	role={clickable ? 'button' : undefined}
	tabindex={clickable ? 0 : undefined}
	onclick={handleClick}
	onkeydown={handleKeyDown}
>
	{@render children?.()}
</div>

<style>
	.card {
		background: var(--color-bg-primary);
		border: 1px solid var(--color-border-primary);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-sm);
		transition: all var(--transition-base);
	}

	/* Padding variants */
	.padding-none {
		padding: 0;
	}

	.padding-sm {
		padding: var(--space-4);
	}

	.padding-md {
		padding: var(--space-6);
	}

	.padding-lg {
		padding: var(--space-8);
	}

	/* Clickable variant */
	.card.clickable {
		cursor: pointer;
		user-select: none;
	}

	.card.clickable:hover {
		transform: translateY(-2px);
		box-shadow: var(--shadow-md);
		border-color: var(--color-border-secondary);
	}

	.card.clickable:active {
		transform: translateY(-1px);
		box-shadow: var(--shadow-base);
	}

	.card.clickable:focus-visible {
		outline: 2px solid var(--color-border-focus);
		outline-offset: 2px;
	}

	/* Responsive padding adjustments */
	@media (max-width: 640px) {
		.padding-md {
			padding: var(--space-4);
		}

		.padding-lg {
			padding: var(--space-6);
		}
	}
</style>
