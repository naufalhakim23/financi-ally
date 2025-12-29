// Application layer - Use cases (commands & queries)
//
// This layer orchestrates domain logic and coordinates between domain and infrastructure.
// It contains:
// - Commands: Write operations (CreateTransaction, CorrectTransaction)
// - Queries: Read operations (GetTransaction, ListTransactions, SearchTransactions)
// - DTOs: Data Transfer Objects for serialization across boundaries
//
// The application layer depends on domain but is independent of infrastructure.
// Infrastructure (repositories) is injected via dependency injection.

pub mod commands;
pub mod queries;
pub mod dtos;

pub use dtos::*;
