<script lang="ts">
	/**
	 * Sidebar Component - Refined navigation with smooth responsive behavior
	 * Notion-inspired with premium feel for financial app
	 */

	import { page } from '$app/stores';
	import ThemeToggle from './ThemeToggle.svelte';

	interface NavItem {
		label: string;
		href: string;
		iconName: 'home' | 'list' | 'wallet' | 'settings';
	}

	interface SidebarProps {
		isOpen?: boolean;
		onToggle?: () => void;
	}

	let { isOpen = $bindable(false), onToggle }: SidebarProps = $props();

	// Navigation items
	const navItems: NavItem[] = [
		{
			label: 'Dashboard',
			href: '/',
			iconName: 'home'
		},
		{
			label: 'Transactions',
			href: '/transactions',
			iconName: 'list'
		},
		{
			label: 'Pockets',
			href: '/pockets',
			iconName: 'wallet'
		},
		{
			label: 'Settings',
			href: '/settings',
			iconName: 'settings'
		}
	];

	// Check if route is active
	const isActive = (href: string) => {
		return $page.url.pathname === href;
	};

	// Close sidebar on mobile when clicking a link
	const handleNavClick = () => {
		if (window.innerWidth < 1024) {
			isOpen = false;
		}
	};

	// Close sidebar when clicking backdrop on mobile
	const handleBackdropClick = () => {
		isOpen = false;
	};
</script>

