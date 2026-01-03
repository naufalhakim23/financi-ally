<script lang="ts">
	/**
	 * Modal Component - Refined dialog with backdrop
	 * Includes focus trap, escape key handling, and smooth animations
	 */

	import { onMount } from 'svelte';
	import { fade, scale } from 'svelte/transition';

	interface ModalProps {
		open?: boolean;
		onClose: () => void;
		title?: string;
		showCloseButton?: boolean;
		size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
		class?: string;
		children?: any;
		footer?: any;
	}

	let {
		open = false,
		onClose,
		title,
		showCloseButton = true,
		size = 'md',
		class: className = '',
		children,
		footer
	}: ModalProps = $props();

	let dialogElement: HTMLDialogElement | null = $state(null);

	// Handle escape key
	const handleKeydown = (e: KeyboardEvent) => {
		if (e.key === 'Escape' && open) {
			onClose();
		}
	};

	// Handle backdrop click
	const handleBackdropClick = (e: MouseEvent) => {
		if (e.target === e.currentTarget) {
			onClose();
		}
	};

	// Focus trap
	onMount(() => {
		if (open && dialogElement) {
			const focusableElements = dialogElement.querySelectorAll(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
			);
			const firstElement = focusableElements[0] as HTMLElement;
			const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

			if (firstElement) {
				firstElement.focus();
			}

			const trapFocus = (e: KeyboardEvent) => {
				if (e.key !== 'Tab') return;

				if (e.shiftKey) {
					if (document.activeElement === firstElement) {
						e.preventDefault();
						lastElement?.focus();
					}
				} else {
					if (document.activeElement === lastElement) {
						e.preventDefault();
						firstElement?.focus();
					}
				}
			};

			dialogElement.addEventListener('keydown', trapFocus as any);

			return () => {
				dialogElement?.removeEventListener('keydown', trapFocus as any);
			};
		}
	});

	// Prevent body scroll when modal is open
	$effect(() => {
		if (open) {
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = '';
		}

		return () => {
			document.body.style.overflow = '';
		};
	});
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<div
		class="modal-backdrop"
		onclick={handleBackdropClick}
		role="presentation"
		transition:fade={{ duration: 200 }}
	>
		<div
			bind:this={dialogElement}
			class="modal modal-{size} {className}"
			role="dialog"
			aria-modal="true"
			aria-labelledby={title ? 'modal-title' : undefined}
			onclick={(e) => e.stopPropagation()}
			transition:scale={{ duration: 250, start: 0.95 }}
		>
			{#if title || showCloseButton}
				<div class="modal-header">
					{#if title}
						<h2 id="modal-title" class="modal-title">{title}</h2>
					{/if}
					{#if showCloseButton}
						<button
							type="button"
							class="modal-close"
							onclick={onClose}
							aria-label="Close modal"
						>
							<svg
								width="20"
								height="20"
								viewBox="0 0 20 20"
								fill="none"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path
									d="M15 5L5 15M5 5L15 15"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
								/>
							</svg>
						</button>
					{/if}
				</div>
			{/if}

			<div class="modal-body">
				{@render children?.()}
			</div>

			{#if footer}
				<div class="modal-footer">
					{@render footer()}
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: var(--z-modal-backdrop);
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-overlay);
		backdrop-filter: blur(2px);
		padding: var(--space-4);
	}

	.modal {
		position: relative;
		display: flex;
		flex-direction: column;
		width: 100%;
		max-height: 90vh;
		background: var(--color-bg-primary);
		border-radius: var(--radius-xl);
		box-shadow: var(--shadow-xl);
		overflow: hidden;
	}

	/* Size variants */
	.modal-sm {
		max-width: 400px;
	}

	.modal-md {
		max-width: 560px;
	}

	.modal-lg {
		max-width: 720px;
	}

	.modal-xl {
		max-width: 960px;
	}

	.modal-full {
		max-width: 95vw;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		padding: var(--space-6);
		border-bottom: 1px solid var(--color-border-primary);
	}

	.modal-title {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--text-2xl);
		font-weight: var(--font-weight-semibold);
		color: var(--color-text-primary);
		line-height: var(--leading-tight);
	}

	.modal-close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		padding: 0;
		color: var(--color-text-tertiary);
		background: transparent;
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.modal-close:hover {
		color: var(--color-text-primary);
		background: var(--color-bg-hover);
	}

	.modal-close:active {
		background: var(--color-bg-active);
	}

	.modal-body {
		flex: 1;
		overflow-y: auto;
		padding: var(--space-6);
	}

	.modal-footer {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: var(--space-3);
		padding: var(--space-6);
		border-top: 1px solid var(--color-border-primary);
	}

	/* Responsive adjustments */
	@media (max-width: 640px) {
		.modal-backdrop {
			padding: var(--space-2);
		}

		.modal {
			max-height: 95vh;
			border-radius: var(--radius-lg);
		}

		.modal-header,
		.modal-body,
		.modal-footer {
			padding: var(--space-4);
		}

		.modal-title {
			font-size: var(--text-xl);
		}

		.modal-footer {
			flex-direction: column-reverse;
		}

		.modal-footer :global(button) {
			width: 100%;
		}
	}

	/* Animation imports */
	@keyframes fade {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes scale {
		from {
			opacity: 0;
			transform: scale(0.95);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}
</style>
