// Queries - Read operations that retrieve state
//
// Queries follow the Query pattern:
// - Each query is a struct representing the request parameters
// - Each query has a corresponding handler that executes the retrieval logic
// - Handlers use the repository to fetch data

// Transaction queries
pub mod get_transaction;
pub mod list_transactions;
pub mod search_transactions;

// Pocket queries
pub mod get_pocket;
pub mod list_pockets;

// Transaction query exports
pub use get_transaction::{GetTransactionHandler, GetTransactionQuery};
pub use list_transactions::{ListTransactionsHandler, ListTransactionsQuery};
pub use search_transactions::{SearchTransactionsHandler, SearchTransactionsQuery};

// Pocket query exports
pub use get_pocket::{GetPocketHandler, GetPocketQuery};
pub use list_pockets::{ListPocketsHandler, ListPocketsQuery};
