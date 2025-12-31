use serde::{Deserialize, Serialize};

use crate::domain::errors::{DomainError, DomainResult};
use crate::domain::validation::Validator;
use crate::domain::value_objects::{Currency, Timestamp, TransactionId};

/// Pocket - Entity representing a financial pocket/wallet
///
/// A pocket is an organizational container for transactions. Each pocket has its own
/// currency, balance tracking, and visual customization.
///
/// Key invariants:
/// - Name must be unique (enforced at repository level)
/// - Currency is immutable after creation
/// - Cannot be deleted if it has active transactions
/// - Exactly one default pocket must exist per user
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pocket {
    /// Unique identifier
    id: TransactionId,

    /// Name of the pocket (must be unique)
    name: String,

    /// Currency for this pocket (immutable after creation)
    currency: Currency,

    /// Optional description
    description: Option<String>,

    /// Optional icon (emoji or identifier)
    icon: Option<String>,

    /// Color for visual distinction (hex format: #RRGGBB)
    color: String,

    /// Initial balance when pocket was created (in cents)
    initial_balance_cents: i64,

    /// Current balance (computed from initial + sum of transactions)
    /// This field can be updated after transactions are added
    current_balance_cents: i64,

    /// Whether this is the default pocket for new transactions
    is_default: bool,

    /// When this pocket was created
    created_at: Timestamp,

    /// When this pocket was last updated
    updated_at: Option<Timestamp>,

    /// Soft delete timestamp
    deleted_at: Option<Timestamp>,
}

impl Pocket {
    /// Create a new Pocket
    ///
    /// # Arguments
    /// * `name` - Pocket name (must be unique, max 50 chars)
    /// * `currency` - Currency for this pocket
    /// * `description` - Optional description
    /// * `icon` - Optional icon (emoji)
    /// * `color` - Hex color code (#RRGGBB)
    /// * `initial_balance_cents` - Starting balance in cents
    ///
    /// # Returns
    /// A new Pocket with is_default=false, current_balance=initial_balance
    ///
    /// # Errors
    /// Returns DomainError::ValidationError if validation fails
    pub fn new(
        name: String,
        currency: Currency,
        description: Option<String>,
        icon: Option<String>,
        color: String,
        initial_balance_cents: i64,
    ) -> DomainResult<Self> {
        // Validate inputs
        Validator::validate_pocket_name(&name)?;
        Validator::validate_color_hex(&color)?;

        if let Some(ref desc) = description {
            if desc.len() > 200 {
                return Err(DomainError::ValidationError(
                    "Description must be 200 characters or less".to_string(),
                ));
            }
        }

        if let Some(ref ico) = icon {
            if ico.is_empty() {
                return Err(DomainError::ValidationError(
                    "Icon must not be empty if provided".to_string(),
                ));
            }
        }

        Ok(Self {
            id: TransactionId::new(),
            name,
            currency,
            description,
            icon,
            color,
            initial_balance_cents,
            current_balance_cents: initial_balance_cents, // Start with initial balance
            is_default: false, // Never default on creation
            created_at: Timestamp::now(),
            updated_at: None,
            deleted_at: None,
        })
    }

    /// Reconstruct a Pocket from persistence
    ///
    /// Used by repository to recreate entity from database
    ///
    /// # Arguments
    /// All fields of the Pocket entity
    ///
    /// # Returns
    /// A reconstructed Pocket (bypasses validation for existing data)
    #[allow(clippy::too_many_arguments)]
    pub fn from_persistence(
        id: TransactionId,
        name: String,
        currency: Currency,
        description: Option<String>,
        icon: Option<String>,
        color: String,
        initial_balance_cents: i64,
        current_balance_cents: i64,
        is_default: bool,
        created_at: Timestamp,
        updated_at: Option<Timestamp>,
        deleted_at: Option<Timestamp>,
    ) -> Self {
        Self {
            id,
            name,
            currency,
            description,
            icon,
            color,
            initial_balance_cents,
            current_balance_cents,
            is_default,
            created_at,
            updated_at,
            deleted_at,
        }
    }

    /// Update pocket balance
    ///
    /// This is called after transactions are added or when recomputing balance
    ///
    /// # Arguments
    /// * `new_balance_cents` - New balance in cents
    pub fn update_balance(&mut self, new_balance_cents: i64) {
        self.current_balance_cents = new_balance_cents;
        self.updated_at = Some(Timestamp::now());
    }

