// Domain layer - Pure business logic with zero I/O dependencies
//
// This layer contains:
// - Value Objects: Immutable types representing domain concepts (Amount, TransactionId, Timestamp)
// - Entities: Objects with identity (Transaction, LedgerEntry)
// - Services: Domain logic that doesn't belong to a single entity (CorrectionService)
// - Repository Traits: Ports for persistence (defined here, implemented in infrastructure)
// - Validation: Business rules enforcement

pub mod value_objects;
pub mod entities;
pub mod services;
pub mod repositories;
pub mod errors;
pub mod validation;
