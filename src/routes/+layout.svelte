<script lang="ts">
	/**
	 * Global Layout - Wraps all pages with responsive navigation
	 * Mobile (<640px): Bottom tab bar
	 * Tablet (640-1024px): Collapsible sidebar
	 * Desktop (≥1024px): Full sidebar
	 */

	import '$lib/presentation/styles/global.css';
	import Sidebar from '$lib/presentation/components/ui/Sidebar.svelte';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	let { children } = $props();

	let isSidebarOpen = $state(false);

	// Navigation items for bottom bar
	const navItems = [
		{
			label: 'Dashboard',
			href: '/',
			icon: 'home'
		},
		{
			label: 'Transactions',
			href: '/transactions',
			icon: 'list'
		},
		{
			label: 'Pockets',
			href: '/pockets',
			icon: 'wallet'
		},
		{
			label: 'Settings',
			href: '/settings',
			icon: 'settings'
		}
	];

	// Check if route is active
	const isActive = (href: string) => {
		return $page.url.pathname === href;
	};

	// Detect screen size changes
	onMount(() => {
		const checkScreenSize = () => {
			// Close sidebar on tablet/mobile when resizing
			if (window.innerWidth < 1024) {
				isSidebarOpen = false;
			}
		};

		checkScreenSize();
		window.addEventListener('resize', checkScreenSize);

		return () => window.removeEventListener('resize', checkScreenSize);
	});

	const toggleSidebar = () => {
		isSidebarOpen = !isSidebarOpen;
	};
</script>

