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
		gap: 0.5rem;
	}

	.upload-label {
		display: block;
		font-weight: 500;
		color: #4a5568;
		font-size: 0.875rem;
	}

	.upload-button {
		width: 100%;
		padding: 1rem;
		background: #f7fafc;
		border: 2px dashed #cbd5e0;
		border-radius: 8px;
		color: #4a5568;
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
	}

	.upload-button:hover:not(:disabled) {
		background: #edf2f7;
		border-color: #8b5cf6;
		color: #8b5cf6;
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
		border-radius: 8px;
		overflow: hidden;
		background: #f7fafc;
		border: 1px solid #e2e8f0;
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
		background: rgba(0, 0, 0, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		transition: opacity 0.2s;
	}

	.receipt-preview:hover .preview-overlay {
		opacity: 1;
	}

	.btn-clear {
		padding: 0.75rem 1.5rem;
		background: white;
		color: #e53e3e;
		border: 1px solid #e53e3e;
		border-radius: 6px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-clear:hover {
		background: #e53e3e;
		color: white;
	}

	.error-message {
		margin: 0;
		padding: 0.5rem;
		background: #fed7d7;
		color: #742a2a;
		border-radius: 4px;
		font-size: 0.875rem;
	}

	.help-text {
		margin: 0;
		font-size: 0.75rem;
		color: #a0aec0;
	}
</style>
