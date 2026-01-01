use sqlx::FromRow;

use crate::domain::{
    entities::{
        ledger_entry::{EntryMetadata, LedgerEntry},
        types::{TransactionType},
    },
    errors::DomainError,
    value_objects::{Amount, Timestamp, TransactionId},
};

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
    pub category_id: Option<String>,
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

        let category_id = if let Some(category_id_str) = &self.category_id {
            Some(TransactionId::from_string(category_id_str)?)
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
            category_id,
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
            category_id: entry.category_id().map(|id| id.to_string()),
            metadata: Some(metadata_json),
            created_at: entry.created_at().to_string(),
        }
    }
}