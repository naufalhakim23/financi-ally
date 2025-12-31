/// Correction Service
///
/// This is the CRITICAL business logic for immutable ledger corrections.
/// Target: 90% test coverage
///
/// Corrections work via the reversal + new entry pattern:
/// 1. Create a reversal entry (negates the original)
/// 2. Create a new corrected entry (with new data)
/// 3. Both entries reference the original via parent_entry_id
/// 4. Both must be persisted atomically
///
/// Invariants enforced:
/// - Cannot correct a correction (reversal or corrected entry)
/// - Cannot correct with same values as original (no-op)
/// - Reversal and corrected entry must be created together
/// - Original entry is never modified (immutability)

use crate::domain::{
    entities::{
        correction::{CorrectionData, CorrectionResult},
        ledger_entry::LedgerEntry,
    },
    errors::{DomainError, DomainResult},
};

/// Service for creating ledger entry corrections
pub struct CorrectionService;

impl CorrectionService {
    /// Create a correction for a ledger entry
    ///
    /// This generates both the reversal entry and the new corrected entry.
    /// Both must be persisted together in an atomic transaction.
    ///
    /// # Arguments
    /// * `original_entry` - The original entry to correct
    /// * `correction_data` - The new corrected data
    ///
    /// # Returns
    /// A `CorrectionResult` containing both the reversal and corrected entries
    ///
    /// # Errors
    /// - If original entry is already a correction (reversal or corrected)
    /// - If new data is identical to original (no-op correction)
    /// - If correction data is invalid
    pub fn create_correction(
        original_entry: &LedgerEntry,
        correction_data: CorrectionData,
    ) -> DomainResult<CorrectionResult> {
        // Validate: Cannot correct a correction
        if original_entry.is_correction() {
            return Err(DomainError::ValidationError(
                "Cannot correct a correction entry. Only original entries can be corrected."
                    .to_string(),
            ));
        }

        // Validate: New data must be different from original
        Self::validate_correction_changes(original_entry, &correction_data)?;

        // Create reversal entry (negates the original)
        let reversal_entry = LedgerEntry::new_reversal(original_entry);

        // Create new corrected entry
        let corrected_entry = LedgerEntry::new_corrected(
            original_entry,
            correction_data.new_amount,
            correction_data.new_metadata,
        )?;

        Ok(CorrectionResult::new(reversal_entry, corrected_entry))
    }

    /// Validate that correction data differs from original
    ///
    /// Prevents no-op corrections where nothing actually changes
    fn validate_correction_changes(
        original: &LedgerEntry,
        correction: &CorrectionData,
    ) -> DomainResult<()> {
        let amount_unchanged = original.amount().cents() == correction.new_amount.cents();
        let metadata_unchanged = Self::metadata_equals(original.metadata(), &correction.new_metadata);

        if amount_unchanged && metadata_unchanged {
            return Err(DomainError::ValidationError(
                "Correction must change either amount or metadata".to_string(),
            ));
        }

        Ok(())
    }

    /// Compare two EntryMetadata for equality
    fn metadata_equals(
        a: &crate::domain::entities::ledger_entry::EntryMetadata,
        b: &crate::domain::entities::ledger_entry::EntryMetadata,
    ) -> bool {
        a.category == b.category
            && a.payment_method == b.payment_method
            && a.notes == b.notes
            && a.receipt_base64 == b.receipt_base64
    }

