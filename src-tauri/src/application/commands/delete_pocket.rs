use std::sync::Arc;

use crate::domain::{
    repositories::pocket_repository::PocketRepository,
    repositories::transaction_repository::{RepositoryError, TransactionRepository},
    value_objects::TransactionId,
};

/// Command to soft-delete a pocket
///
/// Business Rule: Can only delete pockets that have no transactions
#[derive(Debug, Clone)]
pub struct DeletePocketCommand {
    pub pocket_id: String,
}

/// Handler for DeletePocketCommand
pub struct DeletePocketHandler {
    pocket_repo: Arc<dyn PocketRepository>,
    transaction_repo: Arc<dyn TransactionRepository>,
}

impl DeletePocketHandler {
    /// Create a new handler
    pub fn new(
        pocket_repo: Arc<dyn PocketRepository>,
        transaction_repo: Arc<dyn TransactionRepository>,
    ) -> Self {
        Self {
            pocket_repo,
            transaction_repo,
        }
    }

    /// Execute the command to delete a pocket
    ///
    /// # Arguments
    /// * `command` - The delete pocket command
    ///
    /// # Returns
    /// * `Ok(())` - If pocket was successfully deleted
    /// * `Err(RepositoryError)` - If pocket has transactions or not found
    pub async fn handle(&self, command: DeletePocketCommand) -> Result<(), RepositoryError> {
        // Parse pocket ID
        let pocket_id = TransactionId::from_string(&command.pocket_id)?;

        // Verify pocket exists
        let pocket = self
            .pocket_repo
            .find_by_id(&pocket_id)
            .await?
            .ok_or_else(|| {
                RepositoryError::NotFound(format!(
                    "Pocket with id {} not found",
                    command.pocket_id
                ))
            })?;

        // Check if pocket is default - prevent deletion of default pocket
        if pocket.is_default() {
            return Err(RepositoryError::ValidationError(
                "Cannot delete the default pocket. Set another pocket as default first."
                    .to_string(),
            ));
        }

        // Check if pocket has any transactions
        // For now, get all transactions and filter by pocket_id in memory
        // TODO: Add pocket_id filter to TransactionRepository::list_with_filters for efficiency
        let all_transactions = self.transaction_repo.list(1000, 0).await?;

        let transactions_in_pocket: Vec<_> = all_transactions
            .iter()
            .filter(|tx| tx.pocket_id() == &pocket_id)
            .collect();

        if !transactions_in_pocket.is_empty() {
            return Err(RepositoryError::ValidationError(format!(
                "Cannot delete pocket '{}' because it has {} transaction(s). \
                 Move or delete transactions first.",
                pocket.name(),
                transactions_in_pocket.len()
            )));
        }

        // Perform soft delete
        self.pocket_repo.soft_delete(&pocket_id).await?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        domain::{
            entities::{ledger_entry::EntryMetadata, Pocket, Transaction},
            value_objects::{Amount, Currency, Timestamp},
        },
        infrastructure::persistence::{
            schema::run_migrations, sqlite_pocket_repository::SqlitePocketRepository,
            sqlite_transaction_repository::SqliteTransactionRepository,
        },
    };
    use sqlx::SqlitePool;

    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        run_migrations(&pool).await.unwrap();
        pool
    }

    #[tokio::test]
    async fn test_delete_pocket_success() {
        let pool = setup_test_db().await;
        let pocket_repo = Arc::new(SqlitePocketRepository::new(Arc::new(pool.clone())));
        let transaction_repo = Arc::new(SqliteTransactionRepository::new(Arc::new(pool)));
        let handler = DeletePocketHandler::new(pocket_repo.clone(), transaction_repo);

        // Create a pocket
        let pocket = Pocket::new(
            "To Delete".to_string(),
            Currency::from_code("USD").unwrap(),
            None,
            None,
            "#000000".to_string(),
            0,
        )
        .unwrap();

        let pocket_id = pocket.id().clone();
        pocket_repo.create(&pocket).await.unwrap();

        // Delete it
        let command = DeletePocketCommand {
            pocket_id: pocket_id.to_string(),
        };

        let result = handler.handle(command).await;
        assert!(result.is_ok());

        // Verify it's gone
        let found = pocket_repo.find_by_id(&pocket_id).await.unwrap();
        assert!(found.is_none());
    }

    #[tokio::test]
    async fn test_delete_pocket_with_transactions() {
        let pool = setup_test_db().await;
        let pocket_repo = Arc::new(SqlitePocketRepository::new(Arc::new(pool.clone())));
        let transaction_repo = Arc::new(SqliteTransactionRepository::new(Arc::new(pool)));
        let handler = DeletePocketHandler::new(pocket_repo.clone(), transaction_repo.clone());

        // Create a pocket
        let pocket = Pocket::new(
            "Has Transactions".to_string(),
            Currency::from_code("EUR").unwrap(),
            None,
            None,
            "#FF0000".to_string(),
            0,
        )
        .unwrap();

        let pocket_id = pocket.id().clone();
        pocket_repo.create(&pocket).await.unwrap();

        // Create a transaction in this pocket
        let mut tx = Transaction::new(
            Some("Test".to_string()),
            Timestamp::now(),
            crate::domain::entities::types::Scope::Personal,
            pocket_id.clone(),
        )
        .unwrap();

        let entry = crate::domain::entities::LedgerEntry::new_expense(
            *tx.id(),
            Amount::from_cents(100),
            EntryMetadata::empty(),
        )
        .unwrap();
        tx.add_entry(entry).unwrap();

        transaction_repo.create(&tx).await.unwrap();

        // Try to delete pocket - should fail
        let command = DeletePocketCommand {
            pocket_id: pocket_id.to_string(),
        };

        let result = handler.handle(command).await;
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("has 1 transaction"));
    }

    #[tokio::test]
    async fn test_delete_default_pocket_fails() {
        let pool = setup_test_db().await;
        let pocket_repo = Arc::new(SqlitePocketRepository::new(Arc::new(pool.clone())));
        let transaction_repo = Arc::new(SqliteTransactionRepository::new(Arc::new(pool)));
        let handler = DeletePocketHandler::new(pocket_repo.clone(), transaction_repo);

        // Get default pocket from migration
        let default = pocket_repo.find_default().await.unwrap().unwrap();

        let command = DeletePocketCommand {
            pocket_id: default.id().to_string(),
        };

        let result = handler.handle(command).await;
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("Cannot delete the default pocket"));
    }
}
