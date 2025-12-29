use std::sync::Arc;

use crate::{
    application::dtos::TransactionDto,
    domain::repositories::transaction_repository::{RepositoryError, TransactionRepository},
};

/// Query to list transactions with pagination
#[derive(Debug, Clone)]
pub struct ListTransactionsQuery {
    /// Offset for pagination (default: 0)
    pub offset: usize,

    /// Limit/page size (default: 100, max: 1000)
    pub limit: usize,

    // Filters will be added in Phase 6
    // pub filter_type: Option<TransactionType>,
    // pub filter_scope: Option<Scope>,
    // pub filter_date_from: Option<Timestamp>,
    // pub filter_date_to: Option<Timestamp>,
}

impl Default for ListTransactionsQuery {
    fn default() -> Self {
        Self {
            offset: 0,
            limit: 100,
        }
    }
}

/// Handler for ListTransactionsQuery
pub struct ListTransactionsHandler {
    repository: Arc<dyn TransactionRepository>,
}

impl ListTransactionsHandler {
    pub fn new(repository: Arc<dyn TransactionRepository>) -> Self {
        Self { repository }
    }

    pub async fn handle(&self, query: ListTransactionsQuery) -> Result<Vec<TransactionDto>, RepositoryError> {
        // Enforce max limit to prevent excessive queries
        let limit = query.limit.min(1000);

        // Retrieve from repository
        let transactions = self.repository.list(query.offset, limit).await?;

        // Convert to DTOs
        Ok(transactions.iter().map(TransactionDto::from).collect())
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
    async fn test_list_transactions_empty() {
        let pool = create_test_pool().await.unwrap();
        let repo = Arc::new(SqliteTransactionRepository::new(Arc::new(pool)));
        let handler = ListTransactionsHandler::new(repo);

        let query = ListTransactionsQuery::default();
        let result = handler.handle(query).await.unwrap();

        assert_eq!(result.len(), 0);
    }

    #[tokio::test]
    async fn test_list_transactions_with_data() {
        let pool = create_test_pool().await.unwrap();
        let repo = Arc::new(SqliteTransactionRepository::new(Arc::new(pool)));

        // Create multiple transactions
        let create_handler = CreateTransactionHandler::new(repo.clone());
        for i in 0..5 {
            let cmd = CreateTransactionCommand {
                amount_cents: (i + 1) * 100,
                transaction_type: TransactionType::Expense,
                scope: Scope::Personal,
                description: Some(format!("Transaction {}", i)),
                category: None,
                payment_method: None,
                notes: None,
                receipt_base64: None,
                occurred_at: None,
            };
            create_handler.handle(cmd).await.unwrap();
        }

        // List all
        let list_handler = ListTransactionsHandler::new(repo);
        let query = ListTransactionsQuery::default();
        let result = list_handler.handle(query).await.unwrap();

        assert_eq!(result.len(), 5);
    }

    #[tokio::test]
    async fn test_list_transactions_pagination() {
        let pool = create_test_pool().await.unwrap();
        let repo = Arc::new(SqliteTransactionRepository::new(Arc::new(pool)));

        // Create 10 transactions
        let create_handler = CreateTransactionHandler::new(repo.clone());
        for i in 0..10 {
            let cmd = CreateTransactionCommand {
                amount_cents: 100,
                transaction_type: TransactionType::Expense,
                scope: Scope::Personal,
                description: Some(format!("Tx {}", i)),
                category: None,
                payment_method: None,
                notes: None,
                receipt_base64: None,
                occurred_at: None,
            };
            create_handler.handle(cmd).await.unwrap();
        }

        // Test pagination
        let list_handler = ListTransactionsHandler::new(repo);

        // Page 1: offset 0, limit 3
        let page1 = list_handler
            .handle(ListTransactionsQuery {
                offset: 0,
                limit: 3,
            })
            .await
            .unwrap();
        assert_eq!(page1.len(), 3);

        // Page 2: offset 3, limit 3
        let page2 = list_handler
            .handle(ListTransactionsQuery {
                offset: 3,
                limit: 3,
            })
            .await
            .unwrap();
        assert_eq!(page2.len(), 3);

        // Verify different transactions
        assert_ne!(page1[0].id, page2[0].id);
    }

    #[tokio::test]
    async fn test_list_transactions_enforces_max_limit() {
        let pool = create_test_pool().await.unwrap();
        let repo = Arc::new(SqliteTransactionRepository::new(Arc::new(pool)));
        let handler = ListTransactionsHandler::new(repo);

        // Request more than max (1000)
        let query = ListTransactionsQuery {
            offset: 0,
            limit: 5000,  // Should be capped at 1000
        };

        // Should not panic, just cap the limit
        let result = handler.handle(query).await;
        assert!(result.is_ok());
    }
}
