use serde::{Deserialize, Serialize};

use crate::domain::entities::types::TransactionType;
use crate::domain::errors::{DomainError, DomainResult};
use crate::domain::validation::Validator;
use crate::domain::value_objects::{Amount, Timestamp, TransactionId};

/// Metadata associated with a ledger entry
/// Stored as JSON in database: {category, payment_method, notes, receipt_base64}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EntryMetadata {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub payment_method: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub receipt_base64: Option<String>,
}

impl EntryMetadata {
    pub fn new(
        category: Option<String>,
        payment_method: Option<String>,
        notes: Option<String>,
        receipt_base64: Option<String>,
    ) -> DomainResult<Self> {
        // Validate metadata fields
        Validator::validate_category(&category)?;
        Validator::validate_payment_method(&payment_method)?;
        Validator::validate_notes(&notes)?;

        Ok(Self {
            category,
            payment_method,
            notes,
            receipt_base64,
        })
    }

    pub fn empty() -> Self {
        Self {
            category: None,
            payment_method: None,
            notes: None,
            receipt_base64: None,
        }
    }
}

/// LedgerEntry - Immutable record of value movement
///
/// This is the core of the immutable ledger. Every financial transaction
/// creates at least one ledger entry. Corrections create additional entries.
///
/// Key invariants:
/// - Once created, a ledger entry cannot be modified (enforced by no mut methods)
/// - Corrections are implemented via reversal + new entry pattern
/// - Amount is stored in cents to prevent floating-point errors
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LedgerEntry {
    /// Unique ID for this ledger entry
    id: TransactionId,

    /// ID of the parent transaction this entry belongs to
    transaction_id: TransactionId,

    /// Amount in cents (positive for income, expense handled by type)
    amount: Amount,

    /// Type of entry: income or expense
    entry_type: TransactionType,

    /// Whether this is a correction entry
    /// Correction entries are part of the correction pattern:
    /// 1. Reversal entry (is_correction=true, parent_entry_id=original)
    /// 2. New corrected entry (is_correction=true, parent_entry_id=original)
    is_correction: bool,

    /// Reference to the original entry being corrected (if this is a correction)
    parent_entry_id: Option<TransactionId>,

    /// Additional metadata (category, payment method, notes, receipt)
    metadata: EntryMetadata,

    /// When this entry was created (immutable)
    created_at: Timestamp,
}

impl LedgerEntry {
    /// Create a new income entry
    pub fn new_income(
        transaction_id: TransactionId,
        amount: Amount,
        metadata: EntryMetadata,
    ) -> DomainResult<Self> {
        // Income entries should have positive amounts
        if amount.is_negative() {
            return Err(DomainError::ValidationError(
                "Income amount must be positive".to_string(),
            ));
        }

        Validator::validate_non_zero_amount(&amount)?;

        Ok(Self {
            id: TransactionId::new(),
            transaction_id,
            amount,
            entry_type: TransactionType::Income,
            is_correction: false,
            parent_entry_id: None,
            metadata,
            created_at: Timestamp::now(),
        })
    }

    /// Create a new expense entry
    pub fn new_expense(
        transaction_id: TransactionId,
        amount: Amount,
        metadata: EntryMetadata,
    ) -> DomainResult<Self> {
        // Expense amounts should be positive (type indicates it's an expense)
        if amount.is_negative() {
            return Err(DomainError::ValidationError(
                "Expense amount must be positive".to_string(),
            ));
        }

        Validator::validate_non_zero_amount(&amount)?;

        Ok(Self {
            id: TransactionId::new(),
            transaction_id,
            amount,
            entry_type: TransactionType::Expense,
            is_correction: false,
            parent_entry_id: None,
            metadata,
            created_at: Timestamp::now(),
        })
    }

    /// Create a reversal entry for corrections
    /// This creates an entry that negates the original
    ///
    /// # Arguments
    /// * `original` - The original entry to reverse
    ///
    /// # Returns
    /// A new entry with negated amount that references the original
    pub fn new_reversal(original: &Self) -> Self {
        Self {
            id: TransactionId::new(),
            transaction_id: original.transaction_id,
            amount: original.amount.negate(),
            entry_type: original.entry_type,
            is_correction: true,
            parent_entry_id: Some(original.id),
            metadata: original.metadata.clone(),
            created_at: Timestamp::now(),
        }
    }

