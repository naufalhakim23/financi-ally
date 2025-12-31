use sqlx::FromRow;

use crate::domain::{
    entities::{
        transaction::Transaction,
        types::{Scope, TransactionStatus},
    },
    errors::DomainError,
    value_objects::{Timestamp, TransactionId},
};

/// Database row for transactions table
#[derive(Debug, FromRow)]
pub struct TransactionRow {
    pub id: String,
    pub description: Option<String>,
    pub occurred_at: String,
    pub scope: String,
    pub status: String,
    pub created_at: String,
}

impl TransactionRow {
    /// Convert database row to domain entity
    pub fn to_domain(&self) -> Result<Transaction, DomainError> {
        let id = TransactionId::from_string(&self.id)?;
        let occurred_at = Timestamp::from_string(&self.occurred_at)?;
        let created_at = Timestamp::from_string(&self.created_at)?;

        let scope = match self.scope.as_str() {
            "personal" => Scope::Personal,
            "business" => Scope::Business,
            _ => return Err(DomainError::InvalidState(format!("Invalid scope: {}", self.scope))),
        };

        let status = match self.status.as_str() {
            "active" => TransactionStatus::Active,
            "corrected" => TransactionStatus::Corrected,
            "voided" => TransactionStatus::Voided,
            _ => return Err(DomainError::InvalidState(format!("Invalid status: {}", self.status))),
        };

        // Use from_persistence to reconstruct with original IDs and timestamps
        let tx = Transaction::from_persistence(
            id,
            self.description.clone(),
            occurred_at,
            scope,
            status,
            created_at,
        );

        Ok(tx)
    }

    /// Create database row from domain entity
    pub fn from_domain(tx: &Transaction) -> Self {
        Self {
            id: tx.id().to_string(),
            description: tx.description().clone(),
            occurred_at: tx.occurred_at().to_string(),
            scope: tx.scope().as_str().to_string(),
            status: tx.status().as_str().to_string(),
            created_at: tx.created_at().to_string(),
        }
    }
}