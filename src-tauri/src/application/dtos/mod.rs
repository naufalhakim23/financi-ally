// DTOs (Data Transfer Objects) - Serializable representations for crossing boundaries
//
// DTOs are used to:
// - Transfer data between application layer and adapters (Tauri commands)
// - Serialize/deserialize data for API responses
// - Avoid exposing domain entities directly to external layers

pub mod transaction_dto;

pub use transaction_dto::{TransactionDto, LedgerEntryDto, EntryMetadataDto};
