<script lang="ts">
	/**
	 * Global Layout - Wraps all pages with Sidebar navigation
	 * Handles responsive sidebar state
	 */

	import '$lib/presentation/styles/global.css';
	import Sidebar from '$lib/presentation/components/ui/Sidebar.svelte';
	import { onMount } from 'svelte';

	let { children } = $props();

	let isSidebarOpen = $state(false);
	let isMobile = $state(false);

	// Detect mobile on mount and resize
	onMount(() => {
		const checkMobile = () => {
			isMobile = window.innerWidth < 1024;
			// Close sidebar on mobile by default
			if (isMobile) {
				isSidebarOpen = false;
			}
		};

		checkMobile();
		window.addEventListener('resize', checkMobile);

		return () => window.removeEventListener('resize', checkMobile);
	});

	const toggleSidebar = () => {
		isSidebarOpen = !isSidebarOpen;
	};
</script>

<div class="app-layout">
	<!-- Sidebar Navigation -->
	<Sidebar bind:isOpen={isSidebarOpen} onToggle={toggleSidebar} />

	<!-- Main Content Area -->
	<div class="main-content">
		<!-- Mobile Header with Hamburger -->
		<header class="mobile-header">
			<button
				type="button"
				class="hamburger-button"
				onclick={toggleSidebar}
				aria-label="Toggle navigation menu"
				aria-expanded={isSidebarOpen}
			>
				<svg
					class="hamburger-icon"
					class:open={isSidebarOpen}
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						class="line line-1"
						d="M4 6H20"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
					/>
					<path
						class="line line-2"
						d="M4 12H20"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
					/>
					<path
						class="line line-3"
						d="M4 18H20"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
					/>
				</svg>
			</button>
			<h1 class="mobile-title">Pocket Log</h1>
		</header>

		<!-- Page Content -->
		<main class="page-content">
			{@render children?.()}
		</main>
	</div>
</div>

<style>
	.app-layout {
		display: flex;
		min-height: 100vh;
		background: var(--color-bg-secondary);
	}

	.main-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	/* Desktop: Add left margin for sidebar */
	@media (min-width: 1024px) {
		.main-content {
			margin-left: var(--sidebar-width);
		}
	}

	/* Tablet: Add left margin for collapsed sidebar */
	@media (min-width: 640px) and (max-width: 1023px) {
		.main-content {
			margin-left: var(--sidebar-collapsed);
		}
	}

	/* Mobile Header */
	.mobile-header {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		padding: var(--space-4);
		background: var(--color-bg-primary);
		border-bottom: 1px solid var(--color-border-primary);
	}

	/* Hide on desktop */
	@media (min-width: 1024px) {
		.mobile-header {
			display: none;
		}
	}

	.hamburger-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		padding: 0;
		color: var(--color-text-primary);
		background: transparent;
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.hamburger-button:hover {
		background: var(--color-bg-hover);
	}

	.hamburger-button:active {
		background: var(--color-bg-active);
	}

	.hamburger-icon {
		color: currentColor;
	}

	/* Hamburger animation */
	.hamburger-icon .line {
		transition: all var(--transition-base);
		transform-origin: center;
	}

	.hamburger-icon.open .line-1 {
		transform: translateY(6px) rotate(45deg);
	}

	.hamburger-icon.open .line-2 {
		opacity: 0;
	}

	.hamburger-icon.open .line-3 {
		transform: translateY(-6px) rotate(-45deg);
	}

	.mobile-title {
		flex: 1;
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--text-xl);
		font-weight: var(--font-weight-bold);
		color: var(--color-text-primary);
	}

	/* Page Content */
	.page-content {
		flex: 1;
		padding: var(--space-6);
		max-width: var(--max-content-width);
		width: 100%;
		margin: 0 auto;
	}

	@media (max-width: 640px) {
		.page-content {
			padding: var(--space-4);
		}
	}
</style>