    /// Update pocket metadata
    ///
    /// Allows updating name, description, icon, and color
    /// Note: Currency is immutable and cannot be changed
    ///
    /// # Arguments
    /// * `name` - New name (optional, keeps current if None)
    /// * `description` - New description (optional)
    /// * `icon` - New icon (optional)
    /// * `color` - New color (optional, keeps current if None)
    ///
    /// # Errors
    /// Returns DomainError::ValidationError if validation fails
    pub fn update_metadata(
        &mut self,
        name: Option<String>,
        description: Option<Option<String>>,
        icon: Option<Option<String>>,
        color: Option<String>,
    ) -> DomainResult<()> {
        // Validate new values before applying
        if let Some(ref new_name) = name {
            Validator::validate_pocket_name(new_name)?;
        }

        if let Some(ref new_color) = color {
            Validator::validate_color_hex(new_color)?;
        }

        if let Some(Some(ref desc)) = description {
            if desc.len() > 200 {
                return Err(DomainError::ValidationError(
                    "Description must be 200 characters or less".to_string(),
                ));
            }
        }

        if let Some(Some(ref ico)) = icon {
            if ico.is_empty() {
                return Err(DomainError::ValidationError(
                    "Icon must not be empty if provided".to_string(),
                ));
            }
        }

        // Apply updates
        if let Some(new_name) = name {
            self.name = new_name;
        }

        if let Some(new_description) = description {
            self.description = new_description;
        }

        if let Some(new_icon) = icon {
            self.icon = new_icon;
        }

        if let Some(new_color) = color {
            self.color = new_color;
        }

        self.updated_at = Some(Timestamp::now());
        Ok(())
    }

    /// Mark this pocket as the default pocket
    pub fn mark_as_default(&mut self) {
        self.is_default = true;
        self.updated_at = Some(Timestamp::now());
    }

    /// Unmark this pocket as default
    pub fn unmark_as_default(&mut self) {
        self.is_default = false;
        self.updated_at = Some(Timestamp::now());
    }

    /// Soft delete this pocket
    ///
    /// Note: Should only be called after validating no transactions exist
    pub fn soft_delete(&mut self) {
        self.deleted_at = Some(Timestamp::now());
    }

    /// Check if this pocket is deleted
    pub fn is_deleted(&self) -> bool {
        self.deleted_at.is_some()
    }

    /// Check if this pocket is the default
    pub fn is_default(&self) -> bool {
        self.is_default
    }

    // Getters

    pub fn id(&self) -> &TransactionId {
        &self.id
    }

    pub fn name(&self) -> &str {
        &self.name
    }

    pub fn currency(&self) -> &Currency {
        &self.currency
    }

    pub fn description(&self) -> Option<&str> {
        self.description.as_deref()
    }

    pub fn icon(&self) -> Option<&str> {
        self.icon.as_deref()
    }

    pub fn color(&self) -> &str {
        &self.color
    }

    pub fn initial_balance_cents(&self) -> i64 {
        self.initial_balance_cents
    }

    pub fn current_balance_cents(&self) -> i64 {
        self.current_balance_cents
    }

    pub fn created_at(&self) -> &Timestamp {
        &self.created_at
    }

    pub fn updated_at(&self) -> Option<&Timestamp> {
        self.updated_at.as_ref()
    }

