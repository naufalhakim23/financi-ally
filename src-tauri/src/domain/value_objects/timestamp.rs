use serde::{Deserialize, Serialize};
use std::fmt;

use crate::domain::errors::DomainError;

/// Timestamp value object - immutable timestamp wrapper
/// Represents a point in time in ISO 8601 format
/// This type is immutable to ensure occurred_at and created_at cannot be changed after creation
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct Timestamp(String);

impl Timestamp {
    /// Create a new Timestamp with the current time
    pub fn now() -> Self {
        use std::time::SystemTime;

        let now = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .expect("System time before UNIX epoch");

        // Format as ISO 8601: "2025-12-29T10:30:00Z"
        let datetime = chrono::DateTime::from_timestamp(now.as_secs() as i64, now.subsec_nanos())
            .expect("Invalid timestamp");

        Timestamp(datetime.format("%Y-%m-%dT%H:%M:%SZ").to_string())
    }

    /// Create a Timestamp from an ISO 8601 string
    ///
    /// # Arguments
    /// * `s` - ISO 8601 formatted string (e.g., "2025-12-29T10:30:00Z")
    ///
    /// # Returns
    /// Result containing Timestamp or DomainError if format is invalid
    pub fn from_string(s: &str) -> Result<Self, DomainError> {
        // Basic validation - check if it can be parsed
        chrono::DateTime::parse_from_rfc3339(s)
            .map_err(|e| DomainError::InvalidTimestamp(format!("Invalid ISO 8601 format: {}", e)))?;

        Ok(Timestamp(s.to_string()))
    }

    /// Create a Timestamp from Unix timestamp (seconds since epoch)
    pub fn from_unix(seconds: i64) -> Result<Self, DomainError> {
        let datetime = chrono::DateTime::from_timestamp(seconds, 0)
            .ok_or_else(|| DomainError::InvalidTimestamp("Invalid Unix timestamp".to_string()))?;

        Ok(Timestamp(datetime.format("%Y-%m-%dT%H:%M:%SZ").to_string()))
    }

    /// Get the timestamp as ISO 8601 string
    pub fn as_string(&self) -> &str {
        &self.0
    }

    /// Convert to Unix timestamp (seconds since epoch)
    pub fn to_unix(&self) -> Result<i64, DomainError> {
        chrono::DateTime::parse_from_rfc3339(&self.0)
            .map(|dt| dt.timestamp())
            .map_err(|e| DomainError::InvalidTimestamp(e.to_string()))
    }
}

impl fmt::Display for Timestamp {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_now() {
        let ts = Timestamp::now();
        // Should be valid ISO 8601 format
        assert!(ts.as_string().len() > 0);
        assert!(ts.as_string().contains('T'));
        assert!(ts.as_string().ends_with('Z'));
    }

    #[test]
    fn test_from_string_valid() {
        let iso_str = "2025-12-29T10:30:00Z";
        let result = Timestamp::from_string(iso_str);
        assert!(result.is_ok());
        assert_eq!(result.unwrap().as_string(), iso_str);
    }

    #[test]
    fn test_from_string_invalid() {
        let invalid_str = "not-a-timestamp";
        let result = Timestamp::from_string(invalid_str);
        assert!(result.is_err());
    }

    #[test]
    fn test_from_unix() {
        let unix_ts = 1735470600; // Some timestamp
        let result = Timestamp::from_unix(unix_ts);
        assert!(result.is_ok());
    }

    #[test]
    fn test_to_unix() {
        let iso_str = "2025-12-29T10:30:00Z";
        let ts = Timestamp::from_string(iso_str).unwrap();
        let unix = ts.to_unix();
        assert!(unix.is_ok());
    }

    #[test]
    fn test_ordering() {
        let ts1 = Timestamp::from_string("2025-12-29T10:00:00Z").unwrap();
        let ts2 = Timestamp::from_string("2025-12-29T11:00:00Z").unwrap();

        assert!(ts1 < ts2);
        assert!(ts2 > ts1);
    }

    #[test]
    fn test_display() {
        let iso_str = "2025-12-29T10:30:00Z";
        let ts = Timestamp::from_string(iso_str).unwrap();
        assert_eq!(format!("{}", ts), iso_str);
    }

    #[test]
    fn test_equality() {
        let ts1 = Timestamp::from_string("2025-12-29T10:30:00Z").unwrap();
        let ts2 = Timestamp::from_string("2025-12-29T10:30:00Z").unwrap();
        assert_eq!(ts1, ts2);
    }
}
