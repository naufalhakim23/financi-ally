/**
 * Theme Store - Manages light/dark theme switching
 *
 * Uses Svelte 5 runes for reactive state management
 * Persists theme preference to localStorage
 * Detects system preference on first load
 */

import { browser } from '$app/environment';

type Theme = 'light' | 'dark';

class ThemeStore {
	theme = $state<Theme>('light');

	constructor() {
		if (browser) {
			// Initialize theme from localStorage or system preference
			this.initializeTheme();
		}
	}

	/**
	 * Initialize theme on mount
	 */
	private initializeTheme() {
		const stored = localStorage.getItem('pocket-log-theme') as Theme | null;

		if (stored === 'light' || stored === 'dark') {
			this.theme = stored;
		} else {
			// Detect system preference
			const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
			this.theme = prefersDark ? 'dark' : 'light';
		}

		// Apply theme to document
		this.applyTheme(this.theme);

		// Listen for system preference changes
		window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
			// Only auto-switch if user hasn't explicitly set a preference
			if (!localStorage.getItem('pocket-log-theme')) {
				const newTheme = e.matches ? 'dark' : 'light';
				this.setTheme(newTheme);
			}
		});
	}

	/**
	 * Set theme and persist to localStorage
	 */
	setTheme(newTheme: Theme) {
		this.theme = newTheme;
		this.applyTheme(newTheme);

		if (browser) {
			localStorage.setItem('pocket-log-theme', newTheme);
		}
	}

	/**
	 * Toggle between light and dark themes
	 */
	toggleTheme() {
		const newTheme = this.theme === 'light' ? 'dark' : 'light';
		this.setTheme(newTheme);
	}

	/**
	 * Apply theme to document root
	 */
	private applyTheme(theme: Theme) {
		if (browser) {
			document.documentElement.setAttribute('data-theme', theme);
		}
	}

	/**
	 * Get current theme (derived getter)
	 */
	get currentTheme(): Theme {
		return this.theme;
	}

	/**
	 * Check if dark mode is active
	 */
	get isDark(): boolean {
		return this.theme === 'dark';
	}
}

// Export singleton instance
export const themeStore = new ThemeStore();
