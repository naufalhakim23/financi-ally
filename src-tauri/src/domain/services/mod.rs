// Domain Services: Business logic that doesn't naturally fit within a single entity
// Services coordinate between entities and enforce complex business rules

pub mod correction_service;

pub use correction_service::CorrectionService;
