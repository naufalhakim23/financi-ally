use std::sync::Arc;

use crate::{
    application::dtos::TransactionDto,
    domain::{
        entities::{
            ledger_entry::{EntryMetadata, LedgerEntry},
            transaction::Transaction,
            types::{Scope, TransactionType},
        },
        repositories::{
            pocket_repository::PocketRepository,
            transaction_repository::{RepositoryError, TransactionRepository},
        },
        value_objects::{Amount, Timestamp, TransactionId},
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

    /// The pocket this transaction belongs to (required)
    pub pocket_id: String,

    /// Optional description of the transaction
    pub description: Option<String>,

    /// Optional category ID (new system, preferred over free-text category)
    pub category_id: Option<String>,

    /// Optional category (e.g., "Food", "Transportation") - legacy free-text
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
/// 1. Validates the command (including pocket existence)
/// 2. Creates domain entities (Transaction + LedgerEntry)
/// 3. Persists via repository
/// 4. Returns DTO for response
pub struct CreateTransactionHandler {
    transaction_repo: Arc<dyn TransactionRepository>,
    pocket_repo: Arc<dyn PocketRepository>,
}

impl CreateTransactionHandler {
    pub fn new(
        transaction_repo: Arc<dyn TransactionRepository>,
        pocket_repo: Arc<dyn PocketRepository>,
    ) -> Self {
        Self {
            transaction_repo,
            pocket_repo,
        }
    }

    pub async fn handle(
        &self,
        command: CreateTransactionCommand,
    ) -> Result<TransactionDto, RepositoryError> {
        // Parse and validate pocket ID
        let pocket_id = TransactionId::from_string(&command.pocket_id)?;

        // Verify pocket exists
        let _pocket = self
            .pocket_repo
            .find_by_id(&pocket_id)
            .await?
            .ok_or_else(|| {
                RepositoryError::ValidationError(format!(
                    "Pocket with id {} not found",
                    command.pocket_id
                ))
            })?;

        // TODO: Future enhancement - validate currency match
        // if transaction has currency info, ensure it matches pocket.currency()

        // Create timestamp (use provided or current time)
        let occurred_at = command.occurred_at.unwrap_or_else(Timestamp::now);

        // Create transaction header with pocket_id
        let mut transaction =
            Transaction::new(command.description, occurred_at, command.scope, pocket_id)?;

        // Create amount
        let amount = Amount::from_cents(command.amount_cents);

        // Parse category_id if provided
        let category_id = if let Some(cat_id_str) = command.category_id {
            Some(TransactionId::from_string(&cat_id_str)?)
        } else {
            None
        };

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
                LedgerEntry::new_income(*transaction.id(), amount, metadata, category_id)?
            }
            TransactionType::Expense => {
                LedgerEntry::new_expense(*transaction.id(), amount, metadata, category_id)?
            }
        };

        // Add entry to transaction
        transaction.add_entry(entry)?;

        // Persist to database
        self.transaction_repo.create(&transaction).await?;

        // Recompute pocket balance after transaction creation
        self.pocket_repo.recompute_balance(&pocket_id).await?;

        // Convert to DTO for response
        Ok(TransactionDto::from(&transaction))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infrastructure::persistence::{
        connection::create_test_pool,
        sqlite_pocket_repository::SqlitePocketRepository,
        sqlite_transaction_repository::SqliteTransactionRepository,
    };

    #[tokio::test]
    async fn test_create_transaction_income() {
        let pool = create_test_pool().await.unwrap();
        let transaction_repo = Arc::new(SqliteTransactionRepository::new(Arc::new(pool.clone())));
        let pocket_repo = Arc::new(SqlitePocketRepository::new(Arc::new(pool.clone())));
        let handler = CreateTransactionHandler::new(transaction_repo.clone(), pocket_repo.clone());

        // Get default pocket from migration
        let default_pocket = pocket_repo.find_default().await.unwrap().unwrap();

        let command = CreateTransactionCommand {
            amount_cents: 5000,
            transaction_type: TransactionType::Income,
            scope: Scope::Business,
            pocket_id: default_pocket.id().to_string(),
            description: Some("Freelance payment".to_string()),
            category: Some("Consulting".to_string()),
            payment_method: Some("Bank Transfer".to_string()),
            notes: Some("Project X completion".to_string()),
            receipt_base64: None,
            category_id: None,
            occurred_at: None,
        };

        let result = handler.handle(command).await.unwrap();

        assert_eq!(result.scope, "business");
        assert_eq!(result.status, "active");
        assert_eq!(result.description, Some("Freelance payment".to_string()));
        assert_eq!(result.pocket_id, default_pocket.id().to_string());
        assert_eq!(result.entries.len(), 1);
        assert_eq!(result.entries[0].entry_type, "income");
        assert_eq!(result.entries[0].amount_cents, 5000);
        assert_eq!(result.total_amount_cents, 5000); // Income is positive
    }

    #[tokio::test]
    async fn test_create_transaction_expense() {
        let pool = create_test_pool().await.unwrap();
        let transaction_repo = Arc::new(SqliteTransactionRepository::new(Arc::new(pool.clone())));
        let pocket_repo = Arc::new(SqlitePocketRepository::new(Arc::new(pool.clone())));
        let handler = CreateTransactionHandler::new(transaction_repo.clone(), pocket_repo.clone());

        // Get default pocket from migration
        let default_pocket = pocket_repo.find_default().await.unwrap().unwrap();

        let command = CreateTransactionCommand {
            amount_cents: 1500,
            transaction_type: TransactionType::Expense,
            scope: Scope::Personal,
            pocket_id: default_pocket.id().to_string(),
            description: Some("Grocery shopping".to_string()),
            category: Some("Food".to_string()),
            payment_method: Some("Credit Card".to_string()),
            notes: None,
            receipt_base64: None,
            category_id: None,
            occurred_at: None,
        };

        let result = handler.handle(command).await.unwrap();

        assert_eq!(result.scope, "personal");
        assert_eq!(result.entries[0].entry_type, "expense");
        assert_eq!(result.total_amount_cents, -1500); // Expense is negative
    }

    #[tokio::test]
    async fn test_create_transaction_persisted() {
        let pool = create_test_pool().await.unwrap();
        let transaction_repo = Arc::new(SqliteTransactionRepository::new(Arc::new(pool.clone())));
        let pocket_repo = Arc::new(SqlitePocketRepository::new(Arc::new(pool.clone())));
        let handler = CreateTransactionHandler::new(transaction_repo.clone(), pocket_repo.clone());

        // Get default pocket from migration
        let default_pocket = pocket_repo.find_default().await.unwrap().unwrap();

        let command = CreateTransactionCommand {
            amount_cents: 2000,
            transaction_type: TransactionType::Expense,
            scope: Scope::Personal,
            pocket_id: default_pocket.id().to_string(),
            description: Some("Test".to_string()),
            category: None,
            payment_method: None,
            notes: None,
            receipt_base64: None,
            category_id: None,
            occurred_at: None,
        };

        let created = handler.handle(command).await.unwrap();

        // Verify it was persisted by retrieving it
        let tx_id = TransactionId::from_string(&created.id).unwrap();
        let retrieved = transaction_repo.find_by_id(&tx_id).await.unwrap();

        assert!(retrieved.is_some());
        let retrieved_tx = retrieved.unwrap();
        assert_eq!(retrieved_tx.id().to_string(), created.id);
        assert!(retrieved_tx.has_entries());
    }

    #[tokio::test]
    async fn test_create_transaction_updates_pocket_balance() {
        let pool = create_test_pool().await.unwrap();
        let transaction_repo = Arc::new(SqliteTransactionRepository::new(Arc::new(pool.clone())));
        let pocket_repo = Arc::new(SqlitePocketRepository::new(Arc::new(pool.clone())));
        let handler = CreateTransactionHandler::new(transaction_repo.clone(), pocket_repo.clone());

        // Get default pocket — balance should be 0
        let default_pocket = pocket_repo.find_default().await.unwrap().unwrap();
        assert_eq!(default_pocket.current_balance_cents(), 0);

        // Create income transaction: +5000
        let cmd1 = CreateTransactionCommand {
            amount_cents: 5000,
            transaction_type: TransactionType::Income,
            scope: Scope::Personal,
            pocket_id: default_pocket.id().to_string(),
            description: Some("Salary".to_string()),
            category: None, category_id: None, payment_method: None,
            notes: None, receipt_base64: None, occurred_at: None,
        };
        handler.handle(cmd1).await.unwrap();

        // Check balance updated to +5000
        let pocket = pocket_repo.find_by_id(default_pocket.id()).await.unwrap().unwrap();
        assert_eq!(pocket.current_balance_cents(), 5000);

        // Create expense transaction: -1500
        let cmd2 = CreateTransactionCommand {
            amount_cents: 1500,
            transaction_type: TransactionType::Expense,
            scope: Scope::Personal,
            pocket_id: default_pocket.id().to_string(),
            description: Some("Groceries".to_string()),
            category: None, category_id: None, payment_method: None,
            notes: None, receipt_base64: None, occurred_at: None,
        };
        handler.handle(cmd2).await.unwrap();

        // Check balance: 5000 - 1500 = 3500
        let pocket = pocket_repo.find_by_id(default_pocket.id()).await.unwrap().unwrap();
        assert_eq!(pocket.current_balance_cents(), 3500);
    }
}
