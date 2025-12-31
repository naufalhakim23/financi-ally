use async_trait::async_trait;

use crate::domain::{
    entities::{correction::CorrectionResult, transaction::Transaction, types::{Scope, TransactionType}},
    errors::DomainError,
    value_objects::{Timestamp, TransactionId},
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

    #[error("Validation error: {0}")]
    ValidationError(String),

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

    /// List transactions with filters
    ///
    /// # Arguments
    /// * `offset` - Pagination offset
    /// * `limit` - Maximum number of results
    /// * `filter_type` - Optional filter by transaction type (income/expense)
    /// * `filter_scope` - Optional filter by scope (personal/business)
    /// * `filter_date_from` - Optional start date filter (inclusive)
    /// * `filter_date_to` - Optional end date filter (inclusive)
    /// * `filter_category` - Optional category filter
    /// * `filter_payment_method` - Optional payment method filter
    ///
    /// # Returns
    /// Vector of transactions matching all applied filters
    async fn list_with_filters(
        &self,
        offset: usize,
        limit: usize,
        filter_type: Option<&TransactionType>,
        filter_scope: Option<&Scope>,
        filter_date_from: Option<&Timestamp>,
        filter_date_to: Option<&Timestamp>,
        filter_category: Option<&str>,
        filter_payment_method: Option<&str>,
    ) -> Result<Vec<Transaction>, RepositoryError>;

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

    /// Apply a correction to a transaction
    ///
    /// This atomically:
    /// 1. Inserts the reversal entry (negates original)
    /// 2. Inserts the corrected entry (with new data)
    /// 3. Marks the transaction as "corrected"
    ///
    /// CRITICAL: Must be atomic - all three operations succeed or all fail
    ///
    /// # Arguments
    /// * `transaction_id` - The transaction to correct
    /// * `correction` - The correction result containing reversal and corrected entries
    ///
    /// # Returns
    /// Result indicating success or error
    async fn apply_correction(
        &self,
        transaction_id: &TransactionId,
        correction: CorrectionResult,
    ) -> Result<(), RepositoryError>;
}
