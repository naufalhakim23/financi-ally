use async_trait::async_trait;

use crate::domain::{
    entities::transaction::Transaction,
    errors::DomainError,
    value_objects::TransactionId,
};

/// Repository error types
#[derive(Debug, thiserror::Error)]
pub enum RepositoryError {
    #[error("Database error: {0}")]
    DatabaseError(String),

    #[error("Transaction not found: {0}")]
    NotFound(String),

    #[error("Domain error: {0}")]
    DomainError(#[from] DomainError),

    #[error("Serialization error: {0}")]
    SerializationError(String),
}

/// Repository trait for Transaction aggregate
///
/// This is a PORT in Hexagonal Architecture - the domain defines what it needs,
/// the infrastructure layer provides the implementation.
///
/// Key design decisions:
/// - NO update() or delete() methods - enforces immutability at architecture level
/// - Only INSERT operations (create, add_entry) are allowed
/// - Status updates (mark_corrected) are the ONLY allowed modifications
#[async_trait]
pub trait TransactionRepository: Send + Sync {
    /// Create a new transaction with its entries
    ///
    /// # Arguments
    /// * `transaction` - The transaction to persist
    ///
    /// # Returns
    /// Result indicating success or repository error
    async fn create(&self, transaction: &Transaction) -> Result<(), RepositoryError>;

    /// Find a transaction by its ID
    ///
    /// # Arguments
    /// * `id` - The transaction ID to search for
    ///
    /// # Returns
    /// Option containing the transaction if found, None otherwise
    async fn find_by_id(&self, id: &TransactionId) -> Result<Option<Transaction>, RepositoryError>;

    /// List transactions with optional filtering
    ///
    /// # Arguments
    /// * `filters` - Optional filters (will be defined in Phase 3)
    /// * `offset` - Pagination offset
    /// * `limit` - Maximum number of results
    ///
    /// # Returns
    /// Vector of transactions matching the criteria
    async fn list(
        &self,
        offset: usize,
        limit: usize,
    ) -> Result<Vec<Transaction>, RepositoryError>;

    /// Search transactions by keyword
    ///
    /// # Arguments
    /// * `query` - Search keyword
    ///
    /// # Returns
    /// Vector of matching transactions
    async fn search(&self, query: &str) -> Result<Vec<Transaction>, RepositoryError>;

    /// CRITICAL: NO update() method - immutability enforced at architecture level
    ///
    /// Changes are made through:
    /// - add_entry() to append new ledger entries (corrections)
    /// - mark_corrected() to update status only
    ///
    /// This design makes it architecturally impossible to violate immutability

    /// Mark a transaction as corrected
    ///
    /// # Arguments
    /// * `transaction_id` - The transaction to mark as corrected
    ///
    /// # Returns
    /// Result indicating success or error
    async fn mark_corrected(&self, transaction_id: &TransactionId) -> Result<(), RepositoryError>;

    /// Mark a transaction as voided (rare, exceptional cases)
    ///
    /// # Arguments
    /// * `transaction_id` - The transaction to mark as voided
    ///
    /// # Returns
    /// Result indicating success or error
    async fn mark_voided(&self, transaction_id: &TransactionId) -> Result<(), RepositoryError>;
}
