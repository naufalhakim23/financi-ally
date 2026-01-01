use serde::{Deserialize, Serialize};

use crate::domain::entities::ledger_entry::LedgerEntry;
use crate::domain::entities::types::{Scope, TransactionStatus};
use crate::domain::errors::{DomainError, DomainResult};
use crate::domain::validation::Validator;
use crate::domain::value_objects::{Amount, Timestamp, TransactionId};

/// Transaction - Aggregate root for the ledger
///
/// A transaction represents a financial event that happened at a specific time.
/// It contains:
/// - Header information (description, occurred_at, scope, status)
/// - One or more ledger entries (the actual value movements)
///
/// Key invariants:
/// - A transaction must have at least one ledger entry
/// - Once created, timestamp and ID are immutable
/// - Modifications happen through corrections (new entries), not updates
/// - Total amount is derived from summing all entries
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transaction {
    /// Unique identifier
    id: TransactionId,

    /// Optional description of the transaction
    description: Option<String>,

    /// When the transaction occurred (can differ from created_at)
    /// This is immutable - use correction entries to fix mistakes
    occurred_at: Timestamp,

    /// Whether this is personal or business
    scope: Scope,

    /// Current status of the transaction
    status: TransactionStatus,

    /// When this transaction record was created
    created_at: Timestamp,

    /// Which pocket this transaction belongs to
    /// Every transaction must belong to exactly one pocket
    pocket_id: TransactionId,

    /// Ledger entries associated with this transaction
    /// At least one entry is required
    /// Corrections add more entries (reversal + new entry)
    entries: Vec<LedgerEntry>,
}

impl Transaction {
    /// Create a new transaction
    ///
    /// # Arguments
    /// * `description` - Optional description
    /// * `occurred_at` - When the transaction occurred
    /// * `scope` - Personal or Business
    /// * `pocket_id` - The pocket this transaction belongs to (required)
    ///
    /// # Returns
    /// A new Transaction with no entries yet (entries added separately)
    pub fn new(
        description: Option<String>,
        occurred_at: Timestamp,
        scope: Scope,
        pocket_id: TransactionId,
    ) -> DomainResult<Self> {
        Validator::validate_description(&description)?;

        Ok(Self {
            id: TransactionId::new(),
            description,
            occurred_at,
            scope,
            status: TransactionStatus::Active,
            created_at: Timestamp::now(),
            pocket_id,
            entries: Vec::new(),
        })
    }

    /// Add a ledger entry to this transaction
    ///
    /// # Arguments
    /// * `entry` - The ledger entry to add
    ///
    /// # Returns
    /// Result indicating success or validation error
    pub fn add_entry(&mut self, entry: LedgerEntry) -> DomainResult<()> {
        // Verify entry belongs to this transaction
        if entry.transaction_id() != &self.id {
            return Err(DomainError::ValidationError(
                "Entry transaction_id does not match transaction".to_string(),
            ));
        }

        self.entries.push(entry);
        Ok(())
    }

    /// Mark this transaction as corrected
    /// Called when correction entries are added
    pub fn mark_corrected(&mut self) {
        self.status = TransactionStatus::Corrected;
    }

    /// Mark this transaction as voided (rare, exceptional cases)
    pub fn mark_voided(&mut self) {
        self.status = TransactionStatus::Voided;
    }

    /// Check if this transaction has been corrected
    pub fn is_corrected(&self) -> bool {
        self.status == TransactionStatus::Corrected
    }

    /// Calculate the total amount from all entries
    ///
    /// For income entries: adds to total
    /// For expense entries: subtracts from total
    /// Reversal entries (negative amounts): adjust total
    ///
    /// # Returns
    /// Net amount across all entries
    pub fn total_amount(&self) -> Amount {
        self.entries
            .iter()
            .fold(Amount::from_cents(0), |total, entry| {
                match entry.entry_type() {
                    crate::domain::entities::types::TransactionType::Income => {
                        total.add(entry.amount())
                    }
                    crate::domain::entities::types::TransactionType::Expense => {
                        // Expenses are stored as positive but subtract from total
                        total.subtract(entry.amount())
                    }
                }
            })
    }