<div class="app-layout">
	<!-- Sidebar Navigation (Tablet & Desktop) -->
	<Sidebar bind:isOpen={isSidebarOpen} onToggle={toggleSidebar} />

	<!-- Main Content Area -->
	<div class="main-content">
		<!-- Tablet Header with Hamburger (640px - 1024px only) -->
		<header class="tablet-header">
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
			<h1 class="header-title">Pocket Log</h1>
		</header>

		<!-- Page Content -->
		<main class="page-content">
			{@render children?.()}
		</main>
	</div>

	<!-- Bottom Navigation Bar (Mobile only <640px) -->
	<nav class="bottom-nav" role="navigation" aria-label="Main navigation">
		{#each navItems as item (item.href)}
			<a href={item.href} class="bottom-nav-item" class:active={isActive(item.href)}>
				{#if item.icon === 'home'}
					<svg class="nav-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
						<path
							d="M3 12L12 3L21 12M5 10V20H9V14H15V20H19V10"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				{:else if item.icon === 'list'}
					<svg class="nav-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
						<path
							d="M8 6H21M8 12H21M8 18H21M3 6H3.01M3 12H3.01M3 18H3.01"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
						/>
					</svg>
				{:else if item.icon === 'wallet'}
					<svg class="nav-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
						<path
							d="M21 8H3C2.44772 8 2 8.44772 2 9V19C2 19.5523 2.44772 20 3 20H21C21.5523 20 22 19.5523 22 19V9C22 8.44772 21.5523 8 21 8Z"
							stroke="currentColor"
							stroke-width="2"
						/>
						<path
							d="M6 8V6C6 4.89543 6.89543 4 8 4H16C17.1046 4 18 4.89543 18 6V8"
							stroke="currentColor"
							stroke-width="2"
						/>
						<circle cx="17" cy="14" r="1" fill="currentColor" />
					</svg>
				{:else if item.icon === 'settings'}
					<svg class="nav-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
						<path
							d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z"
							stroke="currentColor"
							stroke-width="2"
						/>
						<path
							d="M19.4 15C19.1277 15.6171 19.2583 16.3378 19.73 16.82L19.79 16.88C20.1656 17.2551 20.3766 17.7642 20.3766 18.295C20.3766 18.8258 20.1656 19.3349 19.79 19.71C19.4149 20.0856 18.9058 20.2966 18.375 20.2966C17.8442 20.2966 17.3351 20.0856 16.96 19.71L16.9 19.65C16.4178 19.1783 15.6971 19.0477 15.08 19.32C14.4755 19.5791 14.0826 20.1724 14.08 20.83V21C14.08 22.1046 13.1846 23 12.08 23C10.9754 23 10.08 22.1046 10.08 21V20.91C10.0642 20.2327 9.63587 19.6339 9 19.4C8.38291 19.1277 7.66219 19.2583 7.18 19.73L7.12 19.79C6.74486 20.1656 6.23582 20.3766 5.705 20.3766C5.17418 20.3766 4.66514 20.1656 4.29 19.79C3.91445 19.4149 3.70343 18.9058 3.70343 18.375C3.70343 17.8442 3.91445 17.3351 4.29 16.96L4.35 16.9C4.82167 16.4178 4.95235 15.6971 4.68 15.08C4.42093 14.4755 3.82764 14.0826 3.17 14.08H3C1.89543 14.08 1 13.1846 1 12.08C1 10.9754 1.89543 10.08 3 10.08H3.09C3.76733 10.0642 4.36613 9.63587 4.6 9C4.87235 8.38291 4.74167 7.66219 4.27 7.18L4.21 7.12C3.83445 6.74486 3.62343 6.23582 3.62343 5.705C3.62343 5.17418 3.83445 4.66514 4.21 4.29C4.58514 3.91445 5.09418 3.70343 5.625 3.70343C6.15582 3.70343 6.66486 3.91445 7.04 4.29L7.1 4.35C7.58219 4.82167 8.30291 4.95235 8.92 4.68H9C9.60447 4.42093 9.99738 3.82764 10 3.17V3C10 1.89543 10.8954 1 12 1C13.1046 1 14 1.89543 14 3V3.09C14.0026 3.74764 14.3955 4.34093 15 4.6C15.6171 4.87235 16.3378 4.74167 16.82 4.27L16.88 4.21C17.2551 3.83445 17.7642 3.62343 18.295 3.62343C18.8258 3.62343 19.3349 3.83445 19.71 4.21C20.0856 4.58514 20.2966 5.09418 20.2966 5.625C20.2966 6.15582 20.0856 6.66486 19.71 7.04L19.65 7.1C19.1783 7.58219 19.0477 8.30291 19.32 8.92V9C19.5791 9.60447 20.1724 9.99738 20.83 10H21C22.1046 10 23 10.8954 23 12C23 13.1046 22.1046 14 21 14H20.91C20.2524 14.0026 19.6591 14.3955 19.4 15Z"
							stroke="currentColor"
							stroke-width="2"
						/>
					</svg>
				{/if}
				<span class="nav-label">{item.label}</span>
			</a>
		{/each}
	</nav>
</div>

<style>
	.app-layout {
		display: flex;
		min-height: 100vh;
		background: var(--color-bg-secondary);
		position: relative;
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

	/* Tablet Header (640px - 1024px only) */
	.tablet-header {
		display: none;
	}

	@media (min-width: 640px) and (max-width: 1023px) {
		.tablet-header {
			display: flex;
			align-items: center;
			gap: var(--space-4);
			padding: var(--space-4);
			background: var(--color-bg-primary);
			border-bottom: 1px solid var(--color-border-primary);
		}
	}

	.hamburger-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
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

	.header-title {
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

	/* Mobile: Add bottom padding for bottom nav, reduce side padding */
	@media (max-width: 639px) {
		.page-content {
			padding: var(--space-4);
			padding-bottom: calc(var(--space-4) + 60px); /* 60px = bottom nav height */
		}
	}

	/* Bottom Navigation Bar (Mobile only) */
	.bottom-nav {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: var(--z-fixed);
		display: flex;
		align-items: center;
		justify-content: space-around;
		height: 60px;
		background: var(--color-bg-primary);
		border-top: 1px solid var(--color-border-primary);
		box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
		padding: 0 var(--space-2);
	}

	/* Hide bottom nav on tablet and desktop */
	@media (min-width: 640px) {
		.bottom-nav {
			display: none;
		}
	}

	.bottom-nav-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-1);
		flex: 1;
		height: 100%;
		max-width: 80px;
		padding: var(--space-2);
		text-decoration: none;
		color: var(--color-text-tertiary);
		transition: all var(--transition-fast);
		border-radius: var(--radius-md);
		position: relative;
	}

	.bottom-nav-item:active {
		background: var(--color-bg-hover);
	}

	.bottom-nav-item.active {
		color: var(--color-primary-600);
	}

	/* Active indicator dot */
	.bottom-nav-item.active::before {
		content: '';
		position: absolute;
		top: var(--space-1);
		width: 4px;
		height: 4px;
		background: var(--color-primary-500);
		border-radius: 50%;
	}

	.bottom-nav-item .nav-icon {
		flex-shrink: 0;
		color: currentColor;
		transition: transform var(--transition-fast);
	}

	.bottom-nav-item.active .nav-icon {
		transform: scale(1.1);
	}

	.bottom-nav-item .nav-label {
		font-size: var(--text-xs);
		font-weight: var(--font-weight-medium);
		font-family: var(--font-body);
		color: currentColor;
		white-space: nowrap;
	}
</style>
