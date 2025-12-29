use crate::domain::value_objects::TransactionId;

/// Generate a new UUID v7 transaction ID
///
/// UUID v7 provides:
/// - Time-based ordering (IDs sort chronologically)
/// - Conflict-free generation across devices
/// - Better database index performance
///
/// # Returns
/// A new TransactionId wrapping a UUID v7
pub fn generate_id() -> TransactionId {
    TransactionId::new()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_id() {
        let id1 = generate_id();
        let id2 = generate_id();

        // IDs should be unique
        assert_ne!(id1, id2);

        // IDs should be time-ordered (id2 >= id1 since generated after)
        assert!(id2.as_uuid().as_bytes() >= id1.as_uuid().as_bytes());
    }

    #[test]
    fn test_generated_ids_are_v7() {
        let id = generate_id();

        // UUID v7 has version number 7
        assert_eq!(id.as_uuid().get_version_num(), 7);
    }
}
