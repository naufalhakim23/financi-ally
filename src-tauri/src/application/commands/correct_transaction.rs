use std::sync::Arc;

use crate::{
    application::dtos::TransactionDto,
    domain::{
        entities::{correction::CorrectionData, ledger_entry::EntryMetadata},
        repositories::{
            pocket_repository::PocketRepository,
            transaction_repository::{RepositoryError, TransactionRepository},
        },
        services::CorrectionService,
        value_objects::{Amount, TransactionId},
    },
};

/// Command to correct a ledger entry
///
/// This creates a correction via the immutable ledger pattern:
/// 1. Creates a reversal entry (negates original)
/// 2. Creates a new corrected entry (with new data)
/// 3. Marks the transaction as corrected
///
/// Both entries must be persisted atomically
#[derive(Debug, Clone)]
pub struct CorrectTransactionCommand {
    /// ID of the transaction containing the entry to correct
    pub transaction_id: String,

    /// ID of the specific entry to correct
    pub entry_id: String,

    /// New corrected amount in cents
    pub new_amount_cents: i64,

    /// New or updated category
    pub new_category: Option<String>,

    /// New or updated payment method
    pub new_payment_method: Option<String>,

    /// New or updated notes
    pub new_notes: Option<String>,

    /// New or updated receipt (Base64)
    pub new_receipt_base64: Option<String>,
}

/// Handler for CorrectTransactionCommand
pub struct CorrectTransactionHandler {
    repository: Arc<dyn TransactionRepository>,
    pocket_repo: Arc<dyn PocketRepository>,
}

impl CorrectTransactionHandler {
    pub fn new(repository: Arc<dyn TransactionRepository>, pocket_repo: Arc<dyn PocketRepository>) -> Self {
        Self { repository, pocket_repo }
    }

    pub async fn handle(
        &self,
        command: CorrectTransactionCommand,
    ) -> Result<TransactionDto, RepositoryError> {
        // Parse IDs
        let tx_id = TransactionId::from_string(&command.transaction_id)?;
        let entry_id = TransactionId::from_string(&command.entry_id)?;

        // Retrieve the transaction
        let transaction = self
            .repository
            .find_by_id(&tx_id)
            .await?
            .ok_or_else(|| RepositoryError::NotFound(format!("Transaction {} not found", tx_id)))?;

        // Find the entry to correct
        let original_entry = transaction
            .entries()
            .iter()
            .find(|e| e.id() == &entry_id)
            .ok_or_else(|| {
                RepositoryError::NotFound(format!("Entry {} not found in transaction", entry_id))
            })?;

        // Validate that entry can be corrected
        if !CorrectionService::can_correct(original_entry) {
            return Err(RepositoryError::ValidationError(
                "Cannot correct a correction entry".to_string(),
            ));
        }

        // Create correction data
        let new_amount = Amount::from_cents(command.new_amount_cents);
        let new_metadata = EntryMetadata::new(
            command.new_category,
            command.new_payment_method,
            command.new_notes,
            command.new_receipt_base64,
        )
        .map_err(|e| RepositoryError::ValidationError(e.to_string()))?;

        let correction_data = CorrectionData::new(new_amount, new_metadata);

        // Generate correction (reversal + corrected entries)
        let correction_result = CorrectionService::create_correction(original_entry, correction_data)
            .map_err(|e| RepositoryError::ValidationError(e.to_string()))?;

        // Persist correction atomically (repository handles transaction)
        self.repository
            .apply_correction(&tx_id, correction_result)
            .await?;

        // Recompute pocket balance after correction
        self.pocket_repo.recompute_balance(transaction.pocket_id()).await?;

        // Retrieve updated transaction
        let updated_transaction = self
            .repository
            .find_by_id(&tx_id)
            .await?
            .ok_or_else(|| {
                RepositoryError::DatabaseError(
                    "Transaction disappeared after correction".to_string(),
                )
            })?;

        // Convert to DTO
        Ok(TransactionDto::from(&updated_transaction))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        application::commands::{CreatePocketCommand, CreatePocketHandler, CreateTransactionCommand, CreateTransactionHandler},
        domain::entities::types::{Scope, TransactionType},
        infrastructure::persistence::{
            connection::create_test_pool,
            sqlite_pocket_repository::SqlitePocketRepository,
            sqlite_transaction_repository::SqliteTransactionRepository,
        },
    };

    /// Helper to create test pocket and return pocket_id
    async fn create_test_pocket(pocket_repo: Arc<dyn crate::domain::repositories::pocket_repository::PocketRepository>) -> String {
        let create_pocket_handler = CreatePocketHandler::new(pocket_repo.clone());
        let create_pocket_cmd = CreatePocketCommand {
            name: "Test Wallet".to_string(),
            currency: "USD".to_string(),
            description: Some("Test pocket".to_string()),
            icon: Some("💰".to_string()),
            color: "#4299E1".to_string(),
            initial_balance_cents: 0,
        };
        let pocket_dto = create_pocket_handler.handle(create_pocket_cmd).await.unwrap();
        pocket_dto.id.to_string()
    }

