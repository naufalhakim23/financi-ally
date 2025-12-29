use sqlx::FromRow;

use crate::domain::{
    entities::{
        ledger_entry::{EntryMetadata, LedgerEntry},
        transaction::Transaction,
        types::{Scope, TransactionStatus, TransactionType},
    },
    errors::DomainError,
    value_objects::{Amount, Timestamp, TransactionId},
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

/// Database row for ledger_entries table
#[derive(Debug, FromRow)]
pub struct LedgerEntryRow {
    pub id: String,
    pub transaction_id: String,
    pub amount_cents: i64,
    #[sqlx(rename = "type")]
    pub entry_type: String,
    pub is_correction: bool,
    pub parent_entry_id: Option<String>,
    pub metadata: Option<String>, // JSON string
    pub created_at: String,
}

impl LedgerEntryRow {
    /// Convert database row to domain entity
    pub fn to_domain(&self) -> Result<LedgerEntry, DomainError> {
        let id = TransactionId::from_string(&self.id)?;
        let transaction_id = TransactionId::from_string(&self.transaction_id)?;
        let amount = Amount::from_cents(self.amount_cents);
        let created_at = Timestamp::from_string(&self.created_at)?;

        let entry_type = match self.entry_type.as_str() {
            "income" => TransactionType::Income,
            "expense" => TransactionType::Expense,
            _ => return Err(DomainError::InvalidState(format!("Invalid type: {}", self.entry_type))),
        };

        let parent_entry_id = if let Some(parent_id_str) = &self.parent_entry_id {
            Some(TransactionId::from_string(parent_id_str)?)
        } else {
            None
        };

        // Parse metadata JSON
        let metadata: EntryMetadata = if let Some(json_str) = &self.metadata {
            serde_json::from_str(json_str)
                .map_err(|e| DomainError::InvalidState(format!("Invalid metadata JSON: {}", e)))?
        } else {
            EntryMetadata::empty()
        };

        // Use from_persistence to reconstruct with original IDs and timestamps
        let entry = LedgerEntry::from_persistence(
            id,
            transaction_id,
            amount,
            entry_type,
            self.is_correction,
            parent_entry_id,
            metadata,
            created_at,
        );

        Ok(entry)
    }

    /// Create database row from domain entity
    pub fn from_domain(entry: &LedgerEntry) -> Self {
        let metadata_json = serde_json::to_string(entry.metadata())
            .unwrap_or_else(|_| "{}".to_string());

        Self {
            id: entry.id().to_string(),
            transaction_id: entry.transaction_id().to_string(),
            amount_cents: entry.amount().cents(),
            entry_type: entry.entry_type().as_str().to_string(),
            is_correction: entry.is_correction(),
            parent_entry_id: entry.parent_entry_id().map(|id| id.to_string()),
            metadata: Some(metadata_json),
            created_at: entry.created_at().to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_transaction_row_round_trip() {
        let tx = Transaction::new(
            Some("Test transaction".to_string()),
            Timestamp::now(),
            Scope::Personal,
        )
        .unwrap();

        let row = TransactionRow::from_domain(&tx);

        assert_eq!(row.id, tx.id().to_string());
        assert_eq!(row.description, Some("Test transaction".to_string()));
        assert_eq!(row.scope, "personal");
        assert_eq!(row.status, "active");
    }

    #[test]
    fn test_ledger_entry_row_from_domain() {
        let tx_id = TransactionId::new();
        let amount = Amount::from_cents(1000);
        let metadata = EntryMetadata::empty();

        let entry = LedgerEntry::new_expense(tx_id, amount, metadata).unwrap();
        let row = LedgerEntryRow::from_domain(&entry);

        assert_eq!(row.transaction_id, tx_id.to_string());
        assert_eq!(row.amount_cents, 1000);
        assert_eq!(row.entry_type, "expense");
        assert!(!row.is_correction);
        assert!(row.parent_entry_id.is_none());
    }

    #[test]
    fn test_metadata_serialization() {
        let tx_id = TransactionId::new();
        let amount = Amount::from_cents(500);
        let metadata = EntryMetadata::new(
            Some("Food".to_string()),
            Some("Cash".to_string()),
            Some("Lunch".to_string()),
            None,
        )
        .unwrap();

        let entry = LedgerEntry::new_income(tx_id, amount, metadata).unwrap();
        let row = LedgerEntryRow::from_domain(&entry);

        // Metadata should be valid JSON
        assert!(row.metadata.is_some());
        let json_str = row.metadata.unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json_str).unwrap();

        assert_eq!(parsed["category"], "Food");
        assert_eq!(parsed["payment_method"], "Cash");
        assert_eq!(parsed["notes"], "Lunch");
    }
}
