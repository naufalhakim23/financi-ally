use std::sync::Arc;

use crate::{
    application::dtos::TransactionDto,
    domain::{
        entities::types::{Scope, TransactionType},
        repositories::transaction_repository::{RepositoryError, TransactionRepository},
        value_objects::Timestamp,
    },
};

/// Query to list transactions with pagination and filtering
#[derive(Debug, Clone)]
pub struct ListTransactionsQuery {
    /// Offset for pagination (default: 0)
    pub offset: usize,

    /// Limit/page size (default: 100, max: 1000)
    pub limit: usize,

    /// Filter by transaction type (income or expense)
    pub filter_type: Option<TransactionType>,

    /// Filter by scope (personal or business)
    pub filter_scope: Option<Scope>,

    /// Filter by date range - from (inclusive)
    pub filter_date_from: Option<Timestamp>,

    /// Filter by date range - to (inclusive)
    pub filter_date_to: Option<Timestamp>,

    /// Filter by category
    pub filter_category: Option<String>,

    /// Filter by payment method
    pub filter_payment_method: Option<String>,
}

impl Default for ListTransactionsQuery {
    fn default() -> Self {
        Self {
            offset: 0,
            limit: 100,
            filter_type: None,
            filter_scope: None,
            filter_date_from: None,
            filter_date_to: None,
            filter_category: None,
            filter_payment_method: None,
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

        // Check if any filters are applied
        let has_filters = query.filter_type.is_some()
            || query.filter_scope.is_some()
            || query.filter_date_from.is_some()
            || query.filter_date_to.is_some()
            || query.filter_category.is_some()
            || query.filter_payment_method.is_some();

        // Use filtered list if filters are present, otherwise use regular list
        let transactions = if has_filters {
            self.repository.list_with_filters(
                query.offset,
                limit,
                query.filter_type.as_ref(),
                query.filter_scope.as_ref(),
                query.filter_date_from.as_ref(),
                query.filter_date_to.as_ref(),
                query.filter_category.as_deref(),
                query.filter_payment_method.as_deref(),
            ).await?
        } else {
            self.repository.list(query.offset, limit).await?
        };

        // Convert to DTOs
        Ok(transactions.iter().map(TransactionDto::from).collect())
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
        let create_pocket_handler = CreatePocketHandler::new(pocket_repo);
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
    async fn test_list_transactions_empty() {
        let pool = create_test_pool().await.unwrap();
        let tx_repo = Arc::new(SqliteTransactionRepository::new(Arc::new(pool)));
        let handler = ListTransactionsHandler::new(tx_repo);

        let query = ListTransactionsQuery::default();
        let result = handler.handle(query).await.unwrap();

        assert_eq!(result.len(), 0);
    }

    #[tokio::test]
    async fn test_list_transactions_with_data() {
        let pool = create_test_pool().await.unwrap();
        let tx_repo = Arc::new(SqliteTransactionRepository::new(Arc::new(pool.clone())));
        let pocket_repo = Arc::new(SqlitePocketRepository::new(Arc::new(pool)));

        // Create test pocket
        let pocket_id = create_test_pocket(pocket_repo.clone()).await;

        // Create multiple transactions
        let create_handler = CreateTransactionHandler::new(tx_repo.clone(), pocket_repo);
        for i in 0..5 {
            let cmd = CreateTransactionCommand {
                amount_cents: (i + 1) * 100,
                transaction_type: TransactionType::Expense,
                scope: Scope::Personal,
                pocket_id: pocket_id.clone(),
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
        let list_handler = ListTransactionsHandler::new(tx_repo);
        let query = ListTransactionsQuery::default();
        let result = list_handler.handle(query).await.unwrap();

        assert_eq!(result.len(), 5);
    }

    #[tokio::test]
    async fn test_list_transactions_pagination() {
        let pool = create_test_pool().await.unwrap();
        let tx_repo = Arc::new(SqliteTransactionRepository::new(Arc::new(pool.clone())));
        let pocket_repo = Arc::new(SqlitePocketRepository::new(Arc::new(pool)));

        // Create test pocket
        let pocket_id = create_test_pocket(pocket_repo.clone()).await;

        // Create 10 transactions
        let create_handler = CreateTransactionHandler::new(tx_repo.clone(), pocket_repo);
        for i in 0..10 {
            let cmd = CreateTransactionCommand {
                amount_cents: 100,
                transaction_type: TransactionType::Expense,
                scope: Scope::Personal,
                pocket_id: pocket_id.clone(),
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
        let list_handler = ListTransactionsHandler::new(tx_repo);

        // Page 1: offset 0, limit 3
        let page1 = list_handler
            .handle(ListTransactionsQuery {
                offset: 0,
                limit: 3,
                ..Default::default()
            })
            .await
            .unwrap();
        assert_eq!(page1.len(), 3);

        // Page 2: offset 3, limit 3
        let page2 = list_handler
            .handle(ListTransactionsQuery {
                offset: 3,
                limit: 3,
                ..Default::default()
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
        let tx_repo = Arc::new(SqliteTransactionRepository::new(Arc::new(pool)));
        let handler = ListTransactionsHandler::new(tx_repo);

        // Request more than max (1000)
        let query = ListTransactionsQuery {
            offset: 0,
            limit: 5000,  // Should be capped at 1000
            ..Default::default()
        };

        // Should not panic, just cap the limit
        let result = handler.handle(query).await;
        assert!(result.is_ok());
    }
}