    /// Create a corrected entry (used with reversal for correction pattern)
    ///
    /// # Arguments
    /// * `original` - The original entry being corrected
    /// * `new_amount` - The corrected amount
    /// * `new_metadata` - The corrected metadata
    pub fn new_corrected(
        original: &Self,
        new_amount: Amount,
        new_metadata: EntryMetadata,
    ) -> DomainResult<Self> {
        if new_amount.is_zero() {
            return Err(DomainError::ValidationError(
                "Corrected amount cannot be zero".to_string(),
            ));
        }

        Ok(Self {
            id: TransactionId::new(),
            transaction_id: original.transaction_id,
            amount: new_amount,
            entry_type: original.entry_type,
            is_correction: true,
            parent_entry_id: Some(original.id),
            metadata: new_metadata,
            created_at: Timestamp::now(),
        })
    }

    // Getters (immutable access only)
    pub fn id(&self) -> &TransactionId {
        &self.id
    }

    pub fn transaction_id(&self) -> &TransactionId {
        &self.transaction_id
    }

    pub fn amount(&self) -> &Amount {
        &self.amount
    }

    pub fn entry_type(&self) -> TransactionType {
        self.entry_type
    }

    pub fn is_correction(&self) -> bool {
        self.is_correction
    }

    pub fn parent_entry_id(&self) -> Option<&TransactionId> {
        self.parent_entry_id.as_ref()
    }

    pub fn metadata(&self) -> &EntryMetadata {
        &self.metadata
    }

    pub fn created_at(&self) -> &Timestamp {
        &self.created_at
    }

    pub fn is_reversal(&self) -> bool {
        self.is_correction && self.amount.is_negative()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_income_entry() {
        let tx_id = TransactionId::new();
        let amount = Amount::from_cents(1000);
        let metadata = EntryMetadata::empty();

        let entry = LedgerEntry::new_income(tx_id, amount, metadata).unwrap();

        assert_eq!(entry.transaction_id(), &tx_id);
        assert_eq!(entry.amount().cents(), 1000);
        assert_eq!(entry.entry_type(), TransactionType::Income);
        assert!(!entry.is_correction());
        assert!(entry.parent_entry_id().is_none());
    }

    #[test]
    fn test_new_expense_entry() {
        let tx_id = TransactionId::new();
        let amount = Amount::from_cents(500);
        let metadata = EntryMetadata::empty();

        let entry = LedgerEntry::new_expense(tx_id, amount, metadata).unwrap();

        assert_eq!(entry.entry_type(), TransactionType::Expense);
        assert_eq!(entry.amount().cents(), 500);
    }

    #[test]
    fn test_income_rejects_negative_amount() {
        let tx_id = TransactionId::new();
        let amount = Amount::from_cents(-1000);
        let metadata = EntryMetadata::empty();

        let result = LedgerEntry::new_income(tx_id, amount, metadata);
        assert!(result.is_err());
    }

    #[test]
    fn test_new_reversal() {
        let tx_id = TransactionId::new();
        let amount = Amount::from_cents(1000);
        let metadata = EntryMetadata::empty();

        let original = LedgerEntry::new_income(tx_id, amount, metadata).unwrap();
        let reversal = LedgerEntry::new_reversal(&original);

        assert_eq!(reversal.amount().cents(), -1000);
        assert!(reversal.is_correction());
        assert!(reversal.is_reversal());
        assert_eq!(reversal.parent_entry_id(), Some(original.id()));
    }

    #[test]
    fn test_new_corrected() {
        let tx_id = TransactionId::new();
        let amount = Amount::from_cents(1000);
        let metadata = EntryMetadata::empty();

        let original = LedgerEntry::new_expense(tx_id, amount, metadata.clone()).unwrap();

        let new_amount = Amount::from_cents(1200);
        let corrected = LedgerEntry::new_corrected(&original, new_amount, metadata).unwrap();

        assert_eq!(corrected.amount().cents(), 1200);
        assert!(corrected.is_correction());
        assert!(!corrected.is_reversal()); // Positive amount, so not a reversal
        assert_eq!(corrected.parent_entry_id(), Some(original.id()));
    }

    #[test]
    fn test_metadata_validation() {
        let metadata = EntryMetadata::new(
            Some("Food".to_string()),
            Some("Cash".to_string()),
            Some("Lunch at cafe".to_string()),
            None,
        );
        assert!(metadata.is_ok());
    }

    #[test]
    fn test_metadata_empty_category_fails() {
        let result = EntryMetadata::new(
            Some("".to_string()),
            None,
            None,
            None,
        );
        assert!(result.is_err());
    }
}
