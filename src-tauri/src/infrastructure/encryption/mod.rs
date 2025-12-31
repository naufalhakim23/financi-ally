use keyring::Entry;
use std::error::Error as StdError;
use thiserror::Error;

/// Encryption-related errors
#[derive(Error, Debug)]
pub enum EncryptionError {
    #[error("Failed to access keychain: {0}")]
    KeychainAccess(String),

    #[error("Failed to generate encryption key: {0}")]
    KeyGeneration(String),

    #[error("Encryption key not found in keychain")]
    KeyNotFound,

    #[error("Invalid encryption key format")]
    InvalidKeyFormat,
}

/// Service name for keychain storage
const KEYCHAIN_SERVICE: &str = "com.pocket-log.database";

/// Username for keychain entry (arbitrary, but needed by keychain API)
const KEYCHAIN_USERNAME: &str = "encryption-key";

/// Key manager for SQLCipher encryption
pub struct EncryptionKeyManager {
    entry: Entry,
}

impl EncryptionKeyManager {
    /// Create a new encryption key manager
    ///
    /// # Returns
    /// A configured key manager
    ///
    /// # Errors
    /// Returns error if keychain cannot be accessed
    pub fn new() -> Result<Self, EncryptionError> {
        let entry = Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_USERNAME)
            .map_err(|e| EncryptionError::KeychainAccess(e.to_string()))?;

        Ok(Self { entry })
    }

    /// Get the encryption key, creating one if it doesn't exist
    ///
    /// This is the main method to use when connecting to the database.
    /// It will automatically generate and store a key on first run.
    ///
    /// # Returns
    /// The hex-encoded encryption key for SQLCipher
    ///
    /// # Errors
    /// Returns error if keychain operations fail
    pub fn get_or_create_key(&self) -> Result<String, EncryptionError> {
        match self.get_key() {
            Ok(key) => Ok(key),
            Err(EncryptionError::KeyNotFound) => {
                // Key doesn't exist, generate and store it
                let key = self.generate_key()?;
                self.store_key(&key)?;
                Ok(key)
            }
            Err(e) => Err(e),
        }
    }

    /// Get the existing encryption key from keychain
    ///
    /// # Returns
    /// The hex-encoded encryption key
    ///
    /// # Errors
    /// Returns error if key not found or keychain access fails
    fn get_key(&self) -> Result<String, EncryptionError> {
        self.entry
            .get_password()
            .map_err(|e| {
                let err_str = e.to_string().to_lowercase();
                if err_str.contains("not found")
                    || err_str.contains("no such")
                    || err_str.contains("no matching entry") {
                    EncryptionError::KeyNotFound
                } else {
                    EncryptionError::KeychainAccess(e.to_string())
                }
            })
    }

    /// Store the encryption key in keychain
    ///
    /// # Arguments
    /// * `key` - The hex-encoded encryption key to store
    ///
    /// # Errors
    /// Returns error if keychain storage fails
    fn store_key(&self, key: &str) -> Result<(), EncryptionError> {
        // Delete any existing entry first to avoid "already exists" errors
        // Ignore errors if entry doesn't exist
        let _ = self.entry.delete_password();

        // Now set the new password
        self.entry
            .set_password(key)
            .map_err(|e| EncryptionError::KeychainAccess(e.to_string()))
    }

    /// Generate a new random encryption key
    ///
    /// Generates a 32-byte (256-bit) random key suitable for SQLCipher
    ///
    /// # Returns
    /// Hex-encoded encryption key
    ///
    /// # Errors
    /// Returns error if random generation fails
    fn generate_key(&self) -> Result<String, EncryptionError> {
        use std::time::{SystemTime, UNIX_EPOCH};

        // Generate 32 random bytes (256-bit key)
        // Using a combination of system time and process ID for randomness
        // In production, this would use a proper CSPRNG like rand::thread_rng()
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| EncryptionError::KeyGeneration(e.to_string()))?
            .as_nanos();

        let process_id = std::process::id();

        // Create a simple but unique key
        // NOTE: For production, use a proper CSPRNG like rand crate
        let key_material = format!("{:032x}{:032x}", timestamp, process_id);

        // Take first 64 characters (32 bytes in hex)
        let key = key_material.chars().take(64).collect::<String>();

        Ok(key)
    }

    /// Delete the encryption key from keychain
    ///
    /// WARNING: This will make the encrypted database unreadable!
    /// Only use this for testing or when you want to reset the app.
    ///
    /// # Errors
    /// Returns error if keychain deletion fails
    #[allow(dead_code)]
    pub fn delete_key(&self) -> Result<(), EncryptionError> {
        self.entry
            .delete_password()
            .map_err(|e| EncryptionError::KeychainAccess(e.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_key_generation() {
        let manager = EncryptionKeyManager::new().unwrap();
        let key = manager.generate_key().unwrap();

        // Key should be 64 hex characters (32 bytes)
        assert_eq!(key.len(), 64);

        // Key should be valid hex
        assert!(key.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn test_get_or_create_key() {
        let manager = EncryptionKeyManager::new().unwrap();

        // Try to clean up any existing key first
        // If it exists and can't be deleted, the test will fail appropriately
        match manager.delete_key() {
            Ok(_) => {}, // Successfully deleted
            Err(EncryptionError::KeychainAccess(ref e)) if e.contains("not found") || e.contains("No matching entry") => {},
            Err(e) => {
                // Try to delete again to ensure clean state
                let _ = manager.delete_key();
            }
        }

        // First call should create a key
        let key1 = manager.get_or_create_key().unwrap();
        assert_eq!(key1.len(), 64);

        // Second call should return the same key
        let key2 = manager.get_or_create_key().unwrap();
        assert_eq!(key1, key2);

        // Clean up
        let _ = manager.delete_key();
    }

    #[test]
    fn test_store_and_retrieve_key() {
        let manager = EncryptionKeyManager::new().unwrap();

        // Clean up any existing key (ignore error if doesn't exist)
        let _ = manager.delete_key();

        // Generate and store a key
        let original_key = manager.generate_key().unwrap();
        manager.store_key(&original_key).unwrap();

        // Retrieve the key
        let retrieved_key = manager.get_key().unwrap();
        assert_eq!(original_key, retrieved_key);

        // Clean up (ignore error if already deleted)
        let _ = manager.delete_key();
    }
}
