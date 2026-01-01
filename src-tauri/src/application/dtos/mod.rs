// DTOs (Data Transfer Objects) - Serializable representations for crossing boundaries
//
// DTOs are used to:
// - Transfer data between application layer and adapters (Tauri commands)
// - Serialize/deserialize data for API responses
// - Avoid exposing domain entities directly to external layers

pub mod pocket_dto;
pub mod transaction_dto;
pub mod category_dto;

pub use pocket_dto::PocketDto;
pub use transaction_dto::{EntryMetadataDto, LedgerEntryDto, TransactionDto};
pub use category_dto::CategoryDto;
