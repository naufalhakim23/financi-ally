use thiserror::Error;

/// Domain-level errors
/// These represent violations of business rules or invalid domain operations
#[derive(Error, Debug)]
pub enum DomainError {
    #[error("Invalid amount: {0}")]
    InvalidAmount(String),

    #[error("Invalid timestamp: {0}")]
    InvalidTimestamp(String),

    #[error("Invalid transaction ID: {0}")]
    InvalidTransactionId(String),

    #[error("Transaction validation failed: {0}")]
    ValidationError(String),

    #[error("Cannot correct a transaction that is already corrected")]
    AlreadyCorrected,

    #[error("Cannot correct a reversal entry")]
    CannotCorrectReversal,

    #[error("Transaction not found: {0}")]
    TransactionNotFound(String),

    #[error("Ledger entry not found: {0}")]
    EntryNotFound(String),

    #[error("Invalid transaction state: {0}")]
    InvalidState(String),
}

/// Result type for domain operations
pub type DomainResult<T> = Result<T, DomainError>;
