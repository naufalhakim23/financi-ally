/// Correction value object
///
/// Represents the data needed to correct a ledger entry.
/// This encapsulates the new values that will replace the original entry.
use crate::domain::entities::ledger_entry::EntryMetadata;
use crate::domain::value_objects::Amount;

/// Data for correcting a ledger entry
#[derive(Debug, Clone)]
pub struct CorrectionData {
    /// New corrected amount (in cents)
    pub new_amount: Amount,

    /// New or updated metadata
    pub new_metadata: EntryMetadata,
}

impl CorrectionData {
    pub fn new(new_amount: Amount, new_metadata: EntryMetadata) -> Self {
        Self {
            new_amount,
            new_metadata,
        }
    }

    /// Create correction data with only amount changed
    pub fn with_amount(new_amount: Amount, original_metadata: EntryMetadata) -> Self {
        Self {
            new_amount,
            new_metadata: original_metadata,
        }
    }

    /// Create correction data with only metadata changed
    pub fn with_metadata(original_amount: Amount, new_metadata: EntryMetadata) -> Self {
        Self {
            new_amount: original_amount,
            new_metadata,
        }
    }
}

/// Result of a correction operation
///
/// Contains both the reversal entry and the new corrected entry.
/// These must be persisted together in an atomic transaction.
#[derive(Debug, Clone)]
pub struct CorrectionResult {
    /// The reversal entry (negates the original)
    pub reversal_entry: crate::domain::entities::ledger_entry::LedgerEntry,

    /// The new corrected entry
    pub corrected_entry: crate::domain::entities::ledger_entry::LedgerEntry,
}

impl CorrectionResult {
    pub fn new(
        reversal_entry: crate::domain::entities::ledger_entry::LedgerEntry,
        corrected_entry: crate::domain::entities::ledger_entry::LedgerEntry,
    ) -> Self {
        Self {
            reversal_entry,
            corrected_entry,
        }
    }
}
