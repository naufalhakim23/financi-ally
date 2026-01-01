<script lang="ts">
	/**
	 * ThemeToggle Component - Elegant sun/moon switcher
	 * Smooth transitions with refined animations
	 */

	import { themeStore } from '$lib/application/stores/themeStore.svelte';

	let showTooltip = $state(false);

	const handleToggle = () => {
		themeStore.toggleTheme();
	};

	const isDark = $derived(themeStore.isDark);
</script>

<div class="theme-toggle-wrapper">
	<button
		type="button"
		class="theme-toggle"
		onclick={handleToggle}
		aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
		onmouseenter={() => (showTooltip = true)}
		onmouseleave={() => (showTooltip = false)}
		onfocus={() => (showTooltip = true)}
		onblur={() => (showTooltip = false)}
	>
		<!-- Sun Icon (Light Mode) -->
		<svg
			class="theme-icon sun"
			class:active={!isDark}
			width="20"
			height="20"
			viewBox="0 0 20 20"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<circle cx="10" cy="10" r="3.5" stroke="currentColor" stroke-width="1.5" />
			<path
				d="M10 2V3.5M10 16.5V18M18 10H16.5M3.5 10H2M15.5 4.5L14.5 5.5M5.5 14.5L4.5 15.5M15.5 15.5L14.5 14.5M5.5 5.5L4.5 4.5"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
			/>
		</svg>

		<!-- Moon Icon (Dark Mode) -->
		<svg
			class="theme-icon moon"
			class:active={isDark}
			width="20"
			height="20"
			viewBox="0 0 20 20"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				d="M17 10.5C16.1 14.5 12.6 17.5 8.5 17.5C4.4 17.5 1 14.1 1 10C1 5.9 4 2.4 8 1.5C6.5 2.5 5.5 4.2 5.5 6.2C5.5 9.4 8.1 12 11.3 12C13.3 12 15 11 16 9.5C16.7 9.8 17 10.1 17 10.5Z"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
	</button>

	<!-- Tooltip -->
	{#if showTooltip}
		<div class="tooltip" role="tooltip">
			{isDark ? 'Light mode' : 'Dark mode'}
		</div>
	{/if}
</div>

<style>
	.theme-toggle-wrapper {
		position: relative;
	}

	.theme-toggle {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		padding: 0;
		color: var(--color-text-secondary);
		background: transparent;
		border: 1px solid var(--color-border-primary);
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: all var(--transition-fast);
		overflow: hidden;
	}

	.theme-toggle:hover {
		color: var(--color-text-primary);
		background: var(--color-bg-hover);
		border-color: var(--color-border-secondary);
	}

	.theme-toggle:active {
		background: var(--color-bg-active);
		transform: scale(0.95);
	}

	.theme-toggle:focus-visible {
		outline: 2px solid var(--color-border-focus);
		outline-offset: 2px;
	}

	/* Theme Icons */
	.theme-icon {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%) rotate(0deg) scale(0);
		opacity: 0;
		color: currentColor;
		transition: all var(--transition-smooth) var(--ease-spring);
	}

	.theme-icon.active {
		transform: translate(-50%, -50%) rotate(0deg) scale(1);
		opacity: 1;
	}

	/* Sun rotates in */
	.sun.active {
		animation: rotateIn 0.5s var(--ease-spring);
	}

	/* Moon slides in */
	.moon.active {
		animation: slideIn 0.5s var(--ease-spring);
	}

	@keyframes rotateIn {
		from {
			transform: translate(-50%, -50%) rotate(-180deg) scale(0);
			opacity: 0;
		}
		to {
			transform: translate(-50%, -50%) rotate(0deg) scale(1);
			opacity: 1;
		}
	}

	@keyframes slideIn {
		from {
			transform: translate(-50%, -100%) scale(0.8);
			opacity: 0;
		}
		to {
			transform: translate(-50%, -50%) scale(1);
			opacity: 1;
		}
	}

	/* Tooltip */
	.tooltip {
		position: absolute;
		bottom: calc(100% + var(--space-2));
		left: 50%;
		transform: translateX(-50%);
		padding: var(--space-2) var(--space-3);
		font-size: var(--text-sm);
		font-weight: var(--font-weight-medium);
		color: var(--color-text-inverse);
		background: var(--color-neutral-800);
		border-radius: var(--radius-md);
		white-space: nowrap;
		pointer-events: none;
		animation: tooltipFadeIn 0.2s ease-out;
		z-index: var(--z-tooltip);
	}

	.tooltip::after {
		content: '';
		position: absolute;
		top: 100%;
		left: 50%;
		transform: translateX(-50%);
		border: 4px solid transparent;
		border-top-color: var(--color-neutral-800);
	}

	@keyframes tooltipFadeIn {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(-4px);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
	}

	/* Dark mode adjustments */
	:root[data-theme='dark'] .tooltip {
		background: var(--color-neutral-700);
	}

	:root[data-theme='dark'] .tooltip::after {
		border-top-color: var(--color-neutral-700);
	}
</style>