    #[tokio::test]
    async fn test_correct_transaction_amount() {
        let pool = create_test_pool().await.unwrap();
        let tx_repo = Arc::new(SqliteTransactionRepository::new(Arc::new(pool.clone())));
        let pocket_repo = Arc::new(SqlitePocketRepository::new(Arc::new(pool)));

        // Create test pocket
        let pocket_id = create_test_pocket(pocket_repo.clone()).await;

        // Create a transaction first
        let create_handler = CreateTransactionHandler::new(tx_repo.clone(), pocket_repo.clone());
        let create_cmd = CreateTransactionCommand {
            amount_cents: 1000,
            transaction_type: TransactionType::Expense,
            scope: Scope::Personal,
            pocket_id: pocket_id.clone(),
            description: Some("Original transaction".to_string()),
            category_id: None,
            category: Some("Food".to_string()),
            payment_method: Some("Cash".to_string()),
            notes: Some("Original notes".to_string()),
            receipt_base64: None,
            occurred_at: None,
        };
        let created = create_handler.handle(create_cmd).await.unwrap();

        // Extract entry ID
        let entry_id = created.entries[0].id.clone();

        // Correct the transaction
        let correct_handler = CorrectTransactionHandler::new(tx_repo.clone(), pocket_repo.clone());
        let correct_cmd = CorrectTransactionCommand {
            transaction_id: created.id.clone(),
            entry_id,
            new_amount_cents: 1200, // Changed from 1000
            new_category: Some("Food".to_string()),
            new_payment_method: Some("Cash".to_string()),
            new_notes: Some("Corrected notes".to_string()),
            new_receipt_base64: None,
        };

        let result = correct_handler.handle(correct_cmd).await.unwrap();

        // Verify correction
        assert_eq!(result.status, "corrected");
        assert_eq!(result.entries.len(), 3); // Original + reversal + corrected

        // Find correction entries
        let correction_entries: Vec<_> = result
            .entries
            .iter()
            .filter(|e| e.is_correction)
            .collect();
        assert_eq!(correction_entries.len(), 2); // Reversal + corrected

        // Total should be new amount (original negated by reversal, then new amount added)
        assert_eq!(result.total_amount_cents, -1200);
    }

    #[tokio::test]
    async fn test_correct_transaction_metadata() {
        let pool = create_test_pool().await.unwrap();
        let tx_repo = Arc::new(SqliteTransactionRepository::new(Arc::new(pool.clone())));
        let pocket_repo = Arc::new(SqlitePocketRepository::new(Arc::new(pool)));

        // Create test pocket
        let pocket_id = create_test_pocket(pocket_repo.clone()).await;

        // Create transaction
        let create_handler = CreateTransactionHandler::new(tx_repo.clone(), pocket_repo.clone());
        let create_cmd = CreateTransactionCommand {
            amount_cents: 500,
            transaction_type: TransactionType::Income,
            scope: Scope::Business,
            pocket_id: pocket_id.clone(),
            description: Some("Payment".to_string()),
            category_id: None,
            category: Some("Consulting".to_string()),
            payment_method: Some("Bank Transfer".to_string()),
            notes: None,
            receipt_base64: None,
            occurred_at: None,
        };
        let created = create_handler.handle(create_cmd).await.unwrap();
        let entry_id = created.entries[0].id.clone();

        // Correct metadata only
        let correct_handler = CorrectTransactionHandler::new(tx_repo, pocket_repo);
        let correct_cmd = CorrectTransactionCommand {
            transaction_id: created.id.clone(),
            entry_id,
            new_amount_cents: 500, // Same amount
            new_category: Some("Freelance".to_string()), // Changed category
            new_payment_method: Some("PayPal".to_string()), // Changed payment method
            new_notes: Some("Corrected payment details".to_string()),
            new_receipt_base64: None,
        };

        let result = correct_handler.handle(correct_cmd).await.unwrap();

        assert_eq!(result.status, "corrected");

        // Find the corrected entry
        let corrected_entry = result
            .entries
            .iter()
            .find(|e| e.is_correction && e.amount_cents > 0)
            .unwrap();

        assert_eq!(
            corrected_entry.metadata.category,
            Some("Freelance".to_string())
        );
        assert_eq!(
            corrected_entry.metadata.payment_method,
            Some("PayPal".to_string())
        );
    }

    #[tokio::test]
    async fn test_cannot_correct_nonexistent_transaction() {
        let pool = create_test_pool().await.unwrap();
        let tx_repo = Arc::new(SqliteTransactionRepository::new(Arc::new(pool.clone())));
        let pocket_repo = Arc::new(SqlitePocketRepository::new(Arc::new(pool)));
        let handler = CorrectTransactionHandler::new(tx_repo, pocket_repo);

        let fake_tx_id = TransactionId::new();
        let fake_entry_id = TransactionId::new();

        let cmd = CorrectTransactionCommand {
            transaction_id: fake_tx_id.to_string(),
            entry_id: fake_entry_id.to_string(),
            new_amount_cents: 100,
            new_category: None,
            new_payment_method: None,
            new_notes: None,
            new_receipt_base64: None,
        };

        let result = handler.handle(cmd).await;
        assert!(result.is_err());
    }
}
