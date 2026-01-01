use serde::{Deserialize, Serialize};

use crate::domain::{
    entities::{
        ledger_entry::{EntryMetadata, LedgerEntry},
        transaction::Transaction,
        types::{Scope, TransactionStatus, TransactionType},
    },
    errors::DomainError,
};

/// DTO for entry metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntryMetadataDto {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub payment_method: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub receipt_base64: Option<String>,
}

impl From<&EntryMetadata> for EntryMetadataDto {
    fn from(metadata: &EntryMetadata) -> Self {
        Self {
            category: metadata.category.clone(),
            payment_method: metadata.payment_method.clone(),
            notes: metadata.notes.clone(),
            receipt_base64: metadata.receipt_base64.clone(),
        }
    }
}

impl TryFrom<EntryMetadataDto> for EntryMetadata {
    type Error = DomainError;

    fn try_from(dto: EntryMetadataDto) -> Result<Self, Self::Error> {
        EntryMetadata::new(
            dto.category,
            dto.payment_method,
            dto.notes,
            dto.receipt_base64,
        )
    }
}

/// DTO for ledger entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LedgerEntryDto {
    pub id: String,
    pub transaction_id: String,
    pub amount_cents: i64,
    #[serde(rename = "type")]
    pub entry_type: String,  // "income" or "expense"
    pub is_correction: bool,
    pub parent_entry_id: Option<String>,
    pub metadata: EntryMetadataDto,
    pub created_at: String,  // ISO 8601
}

impl From<&LedgerEntry> for LedgerEntryDto {
    fn from(entry: &LedgerEntry) -> Self {
        Self {
            id: entry.id().to_string(),
            transaction_id: entry.transaction_id().to_string(),
            amount_cents: entry.amount().cents(),
            entry_type: entry.entry_type().as_str().to_string(),
            is_correction: entry.is_correction(),
            parent_entry_id: entry.parent_entry_id().map(|id| id.to_string()),
            metadata: EntryMetadataDto::from(entry.metadata()),
            created_at: entry.created_at().to_string(),
        }
    }
}

/// DTO for transaction (with all its entries)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionDto {
    pub id: String,
    pub description: Option<String>,
    pub occurred_at: String,  // ISO 8601
    pub scope: String,  // "personal" or "business"
    pub status: String,  // "active", "corrected", or "voided"
    pub created_at: String,  // ISO 8601
    pub pocket_id: String,  // The pocket this transaction belongs to
    pub entries: Vec<LedgerEntryDto>,
    pub total_amount_cents: i64,  // Computed from entries
}

impl From<&Transaction> for TransactionDto {
    fn from(tx: &Transaction) -> Self {
        Self {
            id: tx.id().to_string(),
            description: tx.description().clone(),
            occurred_at: tx.occurred_at().to_string(),
            scope: tx.scope().as_str().to_string(),
            status: tx.status().as_str().to_string(),
            created_at: tx.created_at().to_string(),
            pocket_id: tx.pocket_id().to_string(),
            entries: tx.entries().iter().map(LedgerEntryDto::from).collect(),
            total_amount_cents: tx.total_amount().cents(),
        }
    }
}

impl From<Transaction> for TransactionDto {
    fn from(tx: Transaction) -> Self {
        TransactionDto::from(&tx)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{
        value_objects::{Amount, Timestamp},
    };

    #[test]
    fn test_transaction_dto_conversion() {
        let pocket_id = crate::domain::value_objects::TransactionId::new();
        let mut tx = Transaction::new(
            Some("Test transaction".to_string()),
            Timestamp::now(),
            Scope::Personal,
            pocket_id.clone(),
        )
        .unwrap();

        let amount = Amount::from_cents(1000);
        let metadata = EntryMetadata::empty();
        let entry = LedgerEntry::new_expense(*tx.id(), amount, metadata, None).unwrap();
        tx.add_entry(entry).unwrap();

        let dto = TransactionDto::from(&tx);

        assert_eq!(dto.id, tx.id().to_string());
        assert_eq!(dto.description, Some("Test transaction".to_string()));
        assert_eq!(dto.scope, "personal");
        assert_eq!(dto.status, "active");
        assert_eq!(dto.pocket_id, pocket_id.to_string());
        assert_eq!(dto.entries.len(), 1);
        assert_eq!(dto.total_amount_cents, -1000);  // Expense
    }

    #[test]
    fn test_ledger_entry_dto_conversion() {
        let tx_id = crate::domain::value_objects::TransactionId::new();
        let amount = Amount::from_cents(500);
        let metadata = EntryMetadata::new(
            Some("Food".to_string()),
            Some("Cash".to_string()),
            Some("Lunch".to_string()),
            None,
        )
        .unwrap();

        let entry = LedgerEntry::new_income(tx_id, amount, metadata, None).unwrap();
        let dto = LedgerEntryDto::from(&entry);

        assert_eq!(dto.transaction_id, tx_id.to_string());
        assert_eq!(dto.amount_cents, 500);
        assert_eq!(dto.entry_type, "income");
        assert!(!dto.is_correction);
        assert_eq!(dto.metadata.category, Some("Food".to_string()));
        assert_eq!(dto.metadata.payment_method, Some("Cash".to_string()));
        assert_eq!(dto.metadata.notes, Some("Lunch".to_string()));
    }

    #[test]
    fn test_metadata_dto_round_trip() {
        let original = EntryMetadata::new(
            Some("Groceries".to_string()),
            Some("Credit Card".to_string()),
            Some("Weekly shopping".to_string()),
            None,
        )
        .unwrap();

        let dto = EntryMetadataDto::from(&original);
        let converted: EntryMetadata = dto.try_into().unwrap();

        assert_eq!(converted.category, original.category);
        assert_eq!(converted.payment_method, original.payment_method);
        assert_eq!(converted.notes, original.notes);
    }
}
