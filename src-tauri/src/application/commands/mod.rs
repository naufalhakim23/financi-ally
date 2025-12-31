// Commands - Write operations that modify state
//
// Commands follow the Command pattern:
// - Each command is a struct representing the request data
// - Each command has a corresponding handler that executes the business logic
// - Handlers use the repository to persist changes

// Transaction commands
pub mod correct_transaction;
pub mod create_transaction;

// Pocket commands
pub mod create_pocket;
pub mod delete_pocket;
pub mod set_default_pocket;
pub mod update_pocket;

// Transaction command exports
pub use correct_transaction::{CorrectTransactionCommand, CorrectTransactionHandler};
pub use create_transaction::{CreateTransactionCommand, CreateTransactionHandler};

// Pocket command exports
pub use create_pocket::{CreatePocketCommand, CreatePocketHandler};
pub use delete_pocket::{DeletePocketCommand, DeletePocketHandler};
pub use set_default_pocket::{SetDefaultPocketCommand, SetDefaultPocketHandler};
pub use update_pocket::{UpdatePocketCommand, UpdatePocketHandler};