    /// Get active entries (non-corrected entries)
    /// This returns entries that haven't been reversed by corrections
    pub fn active_entries(&self) -> Vec<&LedgerEntry> {
        if self.status != TransactionStatus::Corrected {
            // If not corrected, all entries are active
            return self.entries.iter().collect();
        }

        // If corrected, filter out entries that have been reversed
        let reversed_ids: Vec<&TransactionId> = self
            .entries
            .iter()
            .filter(|e| e.is_reversal())
            .filter_map(|e| e.parent_entry_id())
            .collect();

        self.entries
            .iter()
            .filter(|e| {
                // Include if:
                // 1. Not a reversal AND not reversed by another entry
                // 2. OR is a correction but not a reversal (the new corrected entry)
                if e.is_reversal() {
                    false // Exclude reversals from active entries
                } else if reversed_ids.contains(&e.id()) {
                    false // Exclude entries that have been reversed
                } else {
                    true // Include active entries and new corrections
                }
            })
            .collect()
    }

    // Getters (immutable access)
    pub fn id(&self) -> &TransactionId {
        &self.id
    }

    pub fn description(&self) -> &Option<String> {
        &self.description
    }

    pub fn occurred_at(&self) -> &Timestamp {
        &self.occurred_at
    }

    pub fn scope(&self) -> Scope {
        self.scope
    }

    pub fn status(&self) -> TransactionStatus {
        self.status
    }

    pub fn created_at(&self) -> &Timestamp {
        &self.created_at
    }

    pub fn entries(&self) -> &[LedgerEntry] {
        &self.entries
    }

    pub fn pocket_id(&self) -> &TransactionId {
        &self.pocket_id
    }

    /// Check if transaction has any entries
    pub fn has_entries(&self) -> bool {
        !self.entries.is_empty()
    }