    pub fn deleted_at(&self) -> Option<&Timestamp> {
        self.deleted_at.as_ref()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_pocket_valid() {
        let pocket = Pocket::new(
            "My Wallet".to_string(),
            Currency::from_code("USD").unwrap(),
            Some("Personal spending money".to_string()),
            Some("💰".to_string()),
            "#4299E1".to_string(),
            1000, // $10.00
        )
        .unwrap();

        assert_eq!(pocket.name(), "My Wallet");
        assert_eq!(pocket.currency().as_str(), "USD");
        assert_eq!(pocket.description(), Some("Personal spending money"));
        assert_eq!(pocket.icon(), Some("💰"));
        assert_eq!(pocket.color(), "#4299E1");
        assert_eq!(pocket.initial_balance_cents(), 1000);
        assert_eq!(pocket.current_balance_cents(), 1000);
        assert!(!pocket.is_default());
        assert!(!pocket.is_deleted());
    }

    #[test]
    fn test_new_pocket_empty_name() {
        let result = Pocket::new(
            "".to_string(),
            Currency::from_code("USD").unwrap(),
            None,
            None,
            "#4299E1".to_string(),
            0,
        );

        assert!(result.is_err());
    }

    #[test]
    fn test_new_pocket_name_too_long() {
        let long_name = "a".repeat(51);
        let result = Pocket::new(
            long_name,
            Currency::from_code("USD").unwrap(),
            None,
            None,
            "#4299E1".to_string(),
            0,
        );

        assert!(result.is_err());
    }

    #[test]
    fn test_new_pocket_invalid_color() {
        let result = Pocket::new(
            "Wallet".to_string(),
            Currency::from_code("USD").unwrap(),
            None,
            None,
            "invalid".to_string(),
            0,
        );

        assert!(result.is_err());
    }

    #[test]
    fn test_update_balance() {
        let mut pocket = Pocket::new(
            "Wallet".to_string(),
            Currency::from_code("USD").unwrap(),
            None,
            None,
            "#4299E1".to_string(),
            1000,
        )
        .unwrap();

        assert_eq!(pocket.current_balance_cents(), 1000);
        assert!(pocket.updated_at().is_none());

        pocket.update_balance(2000);

        assert_eq!(pocket.current_balance_cents(), 2000);
        assert!(pocket.updated_at().is_some());
    }

    #[test]
    fn test_update_metadata() {
        let mut pocket = Pocket::new(
            "Old Name".to_string(),
            Currency::from_code("USD").unwrap(),
            None,
            None,
            "#000000".to_string(),
            0,
        )
        .unwrap();

        pocket
            .update_metadata(
                Some("New Name".to_string()),
                Some(Some("New description".to_string())),
                Some(Some("🎯".to_string())),
                Some("#FF0000".to_string()),
            )
            .unwrap();

        assert_eq!(pocket.name(), "New Name");
        assert_eq!(pocket.description(), Some("New description"));
        assert_eq!(pocket.icon(), Some("🎯"));
        assert_eq!(pocket.color(), "#FF0000");
        assert!(pocket.updated_at().is_some());
    }

    #[test]
    fn test_update_metadata_partial() {
        let mut pocket = Pocket::new(
            "Original".to_string(),
            Currency::from_code("USD").unwrap(),
            Some("Original description".to_string()),
            None,
            "#000000".to_string(),
            0,
        )
        .unwrap();

        // Only update color
        pocket
            .update_metadata(None, None, None, Some("#FF0000".to_string()))
            .unwrap();

        assert_eq!(pocket.name(), "Original");
        assert_eq!(pocket.description(), Some("Original description"));
        assert_eq!(pocket.color(), "#FF0000");
    }

    #[test]
    fn test_mark_as_default() {
        let mut pocket = Pocket::new(
            "Wallet".to_string(),
            Currency::from_code("USD").unwrap(),
            None,
            None,
            "#4299E1".to_string(),
            0,
        )
        .unwrap();

        assert!(!pocket.is_default());

        pocket.mark_as_default();

        assert!(pocket.is_default());
        assert!(pocket.updated_at().is_some());
    }

    #[test]
    fn test_soft_delete() {
        let mut pocket = Pocket::new(
            "Wallet".to_string(),
            Currency::from_code("USD").unwrap(),
            None,
            None,
            "#4299E1".to_string(),
            0,
        )
        .unwrap();

        assert!(!pocket.is_deleted());
        assert!(pocket.deleted_at().is_none());

        pocket.soft_delete();

        assert!(pocket.is_deleted());
        assert!(pocket.deleted_at().is_some());
    }

    #[test]
    fn test_from_persistence() {
        let id = TransactionId::new();
        let created_at = Timestamp::now();
        let updated_at = Timestamp::now();

        let pocket = Pocket::from_persistence(
            id.clone(),
            "Persisted Wallet".to_string(),
            Currency::from_code("EUR").unwrap(),
            Some("From DB".to_string()),
            Some("💶".to_string()),
            "#00FF00".to_string(),
            5000,
            7500,
            true,
            created_at.clone(),
            Some(updated_at.clone()),
            None,
        );

        assert_eq!(pocket.id(), &id);
        assert_eq!(pocket.name(), "Persisted Wallet");
        assert_eq!(pocket.currency().as_str(), "EUR");
        assert_eq!(pocket.initial_balance_cents(), 5000);
        assert_eq!(pocket.current_balance_cents(), 7500);
        assert!(pocket.is_default());
        assert_eq!(pocket.created_at(), &created_at);
        assert_eq!(pocket.updated_at(), Some(&updated_at));
    }
}
