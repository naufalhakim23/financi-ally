<script lang="ts">
	// Props
	let { receiptBase64 = $bindable() }: { receiptBase64?: string } = $props();

	// State
	let fileInput: HTMLInputElement | null = $state(null);
	let previewUrl = $state<string | null>(null);
	let isProcessing = $state(false);
	let error = $state<string | null>(null);

	// Update preview when receiptBase64 changes from parent
	$effect(() => {
		if (receiptBase64) {
			previewUrl = `data:image/jpeg;base64,${receiptBase64}`;
		} else {
			previewUrl = null;
		}
	});

	/**
	 * Handle file selection
	 */
	async function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];

		if (!file) return;

		// Validate file type
		if (!file.type.startsWith('image/')) {
			error = 'Please select an image file (JPG, PNG, etc.)';
			return;
		}

		// Validate file size (max 5MB)
		const maxSize = 5 * 1024 * 1024; // 5MB
		if (file.size > maxSize) {
			error = 'Image must be smaller than 5MB';
			return;
		}

		error = null;
		isProcessing = true;

		try {
			// Convert to Base64
			const base64 = await fileToBase64(file);

			// Remove the data URL prefix (data:image/jpeg;base64,)
			const base64Data = base64.split(',')[1];

			receiptBase64 = base64Data;
			previewUrl = base64;
		} catch (err) {
			error = 'Failed to process image. Please try again.';
			console.error('Image processing error:', err);
		} finally {
			isProcessing = false;
		}
	}

	/**
	 * Convert file to Base64
	 */
	function fileToBase64(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as string);
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	}

	/**
	 * Clear receipt
	 */
	function clearReceipt() {
		receiptBase64 = undefined;
		previewUrl = null;
		error = null;
		if (fileInput) {
			fileInput.value = '';
		}
	}

	/**
	 * Trigger file input click
	 */
	function triggerFileInput() {
		fileInput?.click();
	}
</script>

<div class="receipt-upload">
	<label class="upload-label">Receipt (Optional)</label>

	{#if previewUrl}
		<!-- Receipt Preview -->
		<div class="receipt-preview">
			<img src={previewUrl} alt="Receipt preview" class="preview-image" />
			<div class="preview-overlay">
				<button class="btn-clear" onclick={clearReceipt} type="button"> ✕ Remove </button>
			</div>
		</div>
	{:else}
		<!-- Upload Button -->
		<button class="upload-button" onclick={triggerFileInput} type="button" disabled={isProcessing}>
			{#if isProcessing}
				⏳ Processing...
			{:else}
				📷 Upload Receipt
			{/if}
		</button>
	{/if}

	<!-- Hidden file input -->
	<input
		bind:this={fileInput}
		type="file"
		accept="image/*"
		onchange={handleFileSelect}
		class="file-input"
	/>

	<!-- Error message -->
	{#if error}
		<p class="error-message">{error}</p>
	{/if}

	<!-- Help text -->
	{#if !previewUrl && !error}
		<p class="help-text">Attach a photo of your receipt (max 5MB)</p>
	{/if}
</div>

<style>
	.receipt-upload {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.upload-label {
		display: block;
		font-weight: var(--font-weight-medium);
		color: var(--color-text-primary);
		font-size: var(--text-sm);
	}

	.upload-button {
		width: 100%;
		padding: var(--space-4);
		background: var(--color-bg-secondary);
		border: 2px dashed var(--color-border-primary);
		border-radius: var(--radius-md);
		color: var(--color-text-secondary);
		font-size: var(--text-base);
		font-family: var(--font-body);
		font-weight: var(--font-weight-medium);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.upload-button:hover:not(:disabled) {
		background: var(--color-bg-hover);
		border-color: var(--color-primary-500);
		color: var(--color-primary-600);
	}

	.upload-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.file-input {
		display: none;
	}

	.receipt-preview {
		position: relative;
		border-radius: var(--radius-md);
		overflow: hidden;
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border-primary);
	}

	.preview-image {
		width: 100%;
		height: auto;
		max-height: 300px;
		object-fit: contain;
		display: block;
	}

	.preview-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		transition: opacity var(--transition-fast);
	}

	.receipt-preview:hover .preview-overlay {
		opacity: 1;
	}

	.btn-clear {
		padding: var(--space-3) var(--space-6);
		background: var(--color-bg-primary);
		color: var(--color-error-600);
		border: 1px solid var(--color-error-600);
		border-radius: var(--radius-md);
		font-weight: var(--font-weight-medium);
		font-family: var(--font-body);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.btn-clear:hover {
		background: var(--color-error-600);
		color: var(--color-bg-primary);
	}

	.error-message {
		margin: 0;
		padding: var(--space-3);
		background: var(--color-error-100);
		color: var(--color-error-700);
		border-radius: var(--radius-md);
		font-size: var(--text-sm);
		border: 1px solid var(--color-error-200);
	}

	.help-text {
		margin: 0;
		font-size: var(--text-xs);
		color: var(--color-text-tertiary);
	}
</style>
