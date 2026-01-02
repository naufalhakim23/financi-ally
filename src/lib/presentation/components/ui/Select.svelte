<script lang="ts">
	/**
	 * Select Component - Custom dropdown with Notion-style aesthetics
	 * Provides better styling than native select elements
	 */

	interface SelectOption {
		value: string;
		label: string;
		disabled?: boolean;
	}

	interface SelectProps {
		value?: string;
		options: SelectOption[];
		label?: string;
		placeholder?: string;
		error?: string;
		disabled?: boolean;
		required?: boolean;
		id?: string;
		name?: string;
		onchange?: (value: string) => void;
		class?: string;
	}

	let {
		value = $bindable(),
		options,
		label,
		placeholder = 'Select an option',
		error,
		disabled = false,
		required = false,
		id,
		name,
		onchange,
		class: className = ''
	}: SelectProps = $props();

	// Generate unique ID if not provided
	const selectId = $derived(id || `select-${Math.random().toString(36).substr(2, 9)}`);
	const hasError = $derived(!!error);

	let isOpen = $state(false);
	let selectElement: HTMLDivElement | null = $state(null);

	const selectedOption = $derived(
		options.find((opt) => opt.value === value) || { value: '', label: placeholder }
	);

	const handleSelect = (option: SelectOption) => {
		if (option.disabled) return;

		value = option.value;
		isOpen = false;

		if (onchange) {
			onchange(option.value);
		}
	};

	const toggleDropdown = () => {
		if (!disabled) {
			isOpen = !isOpen;
		}
	};

	const handleKeydown = (e: KeyboardEvent) => {
		if (disabled) return;

		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			toggleDropdown();
		} else if (e.key === 'Escape') {
			isOpen = false;
		} else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault();
			if (!isOpen) {
				isOpen = true;
			} else {
				// Navigate options
				const currentIndex = options.findIndex((opt) => opt.value === value);
				const nextIndex =
					e.key === 'ArrowDown'
						? Math.min(currentIndex + 1, options.length - 1)
						: Math.max(currentIndex - 1, 0);
				const nextOption = options[nextIndex];
				if (nextOption && !nextOption.disabled) {
					handleSelect(nextOption);
				}
			}
		}
	};

	// Close dropdown when clicking outside
	$effect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (selectElement && !selectElement.contains(e.target as Node)) {
				isOpen = false;
			}
		};

		if (isOpen) {
			document.addEventListener('click', handleClickOutside);
			return () => document.removeEventListener('click', handleClickOutside);
		}
	});
</script>

<div class="select-wrapper {className}" bind:this={selectElement}>
	{#if label}
		<label for={selectId} class="select-label">
			{label}
			{#if required}
				<span class="required" aria-label="required">*</span>
			{/if}
		</label>
	{/if}

	<div
		class="select-container"
		class:has-error={hasError}
		class:disabled
		class:open={isOpen}
	>
		<button
			type="button"
			id={selectId}
			{name}
			class="select-trigger"
			class:placeholder={!value}
			{disabled}
			aria-haspopup="listbox"
			aria-expanded={isOpen}
			aria-labelledby={label ? `${selectId}-label` : undefined}
			aria-invalid={hasError}
			onclick={toggleDropdown}
			onkeydown={handleKeydown}
		>
			<span class="select-value">{selectedOption.label}</span>
			<svg
				class="select-icon"
				class:rotate={isOpen}
				width="16"
				height="16"
				viewBox="0 0 16 16"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path
					d="M4 6L8 10L12 6"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
		</button>

		{#if isOpen}
			<div class="select-dropdown" role="listbox">
				{#each options as option (option.value)}
					<button
						type="button"
						class="select-option"
						class:selected={option.value === value}
						class:disabled={option.disabled}
						role="option"
						aria-selected={option.value === value}
						disabled={option.disabled}
						onclick={() => handleSelect(option)}
					>
						{option.label}
						{#if option.value === value}
							<svg
								class="check-icon"
								width="16"
								height="16"
								viewBox="0 0 16 16"
								fill="none"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path
									d="M13 4L6 11L3 8"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
							</svg>
						{/if}
					</button>
				{/each}
			</div>
		{/if}
	</div>

	{#if error}
		<p id="{selectId}-error" class="select-error" role="alert">
			{error}
		</p>
	{/if}
</div>

<style>
	.select-wrapper {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		width: 100%;
	}

	.select-label {
		display: block;
		font-size: var(--text-sm);
		font-weight: var(--font-weight-medium);
		color: var(--color-text-primary);
		line-height: var(--leading-snug);
	}

	.required {
		color: var(--color-error-500);
		margin-left: var(--space-1);
	}

	.select-container {
		position: relative;
		width: 100%;
	}

	.select-trigger {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		height: 40px;
		padding: var(--space-3) var(--space-4);
		font-family: var(--font-body);
		font-size: var(--text-base);
		font-weight: var(--font-weight-normal);
		color: var(--color-text-primary);
		text-align: left;
		background: var(--color-bg-primary);
		border: 1px solid var(--color-border-primary);
		border-radius: var(--radius-md);
		outline: none;
		cursor: pointer;
		transition: all var(--transition-fast);
		user-select: none;
	}

	.select-trigger.placeholder {
		color: var(--color-text-tertiary);
	}

	.select-trigger:hover:not(:disabled) {
		border-color: var(--color-border-secondary);
	}

	.select-trigger:focus,
	.select-container.open .select-trigger {
		border-color: var(--color-border-focus);
		box-shadow: var(--shadow-focus);
	}

	.select-trigger:disabled {
		background: var(--color-bg-tertiary);
		color: var(--color-text-disabled);
		cursor: not-allowed;
	}

	.select-container.has-error .select-trigger {
		border-color: var(--color-error-500);
	}

	.select-container.has-error .select-trigger:focus {
		border-color: var(--color-error-500);
		box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15);
	}

	.select-value {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.select-icon {
		flex-shrink: 0;
		color: var(--color-text-tertiary);
		transition: transform var(--transition-fast);
	}

	.select-icon.rotate {
		transform: rotate(180deg);
	}

	.select-dropdown {
		position: absolute;
		top: calc(100% + var(--space-2));
		left: 0;
		right: 0;
		z-index: var(--z-dropdown);
		max-height: 280px;
		overflow-y: auto;
		background: var(--color-bg-primary);
		border: 1px solid var(--color-border-primary);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-lg);
		animation: slideDown 0.2s ease-out;
	}

	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.select-option {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: var(--space-3) var(--space-4);
		font-family: var(--font-body);
		font-size: var(--text-base);
		color: var(--color-text-primary);
		text-align: left;
		background: transparent;
		border: none;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.select-option:hover:not(:disabled) {
		background: var(--color-bg-hover);
	}

	.select-option.selected {
		color: var(--color-primary-600);
		background: var(--color-primary-50);
	}

	.select-option.disabled {
		color: var(--color-text-disabled);
		cursor: not-allowed;
	}

	.check-icon {
		flex-shrink: 0;
		color: currentColor;
	}

	.select-error {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--color-error-500);
		line-height: var(--leading-snug);
	}

	/* Mobile: Increase touch target to 44px minimum for accessibility */
	@media (max-width: 640px) {
		.select-trigger {
			height: 44px;
		}
	}
</style>