    /// Reconstruct a transaction from persistence (for infrastructure layer)
    /// This is used by the repository to restore transactions from the database
    #[doc(hidden)]
    pub fn from_persistence(
        id: TransactionId,
        description: Option<String>,
        occurred_at: Timestamp,
        scope: Scope,
        status: TransactionStatus,
        created_at: Timestamp,
        pocket_id: TransactionId,
    ) -> Self {
        Self {
            id,
            description,
            occurred_at,
            scope,
            status,
            created_at,
            pocket_id,
            entries: Vec::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::entities::ledger_entry::EntryMetadata;

    #[test]
    fn test_new_transaction() {
        let description = Some("Test transaction".to_string());
        let occurred_at = Timestamp::now();
        let scope = Scope::Personal;
        let pocket_id = TransactionId::new();

        let tx = Transaction::new(description.clone(), occurred_at.clone(), scope, pocket_id.clone()).unwrap();

        assert_eq!(tx.description(), &description);
        assert_eq!(tx.occurred_at(), &occurred_at);
        assert_eq!(tx.scope(), Scope::Personal);
        assert_eq!(tx.status(), TransactionStatus::Active);
        assert_eq!(tx.pocket_id(), &pocket_id);
        assert!(!tx.has_entries());
    }

    #[test]
    fn test_add_entry() {
        let tx_occurred_at = Timestamp::now();
        let pocket_id = TransactionId::new();
        let mut tx = Transaction::new(None, tx_occurred_at, Scope::Personal, pocket_id).unwrap();

        let amount = Amount::from_cents(1000);
        let metadata = EntryMetadata::empty();
        let entry = LedgerEntry::new_expense(*tx.id(), amount, metadata, None).unwrap();

        tx.add_entry(entry).unwrap();

        assert!(tx.has_entries());
        assert_eq!(tx.entries().len(), 1);
    }

    #[test]
    fn test_add_entry_wrong_transaction_id() {
        let pocket_id = TransactionId::new();
        let mut tx = Transaction::new(None, Timestamp::now(), Scope::Personal, pocket_id).unwrap();

        let wrong_tx_id = TransactionId::new();
        let amount = Amount::from_cents(1000);
        let metadata = EntryMetadata::empty();
        let entry = LedgerEntry::new_expense(wrong_tx_id, amount, metadata, None).unwrap();

        let result = tx.add_entry(entry);
        assert!(result.is_err());
    }

    #[test]
    fn test_total_amount_single_expense() {
        let pocket_id = TransactionId::new();
        let mut tx = Transaction::new(None, Timestamp::now(), Scope::Personal, pocket_id).unwrap();

        let amount = Amount::from_cents(1000);
        let metadata = EntryMetadata::empty();
        let entry = LedgerEntry::new_expense(*tx.id(), amount, metadata, None).unwrap();
        tx.add_entry(entry).unwrap();

        // Expense of 1000 should result in -1000 total
        assert_eq!(tx.total_amount().cents(), -1000);
    }

    #[test]
    fn test_total_amount_single_income() {
        let pocket_id = TransactionId::new();
        let mut tx = Transaction::new(None, Timestamp::now(), Scope::Business, pocket_id).unwrap();

        let amount = Amount::from_cents(5000);
        let metadata = EntryMetadata::empty();
        let entry = LedgerEntry::new_income(*tx.id(), amount, metadata, None).unwrap();
        tx.add_entry(entry).unwrap();

        // Income of 5000 should result in +5000 total
        assert_eq!(tx.total_amount().cents(), 5000);
    }

    #[test]
    fn test_total_amount_with_correction() {
        let pocket_id = TransactionId::new();
        let mut tx = Transaction::new(None, Timestamp::now(), Scope::Personal, pocket_id).unwrap();

        // Original expense: $10.00
        let amount = Amount::from_cents(1000);
        let metadata = EntryMetadata::empty();
        let original = LedgerEntry::new_expense(*tx.id(), amount, metadata.clone()).unwrap();
        tx.add_entry(original.clone()).unwrap();

        // Correction: reverse original + add corrected $15.00
        let reversal = LedgerEntry::new_reversal(&original);
        tx.add_entry(reversal).unwrap();

        let corrected_amount = Amount::from_cents(1500);
        let corrected = LedgerEntry::new_corrected(&original, corrected_amount, metadata).unwrap();
        tx.add_entry(corrected).unwrap();
        tx.mark_corrected();

        // Should have: -1000 (original) +1000 (reversal) -1500 (corrected) = -1500
        assert_eq!(tx.total_amount().cents(), -1500);
    }

    #[test]
    fn test_mark_corrected() {
        let pocket_id = TransactionId::new();
        let mut tx = Transaction::new(None, Timestamp::now(), Scope::Personal, pocket_id).unwrap();
        assert!(!tx.is_corrected());

        tx.mark_corrected();
        assert!(tx.is_corrected());
        assert_eq!(tx.status(), TransactionStatus::Corrected);
    }

    #[test]
    fn test_active_entries() {
        let pocket_id = TransactionId::new();
        let mut tx = Transaction::new(None, Timestamp::now(), Scope::Personal, pocket_id).unwrap();

        let amount = Amount::from_cents(1000);
        let metadata = EntryMetadata::empty();
        let original = LedgerEntry::new_expense(*tx.id(), amount, metadata.clone()).unwrap();
        tx.add_entry(original.clone()).unwrap();

        // Before correction: 1 active entry
        assert_eq!(tx.active_entries().len(), 1);

        // Add correction
        let reversal = LedgerEntry::new_reversal(&original);
        tx.add_entry(reversal).unwrap();

        let corrected_amount = Amount::from_cents(1500);
        let corrected = LedgerEntry::new_corrected(&original, corrected_amount, metadata).unwrap();
        tx.add_entry(corrected).unwrap();
        tx.mark_corrected();

        // After correction: should have 1 active entry (the corrected one)
        // Original is reversed, reversal is excluded
        let active = tx.active_entries();
        assert_eq!(active.len(), 1);
        assert_eq!(active[0].amount().cents(), 1500);
    }

    #[test]
    fn test_description_too_long() {
        let long_desc = Some("a".repeat(501));
        let pocket_id = TransactionId::new();
        let result = Transaction::new(long_desc, Timestamp::now(), Scope::Personal, pocket_id);
        assert!(result.is_err());
    }
}
