use serde::{Deserialize, Serialize};
use std::fmt;
use uuid::Uuid;

use crate::domain::errors::DomainError;

/// TransactionId value object - wraps UUID v7
/// UUID v7 provides time-based sorting and conflict-free generation across devices
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct TransactionId(Uuid);

impl TransactionId {
    /// Generate a new UUID v7 transaction ID
    /// UUID v7 is time-ordered, which helps with:
    /// - Natural chronological sorting
    /// - Better database index performance
    /// - Conflict-free generation across multiple devices
    pub fn new() -> Self {
        TransactionId(Uuid::now_v7())
    }

    /// Create a TransactionId from an existing UUID
    pub fn from_uuid(uuid: Uuid) -> Self {
        TransactionId(uuid)
    }

    /// Create a TransactionId from a string representation
    ///
    /// # Arguments
    /// * `s` - UUID string in format "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    ///
    /// # Returns
    /// Result containing TransactionId or DomainError if parsing fails
    pub fn from_string(s: &str) -> Result<Self, DomainError> {
        Uuid::parse_str(s)
            .map(TransactionId)
            .map_err(|e| DomainError::InvalidTransactionId(e.to_string()))
    }

    /// Get the inner UUID
    pub fn as_uuid(&self) -> &Uuid {
        &self.0
    }

    /// Get string representation of the ID
    pub fn as_string(&self) -> String {
        self.0.to_string()
    }
}

impl Default for TransactionId {
    fn default() -> Self {
        Self::new()
    }
}

impl fmt::Display for TransactionId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl From<Uuid> for TransactionId {
    fn from(uuid: Uuid) -> Self {
        TransactionId(uuid)
    }
}

impl From<TransactionId> for Uuid {
    fn from(id: TransactionId) -> Self {
        id.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_transaction_id() {
        let id1 = TransactionId::new();
        let id2 = TransactionId::new();

        // IDs should be different
        assert_ne!(id1, id2);

        // UUID v7 should be time-ordered (id2 should be >= id1 since created after)
        assert!(id2.as_uuid().as_bytes() >= id1.as_uuid().as_bytes());
    }

    #[test]
    fn test_from_string_valid() {
        let uuid_str = "018d3b8c-7e3a-7000-8000-000000000000";
        let result = TransactionId::from_string(uuid_str);
        assert!(result.is_ok());
    }

    #[test]
    fn test_from_string_invalid() {
        let invalid_str = "not-a-uuid";
        let result = TransactionId::from_string(invalid_str);
        assert!(result.is_err());
    }

    #[test]
    fn test_as_string() {
        let id = TransactionId::new();
        let string = id.as_string();

        // Should be able to parse it back
        let parsed = TransactionId::from_string(&string).unwrap();
        assert_eq!(id, parsed);
    }

    #[test]
    fn test_display() {
        let id = TransactionId::new();
        let displayed = format!("{}", id);

        // Should match as_string()
        assert_eq!(displayed, id.as_string());
    }

    #[test]
    fn test_from_uuid() {
        let uuid = Uuid::now_v7();
        let id = TransactionId::from_uuid(uuid);
        assert_eq!(id.as_uuid(), &uuid);
    }

    #[test]
    fn test_default() {
        let id = TransactionId::default();
        // Default should create a new UUID
        assert!(id.as_uuid().get_version_num() == 7);
    }
}
