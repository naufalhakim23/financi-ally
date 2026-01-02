<script lang="ts">
	/**
	 * Input Component - Clean, Notion-style input field
	 * Supports text, number, date with excellent focus states
	 */

	type InputType = 'text' | 'number' | 'date' | 'email' | 'password' | 'tel' | 'url';

	interface InputProps {
		type?: InputType;
		value?: string | number;
		label?: string;
		placeholder?: string;
		error?: string;
		disabled?: boolean;
		required?: boolean;
		readonly?: boolean;
		id?: string;
		name?: string;
		min?: number | string;
		max?: number | string;
		step?: number | string;
		maxlength?: number;
		oninput?: (event: Event) => void;
		onchange?: (event: Event) => void;
		onfocus?: (event: FocusEvent) => void;
		onblur?: (event: FocusEvent) => void;
		class?: string;
		prefixIcon?: any;
		suffixIcon?: any;
	}

	let {
		type = 'text',
		value = $bindable(),
		label,
		placeholder,
		error,
		disabled = false,
		required = false,
		readonly = false,
		id,
		name,
		min,
		max,
		step,
		maxlength,
		oninput,
		onchange,
		onfocus,
		onblur,
		class: className = '',
		prefixIcon,
		suffixIcon
	}: InputProps = $props();

	// Generate unique ID if not provided
	const inputId = $derived(id || `input-${Math.random().toString(36).substr(2, 9)}`);
	const hasError = $derived(!!error);
</script>

<div class="input-wrapper {className}">
	{#if label}
		<label for={inputId} class="input-label">
			{label}
			{#if required}
				<span class="required" aria-label="required">*</span>
			{/if}
		</label>
	{/if}

	<div class="input-container" class:has-error={hasError} class:disabled>
		{#if prefixIcon}
			<span class="input-icon input-prefix">
				{@render prefixIcon()}
			</span>
		{/if}

		<input
			{type}
			bind:value
			id={inputId}
			{name}
			{placeholder}
			{disabled}
			{required}
			{readonly}
			{min}
			{max}
			{step}
			{maxlength}
			class="input"
			class:has-prefix={prefixIcon}
			class:has-suffix={suffixIcon}
			aria-invalid={hasError}
			aria-describedby={error ? `${inputId}-error` : undefined}
			{oninput}
			{onchange}
			{onfocus}
			{onblur}
		/>

		{#if suffixIcon}
			<span class="input-icon input-suffix">
				{@render suffixIcon()}
			</span>
		{/if}
	</div>

	{#if error}
		<p id="{inputId}-error" class="input-error" role="alert">
			{error}
		</p>
	{/if}
</div>

<style>
	.input-wrapper {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		width: 100%;
	}

	.input-label {
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

	.input-container {
		position: relative;
		display: flex;
		align-items: center;
		width: 100%;
	}

	.input {
		width: 100%;
		height: 40px;
		padding: var(--space-3) var(--space-4);
		font-family: var(--font-body);
		font-size: var(--text-base);
		font-weight: var(--font-weight-normal);
		color: var(--color-text-primary);
		background: var(--color-bg-primary);
		border: 1px solid var(--color-border-primary);
		border-radius: var(--radius-md);
		outline: none;
		transition: all var(--transition-fast);
	}

	/* Mobile: Increase touch target to 44px minimum for accessibility */
	@media (max-width: 640px) {
		.input {
			height: 44px;
		}
	}

	.input.has-prefix {
		padding-left: var(--space-10);
	}

	.input.has-suffix {
		padding-right: var(--space-10);
	}

	.input::placeholder {
		color: var(--color-text-tertiary);
	}

	.input:hover:not(:disabled):not(:focus) {
		border-color: var(--color-border-secondary);
	}

	.input:focus {
		border-color: var(--color-border-focus);
		box-shadow: var(--shadow-focus);
	}

	.input:disabled {
		background: var(--color-bg-tertiary);
		color: var(--color-text-disabled);
		cursor: not-allowed;
	}

	.input-container.has-error .input {
		border-color: var(--color-error-500);
	}

	.input-container.has-error .input:focus {
		border-color: var(--color-error-500);
		box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15);
	}

	.input-icon {
		position: absolute;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-text-tertiary);
		pointer-events: none;
	}

	.input-prefix {
		left: var(--space-4);
	}

	.input-suffix {
		right: var(--space-4);
	}

	.input-container.disabled .input-icon {
		color: var(--color-text-disabled);
	}

	.input-error {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--color-error-500);
		line-height: var(--leading-snug);
	}

	/* Number input - hide spinners for cleaner look */
	input[type='number']::-webkit-inner-spin-button,
	input[type='number']::-webkit-outer-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	input[type='number'] {
		-moz-appearance: textfield;
	}
</style>
