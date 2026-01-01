use std::sync::Arc;

use crate::domain::{
    repositories::category_repository::CategoryRepository,
    repositories::transaction_repository::RepositoryError,
    value_objects::TransactionId,
};

/// Command to delete a category (soft delete)
#[derive(Debug, Clone)]
pub struct DeleteCategoryCommand {
    pub category_id: String,
}

/// Handler for DeleteCategoryCommand
pub struct DeleteCategoryHandler {
    category_repo: Arc<dyn CategoryRepository>,
}

impl DeleteCategoryHandler {
    /// Create a new handler
    pub fn new(category_repo: Arc<dyn CategoryRepository>) -> Self {
        Self { category_repo }
    }

    /// Execute the command to delete a category
    ///
    /// # Arguments
    /// * `command` - The delete category command
    ///
    /// # Returns
    /// * `Ok(())` - Category deleted successfully
    /// * `Err(RepositoryError)` - If category not found or is in use
    pub async fn handle(&self, command: DeleteCategoryCommand) -> Result<(), RepositoryError> {
        // Parse ID
        let id = TransactionId::from_string(&command.category_id)
            .map_err(|e| RepositoryError::ValidationError(e.to_string()))?;

        // Check if category is in use
        let in_use = self.category_repo.is_category_in_use(&id).await?;
        if in_use {
            return Err(RepositoryError::ValidationError(
                "Cannot delete category that is used by existing transactions".to_string(),
            ));
        }

        // Perform soft delete
        self.category_repo.soft_delete(&id).await?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        application::commands::create_category::{CreateCategoryCommand, CreateCategoryHandler},
        domain::{
            entities::{Pocket, Transaction},
            repositories::pocket_repository::PocketRepository,
            repositories::transaction_repository::TransactionRepository,
            value_objects::{Amount, Currency},
        },
        infrastructure::persistence::{
            schema::run_migrations,
            sqlite_category_repository::SqliteCategoryRepository,
            sqlite_pocket_repository::SqlitePocketRepository,
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
    async fn test_delete_category_success() {
        let pool = setup_test_db().await;
        let repo = Arc::new(SqliteCategoryRepository::new(Arc::new(pool)));
        let delete_handler = DeleteCategoryHandler::new(repo.clone());
        let create_handler = CreateCategoryHandler::new(repo.clone());

        // Create a category
        let command = CreateCategoryCommand {
            name: "To Delete".to_string(),
            code: "to_delete".to_string(),
            description: None,
            color: "#FF0000".to_string(),
            is_expense: true,
            is_income: false,
        };

        let category = create_handler.handle(command).await.unwrap();

        // Delete it
        let delete_command = DeleteCategoryCommand {
            category_id: category.id.clone(),
        };

        let result = delete_handler.handle(delete_command).await;
        assert!(result.is_ok());

        // Verify it's deleted
        let id = TransactionId::from_string(&category.id).unwrap();
        let found = repo.find_by_id(&id).await.unwrap();
        assert!(found.is_none());
    }

    #[tokio::test]
    async fn test_delete_category_not_found() {
        let pool = setup_test_db().await;
        let repo = Arc::new(SqliteCategoryRepository::new(Arc::new(pool)));
        let handler = DeleteCategoryHandler::new(repo);

        let command = DeleteCategoryCommand {
            category_id: "01234567-89ab-cdef-0123-456789abcdef".to_string(),
        };

        let result = handler.handle(command).await;
        assert!(result.is_err());

        match result {
            Err(RepositoryError::NotFound(_)) => {}
            _ => panic!("Expected NotFound error"),
        }
    }

    // NOTE: Full "in use" test will be added in Phase 6 when category_id is properly
    // integrated into transaction creation. For now, the is_category_in_use() method
    // is tested in the repository layer.
    //
    // The test would fail here because ledger_entries table has immutability triggers
    // that prevent UPDATE operations, and we can't set category_id during creation yet.
}