    /// Check if an entry can be corrected
    ///
    /// Returns true if the entry is a valid candidate for correction
    pub fn can_correct(entry: &LedgerEntry) -> bool {
        // Only original entries (not corrections) can be corrected
        !entry.is_correction()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{
        entities::ledger_entry::EntryMetadata, value_objects::{Amount, TransactionId},
    };

    // Helper function to create a test entry
    fn create_test_income_entry() -> LedgerEntry {
        let tx_id = TransactionId::new();
        let amount = Amount::from_cents(1000);
        let metadata = EntryMetadata::new(
            Some("Food".to_string()),
            Some("Cash".to_string()),
            Some("Original lunch".to_string()),
            None,
        )
        .unwrap();

        LedgerEntry::new_income(tx_id, amount, metadata).unwrap()
    }

    fn create_test_expense_entry() -> LedgerEntry {
        let tx_id = TransactionId::new();
        let amount = Amount::from_cents(500);
        let metadata = EntryMetadata::new(
            Some("Transport".to_string()),
            Some("Credit Card".to_string()),
            None,
            None,
        )
        .unwrap();

        LedgerEntry::new_expense(tx_id, amount, metadata).unwrap()
    }

    // Test 1: Basic correction - amount changed
    #[test]
    fn test_create_correction_with_amount_change() {
        let original = create_test_income_entry();
        let new_amount = Amount::from_cents(1200); // Changed from 1000
        let correction_data = CorrectionData::with_amount(new_amount, original.metadata().clone());

        let result = CorrectionService::create_correction(&original, correction_data);

        assert!(result.is_ok());
        let correction = result.unwrap();

        // Reversal should negate original
        assert_eq!(correction.reversal_entry.amount().cents(), -1000);
        assert!(correction.reversal_entry.is_correction());
        assert!(correction.reversal_entry.is_reversal());
        assert_eq!(
            correction.reversal_entry.parent_entry_id(),
            Some(original.id())
        );

        // Corrected entry should have new amount
        assert_eq!(correction.corrected_entry.amount().cents(), 1200);
        assert!(correction.corrected_entry.is_correction());
        assert!(!correction.corrected_entry.is_reversal());
        assert_eq!(
            correction.corrected_entry.parent_entry_id(),
            Some(original.id())
        );
    }

    // Test 2: Correction with metadata change only
    #[test]
    fn test_create_correction_with_metadata_change() {
        let original = create_test_expense_entry();
        let new_metadata = EntryMetadata::new(
            Some("Food".to_string()), // Changed from Transport
            Some("Cash".to_string()),  // Changed from Credit Card
            Some("Updated notes".to_string()),
            None,
        )
        .unwrap();
        let correction_data =
            CorrectionData::with_metadata(*original.amount(), new_metadata.clone());

        let result = CorrectionService::create_correction(&original, correction_data);

        assert!(result.is_ok());
        let correction = result.unwrap();

        // Check new metadata
        assert_eq!(
            correction.corrected_entry.metadata().category,
            Some("Food".to_string())
        );
        assert_eq!(
            correction.corrected_entry.metadata().payment_method,
            Some("Cash".to_string())
        );
    }

    // Test 3: Correction with both amount and metadata changed
    #[test]
    fn test_create_correction_with_both_changes() {
        let original = create_test_income_entry();
        let new_amount = Amount::from_cents(1500);
        let new_metadata = EntryMetadata::new(
            Some("Dining".to_string()),
            Some("Credit Card".to_string()),
            Some("Corrected dinner".to_string()),
            None,
        )
        .unwrap();
        let correction_data = CorrectionData::new(new_amount, new_metadata);

        let result = CorrectionService::create_correction(&original, correction_data);

        assert!(result.is_ok());
        let correction = result.unwrap();

        assert_eq!(correction.corrected_entry.amount().cents(), 1500);
        assert_eq!(
            correction.corrected_entry.metadata().category,
            Some("Dining".to_string())
        );
    }

    // Test 4: Cannot correct a reversal entry
    #[test]
    fn test_cannot_correct_reversal_entry() {
        let original = create_test_income_entry();
        let reversal = LedgerEntry::new_reversal(&original);

        let correction_data =
            CorrectionData::with_amount(Amount::from_cents(500), reversal.metadata().clone());

        let result = CorrectionService::create_correction(&reversal, correction_data);

        assert!(result.is_err());
        match result.unwrap_err() {
            DomainError::ValidationError(msg) => {
                assert!(msg.contains("Cannot correct a correction"));
            }
            _ => panic!("Expected ValidationError"),
        }
    }

    // Test 5: Cannot correct a corrected entry
    #[test]
    fn test_cannot_correct_corrected_entry() {
        let original = create_test_expense_entry();
        let corrected = LedgerEntry::new_corrected(
            &original,
            Amount::from_cents(600),
            original.metadata().clone(),
        )
        .unwrap();

        let correction_data =
            CorrectionData::with_amount(Amount::from_cents(700), corrected.metadata().clone());

        let result = CorrectionService::create_correction(&corrected, correction_data);

        assert!(result.is_err());
        match result.unwrap_err() {
            DomainError::ValidationError(msg) => {
                assert!(msg.contains("Cannot correct a correction"));
            }
            _ => panic!("Expected ValidationError"),
        }
    }

    // Test 6: Cannot create no-op correction (same amount and metadata)
    #[test]
    fn test_cannot_create_noop_correction() {
        let original = create_test_income_entry();
        let correction_data = CorrectionData::new(*original.amount(), original.metadata().clone());

        let result = CorrectionService::create_correction(&original, correction_data);

        assert!(result.is_err());
        match result.unwrap_err() {
            DomainError::ValidationError(msg) => {
                assert!(msg.contains("must change either amount or metadata"));
            }
            _ => panic!("Expected ValidationError"),
        }
    }

    // Test 7: can_correct returns true for original entries
    #[test]
    fn test_can_correct_original_entry() {
        let original = create_test_income_entry();
        assert!(CorrectionService::can_correct(&original));
    }

    // Test 8: can_correct returns false for reversal entries
    #[test]
    fn test_cannot_correct_reversal() {
        let original = create_test_expense_entry();
        let reversal = LedgerEntry::new_reversal(&original);
        assert!(!CorrectionService::can_correct(&reversal));
    }

    // Test 9: can_correct returns false for corrected entries
    #[test]
    fn test_cannot_correct_corrected() {
        let original = create_test_income_entry();
        let corrected = LedgerEntry::new_corrected(
            &original,
            Amount::from_cents(1100),
            original.metadata().clone(),
        )
        .unwrap();
        assert!(!CorrectionService::can_correct(&corrected));
    }

    // Test 10: Reversal and corrected entries have same transaction_id as original
    #[test]
    fn test_correction_preserves_transaction_id() {
        let original = create_test_income_entry();
        let correction_data =
            CorrectionData::with_amount(Amount::from_cents(1100), original.metadata().clone());

        let result = CorrectionService::create_correction(&original, correction_data).unwrap();

        assert_eq!(
            result.reversal_entry.transaction_id(),
            original.transaction_id()
        );
        assert_eq!(
            result.corrected_entry.transaction_id(),
            original.transaction_id()
        );
    }

    // Test 11: Correcting with zero amount should fail
    #[test]
    fn test_correction_with_zero_amount_fails() {
        let original = create_test_expense_entry();
        let zero_amount = Amount::from_cents(0);
        let correction_data = CorrectionData::with_amount(zero_amount, original.metadata().clone());

        let result = CorrectionService::create_correction(&original, correction_data);

        // Should fail when trying to create the corrected entry with zero amount
        assert!(result.is_err());
    }

    // Test 12: Metadata comparison works correctly
    #[test]
    fn test_metadata_equals() {
        let meta1 = EntryMetadata::new(
            Some("Food".to_string()),
            Some("Cash".to_string()),
            Some("Notes".to_string()),
            None,
        )
        .unwrap();

        let meta2 = EntryMetadata::new(
            Some("Food".to_string()),
            Some("Cash".to_string()),
            Some("Notes".to_string()),
            None,
        )
        .unwrap();

        let meta3 = EntryMetadata::new(
            Some("Transport".to_string()), // Different
            Some("Cash".to_string()),
            Some("Notes".to_string()),
            None,
        )
        .unwrap();

        assert!(CorrectionService::metadata_equals(&meta1, &meta2));
        assert!(!CorrectionService::metadata_equals(&meta1, &meta3));
    }

    // Test 13: Correction preserves entry type
    #[test]
    fn test_correction_preserves_entry_type() {
        let income_entry = create_test_income_entry();
        let expense_entry = create_test_expense_entry();

        let income_correction = CorrectionService::create_correction(
            &income_entry,
            CorrectionData::with_amount(Amount::from_cents(1100), income_entry.metadata().clone()),
        )
        .unwrap();

        let expense_correction = CorrectionService::create_correction(
            &expense_entry,
            CorrectionData::with_amount(Amount::from_cents(600), expense_entry.metadata().clone()),
        )
        .unwrap();

        assert_eq!(
            income_correction.corrected_entry.entry_type(),
            income_entry.entry_type()
        );
        assert_eq!(
            expense_correction.corrected_entry.entry_type(),
            expense_entry.entry_type()
        );
    }
}