<!-- Mobile backdrop -->
{#if isOpen}
	<div class="sidebar-backdrop" onclick={handleBackdropClick} role="presentation"></div>
{/if}

<!-- Sidebar -->
<aside class="sidebar" class:open={isOpen}>
	<!-- Logo/Branding -->
	<div class="sidebar-header">
		<a href="/" class="logo" onclick={handleNavClick}>
			<svg
				class="logo-icon"
				width="32"
				height="32"
				viewBox="0 0 32 32"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
			>
				<rect width="32" height="32" rx="8" fill="url(#gradient)" />
				<path
					d="M16 9V23M10 16H22"
					stroke="white"
					stroke-width="2.5"
					stroke-linecap="round"
				/>
				<defs>
					<linearGradient id="gradient" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
						<stop stop-color="#3b82f6" />
						<stop offset="1" stop-color="#2563eb" />
					</linearGradient>
				</defs>
			</svg>
			<span class="logo-text">Pocket Log</span>
		</a>
	</div>

	<!-- Navigation -->
	<nav class="sidebar-nav">
		{#each navItems as item (item.href)}
			<a
				href={item.href}
				class="nav-item"
				class:active={isActive(item.href)}
				onclick={handleNavClick}
			>
				{#if item.iconName === 'home'}
					{@render HomeIcon()}
				{:else if item.iconName === 'list'}
					{@render ListIcon()}
				{:else if item.iconName === 'wallet'}
					{@render WalletIcon()}
				{:else if item.iconName === 'settings'}
					{@render SettingsIcon()}
				{/if}
				<span class="nav-label">{item.label}</span>
			</a>
		{/each}
	</nav>

	<!-- Theme Toggle (at bottom) -->
	<div class="sidebar-footer">
		<ThemeToggle />
	</div>
</aside>

<!-- Icon Components -->
{#snippet HomeIcon()}
	<svg class="nav-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
		<path
			d="M3 10L10 3L17 10M5 8V17H8V13H12V17H15V8"
			stroke="currentColor"
			stroke-width="1.5"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	</svg>
{/snippet}

{#snippet ListIcon()}
	<svg class="nav-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
		<path
			d="M6 5H17M6 10H17M6 15H17M3 5H3.01M3 10H3.01M3 15H3.01"
			stroke="currentColor"
			stroke-width="1.5"
			stroke-linecap="round"
		/>
	</svg>
{/snippet}

{#snippet WalletIcon()}
	<svg class="nav-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
		<path
			d="M17 7H3C2.44772 7 2 7.44772 2 8V16C2 16.5523 2.44772 17 3 17H17C17.5523 17 18 16.5523 18 16V8C18 7.44772 17.5523 7 17 7Z"
			stroke="currentColor"
			stroke-width="1.5"
		/>
		<path d="M5 7V5C5 3.89543 5.89543 3 7 3H13C14.1046 3 15 3.89543 15 5V7" stroke="currentColor" stroke-width="1.5" />
		<circle cx="14" cy="12" r="1" fill="currentColor" />
	</svg>
{/snippet}

{#snippet SettingsIcon()}
	<svg class="nav-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
		<path
			d="M10 12C11.1046 12 12 11.1046 12 10C12 8.89543 11.1046 8 10 8C8.89543 8 8 8.89543 8 10C8 11.1046 8.89543 12 10 12Z"
			stroke="currentColor"
			stroke-width="1.5"
		/>
		<path
			d="M16.5 10C16.5 10.5 16.4 10.9 16.3 11.4L18.1 12.7L16.6 15.3L14.5 14.5C13.9 15 13.2 15.4 12.5 15.6L12 18H8L7.5 15.6C6.8 15.4 6.1 15 5.5 14.5L3.4 15.3L1.9 12.7L3.7 11.4C3.6 10.9 3.5 10.5 3.5 10C3.5 9.5 3.6 9.1 3.7 8.6L1.9 7.3L3.4 4.7L5.5 5.5C6.1 5 6.8 4.6 7.5 4.4L8 2H12L12.5 4.4C13.2 4.6 13.9 5 14.5 5.5L16.6 4.7L18.1 7.3L16.3 8.6C16.4 9.1 16.5 9.5 16.5 10Z"
			stroke="currentColor"
			stroke-width="1.5"
		/>
	</svg>
{/snippet}

<style>
	/* Sidebar backdrop (tablet only) */
	.sidebar-backdrop {
		position: fixed;
		inset: 0;
		z-index: var(--z-modal-backdrop);
		background: var(--color-overlay);
		backdrop-filter: blur(4px);
		animation: fadeIn var(--transition-base);
	}

	/* Hide backdrop on mobile and desktop */
	@media (max-width: 639px), (min-width: 1024px) {
		.sidebar-backdrop {
			display: none;
		}
	}

	/* Sidebar */
	.sidebar {
		position: fixed;
		top: 0;
		left: 0;
		bottom: 0;
		z-index: var(--z-modal);
		display: flex;
		flex-direction: column;
		width: var(--sidebar-width);
		background: var(--color-bg-primary);
		border-right: 1px solid var(--color-border-primary);
		transition: transform var(--transition-smooth);
	}

	/* Mobile: Completely hidden (using bottom nav instead) */
	@media (max-width: 639px) {
		.sidebar {
			display: none;
		}
	}

	/* Tablet: Icon-only by default, expands when open */
	@media (min-width: 640px) and (max-width: 1023px) {
		.sidebar {
			width: var(--sidebar-collapsed);
			transform: translateX(0);
		}

		.sidebar.open {
			width: var(--sidebar-width);
			box-shadow: var(--shadow-xl);
		}
	}

	/* Desktop: Always visible, expanded */
	@media (min-width: 1024px) {
		.sidebar {
			transform: translateX(0);
		}
	}

	/* Sidebar Header (Logo) */
	.sidebar-header {
		padding: var(--space-6) var(--space-4);
		border-bottom: 1px solid var(--color-border-primary);
	}

	.logo {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		text-decoration: none;
		transition: opacity var(--transition-fast);
	}

	.logo:hover {
		opacity: 0.8;
	}

	.logo-icon {
		flex-shrink: 0;
	}

	.logo-text {
		font-family: var(--font-display);
		font-size: var(--text-xl);
		font-weight: var(--font-weight-bold);
		color: var(--color-text-primary);
		white-space: nowrap;
		opacity: 1;
		transition: opacity var(--transition-base);
	}

	/* Hide logo text on collapsed sidebar */
	@media (min-width: 640px) and (max-width: 1023px) {
		.sidebar:not(.open) .logo-text {
			opacity: 0;
			width: 0;
			overflow: hidden;
		}
	}

	/* Navigation */
	.sidebar-nav {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		padding: var(--space-4);
		overflow-y: auto;
	}

	.nav-item {
		position: relative;
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		font-family: var(--font-body);
		font-size: var(--text-base);
		font-weight: var(--font-weight-medium);
		color: var(--color-text-secondary);
		text-decoration: none;
		border-radius: var(--radius-md);
		transition: all var(--transition-fast);
		overflow: hidden;
	}

	.nav-item::before {
		content: '';
		position: absolute;
		left: 0;
		top: 50%;
		transform: translateY(-50%);
		width: 3px;
		height: 0;
		background: var(--color-primary-500);
		border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
		transition: height var(--transition-base);
	}

	.nav-item:hover {
		color: var(--color-text-primary);
		background: var(--color-bg-hover);
	}

	.nav-item.active {
		color: var(--color-primary-600);
		background: var(--color-primary-50);
	}

	.nav-item.active::before {
		height: 60%;
	}

	.nav-icon {
		flex-shrink: 0;
		color: currentColor;
	}

	.nav-label {
		white-space: nowrap;
		opacity: 1;
		transition: opacity var(--transition-base);
	}

	/* Hide labels on collapsed sidebar */
	@media (min-width: 640px) and (max-width: 1023px) {
		.sidebar:not(.open) .nav-label {
			opacity: 0;
			width: 0;
			overflow: hidden;
		}

		.sidebar:not(.open) .nav-item {
			justify-content: center;
		}
	}

	/* Sidebar Footer */
	.sidebar-footer {
		padding: var(--space-4);
		border-top: 1px solid var(--color-border-primary);
	}

	/* Animations */
	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
</style>
