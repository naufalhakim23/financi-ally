use std::sync::Arc;

use crate::{
    application::dtos::TransactionDto,
    domain::{
        repositories::transaction_repository::{RepositoryError, TransactionRepository},
        value_objects::TransactionId,
    },
};

/// Query to get a single transaction by ID
#[derive(Debug, Clone)]
pub struct GetTransactionQuery {
    pub transaction_id: String,
}

/// Handler for GetTransactionQuery
pub struct GetTransactionHandler {
    repository: Arc<dyn TransactionRepository>,
}

impl GetTransactionHandler {
    pub fn new(repository: Arc<dyn TransactionRepository>) -> Self {
        Self { repository }
    }

    pub async fn handle(&self, query: GetTransactionQuery) -> Result<Option<TransactionDto>, RepositoryError> {
        // Parse transaction ID
        let tx_id = TransactionId::from_string(&query.transaction_id)?;

        // Retrieve from repository
        let transaction = self.repository.find_by_id(&tx_id).await?;

        // Convert to DTO if found
        Ok(transaction.as_ref().map(TransactionDto::from))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        application::commands::{CreateTransactionCommand, CreateTransactionHandler},
        domain::entities::types::{Scope, TransactionType},
        infrastructure::persistence::{
            connection::create_test_pool,
            sqlite_transaction_repository::SqliteTransactionRepository,
        },
    };

    #[tokio::test]
    async fn test_get_transaction_found() {
        let pool = create_test_pool().await.unwrap();
        let repo = Arc::new(SqliteTransactionRepository::new(Arc::new(pool)));

        // Create a transaction first
        let create_handler = CreateTransactionHandler::new(repo.clone());
        let create_cmd = CreateTransactionCommand {
            amount_cents: 1000,
            transaction_type: TransactionType::Expense,
            scope: Scope::Personal,
            description: Some("Test transaction".to_string()),
            category: None,
            payment_method: None,
            notes: None,
            receipt_base64: None,
            occurred_at: None,
        };
        let created = create_handler.handle(create_cmd).await.unwrap();

        // Now retrieve it
        let get_handler = GetTransactionHandler::new(repo);
        let get_query = GetTransactionQuery {
            transaction_id: created.id.clone(),
        };
        let result = get_handler.handle(get_query).await.unwrap();

        assert!(result.is_some());
        let retrieved = result.unwrap();
        assert_eq!(retrieved.id, created.id);
        assert_eq!(retrieved.description, Some("Test transaction".to_string()));
    }

    #[tokio::test]
    async fn test_get_transaction_not_found() {
        let pool = create_test_pool().await.unwrap();
        let repo = Arc::new(SqliteTransactionRepository::new(Arc::new(pool)));
        let handler = GetTransactionHandler::new(repo);

        let fake_id = TransactionId::new();
        let query = GetTransactionQuery {
            transaction_id: fake_id.to_string(),
        };

        let result = handler.handle(query).await.unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_get_transaction_invalid_id() {
        let pool = create_test_pool().await.unwrap();
        let repo = Arc::new(SqliteTransactionRepository::new(Arc::new(pool)));
        let handler = GetTransactionHandler::new(repo);

        let query = GetTransactionQuery {
            transaction_id: "not-a-valid-uuid".to_string(),
        };

        let result = handler.handle(query).await;
        assert!(result.is_err());
    }
}
