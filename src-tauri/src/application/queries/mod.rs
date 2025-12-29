// Queries - Read operations that retrieve state
//
// Queries follow the Query pattern:
// - Each query is a struct representing the request parameters
// - Each query has a corresponding handler that executes the retrieval logic
// - Handlers use the repository to fetch data

pub mod get_transaction;
pub mod list_transactions;
pub mod search_transactions;

pub use get_transaction::{GetTransactionQuery, GetTransactionHandler};
pub use list_transactions::{ListTransactionsQuery, ListTransactionsHandler};
pub use search_transactions::{SearchTransactionsQuery, SearchTransactionsHandler};
