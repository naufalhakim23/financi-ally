// Entities: Objects with identity that persist over time
// Entities are compared by their identity (ID), not by their values

pub mod types;
pub mod ledger_entry;
pub mod transaction;
pub mod correction;
pub mod category;

pub use types::{TransactionType, Scope, TransactionStatus};
pub use ledger_entry::LedgerEntry;
pub use transaction::Transaction;
pub use correction::{CorrectionData, CorrectionResult};
