use std::sync::Arc;

use crate::{
    application::dtos::TransactionDto,
    domain::{
        entities::{
            ledger_entry::{EntryMetadata, LedgerEntry},
            transaction::Transaction,
            types::{Scope, TransactionType},
        },
        repositories::transaction_repository::{RepositoryError, TransactionRepository},
        value_objects::{Amount, Timestamp},
    },
};

/// Command to create a new transaction
///
/// This represents the user's intent to log a financial transaction.
/// All required fields must be provided, optional fields can be None.
#[derive(Debug, Clone)]
pub struct CreateTransactionCommand {
    /// Amount in cents (positive value)
    pub amount_cents: i64,

    /// Type of transaction: income or expense
    pub transaction_type: TransactionType,

    /// Scope: personal or business
    pub scope: Scope,

    /// Optional description of the transaction
    pub description: Option<String>,

    /// Optional category (e.g., "Food", "Transportation")
    pub category: Option<String>,

    /// Optional payment method (e.g., "Cash", "Credit Card")
    pub payment_method: Option<String>,

    /// Optional notes
    pub notes: Option<String>,

    /// Optional receipt image as Base64
    pub receipt_base64: Option<String>,

    /// When the transaction occurred (defaults to now if not provided)
    pub occurred_at: Option<Timestamp>,
}

/// Handler for CreateTransactionCommand
///
/// Orchestrates the creation of a transaction:
/// 1. Validates the command
/// 2. Creates domain entities (Transaction + LedgerEntry)
/// 3. Persists via repository
/// 4. Returns DTO for response
pub struct CreateTransactionHandler {
    repository: Arc<dyn TransactionRepository>,
}

impl CreateTransactionHandler {
    pub fn new(repository: Arc<dyn TransactionRepository>) -> Self {
        Self { repository }
    }

    pub async fn handle(&self, command: CreateTransactionCommand) -> Result<TransactionDto, RepositoryError> {
        // Create timestamp (use provided or current time)
        let occurred_at = command.occurred_at.unwrap_or_else(Timestamp::now);

        // Create transaction header
        let mut transaction = Transaction::new(
            command.description,
            occurred_at,
            command.scope,
        )?;

        // Create amount
        let amount = Amount::from_cents(command.amount_cents);

        // Create metadata
        let metadata = EntryMetadata::new(
            command.category,
            command.payment_method,
            command.notes,
            command.receipt_base64,
        )?;

        // Create ledger entry based on transaction type
        let entry = match command.transaction_type {
            TransactionType::Income => {
                LedgerEntry::new_income(*transaction.id(), amount, metadata)?
            }
            TransactionType::Expense => {
                LedgerEntry::new_expense(*transaction.id(), amount, metadata)?
            }
        };

        // Add entry to transaction
        transaction.add_entry(entry)?;

        // Persist to database
        self.repository.create(&transaction).await?;

        // Convert to DTO for response
        Ok(TransactionDto::from(&transaction))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infrastructure::persistence::{
        connection::create_test_pool,
        sqlite_transaction_repository::SqliteTransactionRepository,
    };

    #[tokio::test]
    async fn test_create_transaction_income() {
        let pool = create_test_pool().await.unwrap();
        let repo = Arc::new(SqliteTransactionRepository::new(Arc::new(pool)));
        let handler = CreateTransactionHandler::new(repo.clone());

        let command = CreateTransactionCommand {
            amount_cents: 5000,
            transaction_type: TransactionType::Income,
            scope: Scope::Business,
            description: Some("Freelance payment".to_string()),
            category: Some("Consulting".to_string()),
            payment_method: Some("Bank Transfer".to_string()),
            notes: Some("Project X completion".to_string()),
            receipt_base64: None,
            occurred_at: None,
        };

        let result = handler.handle(command).await.unwrap();

        assert_eq!(result.scope, "business");
        assert_eq!(result.status, "active");
        assert_eq!(result.description, Some("Freelance payment".to_string()));
        assert_eq!(result.entries.len(), 1);
        assert_eq!(result.entries[0].entry_type, "income");
        assert_eq!(result.entries[0].amount_cents, 5000);
        assert_eq!(result.total_amount_cents, 5000);  // Income is positive
    }

    #[tokio::test]
    async fn test_create_transaction_expense() {
        let pool = create_test_pool().await.unwrap();
        let repo = Arc::new(SqliteTransactionRepository::new(Arc::new(pool)));
        let handler = CreateTransactionHandler::new(repo.clone());

        let command = CreateTransactionCommand {
            amount_cents: 1500,
            transaction_type: TransactionType::Expense,
            scope: Scope::Personal,
            description: Some("Grocery shopping".to_string()),
            category: Some("Food".to_string()),
            payment_method: Some("Credit Card".to_string()),
            notes: None,
            receipt_base64: None,
            occurred_at: None,
        };

        let result = handler.handle(command).await.unwrap();

        assert_eq!(result.scope, "personal");
        assert_eq!(result.entries[0].entry_type, "expense");
        assert_eq!(result.total_amount_cents, -1500);  // Expense is negative
    }

    #[tokio::test]
    async fn test_create_transaction_persisted() {
        let pool = create_test_pool().await.unwrap();
        let repo = Arc::new(SqliteTransactionRepository::new(Arc::new(pool)));
        let handler = CreateTransactionHandler::new(repo.clone());

        let command = CreateTransactionCommand {
            amount_cents: 2000,
            transaction_type: TransactionType::Expense,
            scope: Scope::Personal,
            description: Some("Test".to_string()),
            category: None,
            payment_method: None,
            notes: None,
            receipt_base64: None,
            occurred_at: None,
        };

        let created = handler.handle(command).await.unwrap();

        // Verify it was persisted by retrieving it
        let tx_id = crate::domain::value_objects::TransactionId::from_string(&created.id).unwrap();
        let retrieved = repo.find_by_id(&tx_id).await.unwrap();

        assert!(retrieved.is_some());
        let retrieved_tx = retrieved.unwrap();
        assert_eq!(retrieved_tx.id().to_string(), created.id);
        assert!(retrieved_tx.has_entries());
    }
}
