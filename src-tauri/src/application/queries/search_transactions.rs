use std::sync::Arc;

use crate::{
    application::dtos::TransactionDto,
    domain::repositories::transaction_repository::{RepositoryError, TransactionRepository},
};

/// Query to search transactions by keyword
///
/// Searches across:
/// - Transaction description
/// - Entry metadata (category, payment_method, notes)
///
/// Uses FTS5 for fast full-text search (<300ms requirement)
#[derive(Debug, Clone)]
pub struct SearchTransactionsQuery {
    /// Search keyword or phrase
    pub query: String,
}

/// Handler for SearchTransactionsQuery
pub struct SearchTransactionsHandler {
    repository: Arc<dyn TransactionRepository>,
}

impl SearchTransactionsHandler {
    pub fn new(repository: Arc<dyn TransactionRepository>) -> Self {
        Self { repository }
    }

    pub async fn handle(&self, query: SearchTransactionsQuery) -> Result<Vec<TransactionDto>, RepositoryError> {
        // Validate query is not empty
        if query.query.trim().is_empty() {
            return Ok(Vec::new());
        }

        // Search via repository (uses FTS5 for performance)
        let transactions = self.repository.search(&query.query).await?;

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
    async fn test_search_transactions_empty_query() {
        let pool = create_test_pool().await.unwrap();
        let repo = Arc::new(SqliteTransactionRepository::new(Arc::new(pool)));
        let handler = SearchTransactionsHandler::new(repo);

        let query = SearchTransactionsQuery {
            query: "".to_string(),
        };

        let result = handler.handle(query).await.unwrap();
        assert_eq!(result.len(), 0);
    }

    #[tokio::test]
    async fn test_search_transactions_by_description() {
        let pool = create_test_pool().await.unwrap();
        let repo = Arc::new(SqliteTransactionRepository::new(Arc::new(pool)));

        // Create transactions with different descriptions
        let create_handler = CreateTransactionHandler::new(repo.clone());

        let cmd1 = CreateTransactionCommand {
            amount_cents: 1000,
            transaction_type: TransactionType::Expense,
            scope: Scope::Personal,
            description: Some("Grocery shopping at Whole Foods".to_string()),
            category: Some("Food".to_string()),
            payment_method: None,
            notes: None,
            receipt_base64: None,
            occurred_at: None,
        };
        create_handler.handle(cmd1).await.unwrap();

        let cmd2 = CreateTransactionCommand {
            amount_cents: 500,
            transaction_type: TransactionType::Expense,
            scope: Scope::Personal,
            description: Some("Coffee at Starbucks".to_string()),
            category: Some("Food".to_string()),
            payment_method: None,
            notes: None,
            receipt_base64: None,
            occurred_at: None,
        };
        create_handler.handle(cmd2).await.unwrap();

        // Search for "grocery"
        let search_handler = SearchTransactionsHandler::new(repo);
        let query = SearchTransactionsQuery {
            query: "Grocery".to_string(),
        };

        let results = search_handler.handle(query).await.unwrap();

        assert_eq!(results.len(), 1);
        assert!(results[0].description.as_ref().unwrap().contains("Grocery"));
    }

    #[tokio::test]
    async fn test_search_transactions_by_category() {
        let pool = create_test_pool().await.unwrap();
        let repo = Arc::new(SqliteTransactionRepository::new(Arc::new(pool)));

        let create_handler = CreateTransactionHandler::new(repo.clone());

        // Create transaction with specific category
        let cmd = CreateTransactionCommand {
            amount_cents: 2000,
            transaction_type: TransactionType::Expense,
            scope: Scope::Business,
            description: Some("Bought software license".to_string()),
            category: Some("Software".to_string()),
            payment_method: Some("Credit Card".to_string()),
            notes: Some("Annual subscription".to_string()),
            receipt_base64: None,
            occurred_at: None,
        };
        create_handler.handle(cmd).await.unwrap();

        // Search by category
        let search_handler = SearchTransactionsHandler::new(repo);
        let query = SearchTransactionsQuery {
            query: "Software".to_string(),
        };

        let results = search_handler.handle(query).await.unwrap();

        assert!(results.len() >= 1);
        assert!(results.iter().any(|tx| {
            tx.entries.iter().any(|e| {
                e.metadata.category.as_ref()
                    .map(|c| c.contains("Software"))
                    .unwrap_or(false)
            })
        }));
    }

    #[tokio::test]
    async fn test_search_transactions_no_results() {
        let pool = create_test_pool().await.unwrap();
        let repo = Arc::new(SqliteTransactionRepository::new(Arc::new(pool)));

        let create_handler = CreateTransactionHandler::new(repo.clone());

        let cmd = CreateTransactionCommand {
            amount_cents: 1000,
            transaction_type: TransactionType::Expense,
            scope: Scope::Personal,
            description: Some("Lunch".to_string()),
            category: None,
            payment_method: None,
            notes: None,
            receipt_base64: None,
            occurred_at: None,
        };
        create_handler.handle(cmd).await.unwrap();

        // Search for something that doesn't exist
        let search_handler = SearchTransactionsHandler::new(repo);
        let query = SearchTransactionsQuery {
            query: "NonexistentKeyword".to_string(),
        };

        let results = search_handler.handle(query).await.unwrap();
        assert_eq!(results.len(), 0);
    }

    #[tokio::test]
    async fn test_search_transactions_case_insensitive() {
        let pool = create_test_pool().await.unwrap();
        let repo = Arc::new(SqliteTransactionRepository::new(Arc::new(pool)));

        let create_handler = CreateTransactionHandler::new(repo.clone());

        let cmd = CreateTransactionCommand {
            amount_cents: 500,
            transaction_type: TransactionType::Expense,
            scope: Scope::Personal,
            description: Some("DINNER at restaurant".to_string()),
            category: None,
            payment_method: None,
            notes: None,
            receipt_base64: None,
            occurred_at: None,
        };
        create_handler.handle(cmd).await.unwrap();

        // Search with lowercase (should find uppercase)
        let search_handler = SearchTransactionsHandler::new(repo);
        let query = SearchTransactionsQuery {
            query: "dinner".to_string(),
        };

        let results = search_handler.handle(query).await.unwrap();
        assert!(results.len() >= 1);
    }
}
