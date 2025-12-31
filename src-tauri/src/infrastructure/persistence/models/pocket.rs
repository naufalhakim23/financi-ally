use sqlx::FromRow;

use crate::domain::entities::Pocket;
use crate::domain::repositories::transaction_repository::RepositoryError;
use crate::domain::value_objects::{Currency, Timestamp, TransactionId};

/// Database row representation of a Pocket
///
/// This struct maps directly to the pockets table in SQLite.
/// It handles the conversion between database TEXT types and domain value objects.
#[derive(Debug, Clone, FromRow)]
pub struct PocketRow {
    pub id: String,
    pub name: String,
    pub currency: String,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub color: String,
    pub initial_balance_cents: i64,
    pub current_balance_cents: i64,
    pub is_default: bool, // SQLite stores as INTEGER (0/1), sqlx converts to bool
    pub created_at: String,
    pub updated_at: Option<String>,
    pub deleted_at: Option<String>,
}

impl PocketRow {
    /// Convert from domain Pocket to database PocketRow
    ///
    /// # Arguments
    /// * `pocket` - The domain pocket entity
    ///
    /// # Returns
    /// A PocketRow ready to be inserted/updated in the database
    pub fn from_domain(pocket: &Pocket) -> Self {
        Self {
            id: pocket.id().to_string(),
            name: pocket.name().to_string(),
            currency: pocket.currency().as_str().to_string(),
            description: pocket.description().map(|s| s.to_string()),
            icon: pocket.icon().map(|s| s.to_string()),
            color: pocket.color().to_string(),
            initial_balance_cents: pocket.initial_balance_cents(),
            current_balance_cents: pocket.current_balance_cents(),
            is_default: pocket.is_default(),
            created_at: pocket.created_at().to_string(),
            updated_at: pocket.updated_at().map(|t| t.to_string()),
            deleted_at: pocket.deleted_at().map(|t| t.to_string()),
        }
    }

    /// Convert from database PocketRow to domain Pocket
    ///
    /// # Returns
    /// * `Ok(Pocket)` if conversion succeeds
    /// * `Err(RepositoryError)` if any field fails to parse
    pub fn to_domain(&self) -> Result<Pocket, RepositoryError> {
        let id = TransactionId::from_string(&self.id)?;

        let currency = Currency::from_code(&self.currency)
            .map_err(|e| RepositoryError::SerializationError(e.to_string()))?;

        let created_at = Timestamp::from_string(&self.created_at)?;

        let updated_at = self
            .updated_at
            .as_ref()
            .map(|s| Timestamp::from_string(s))
            .transpose()?;

        let deleted_at = self
            .deleted_at
            .as_ref()
            .map(|s| Timestamp::from_string(s))
            .transpose()?;

        Ok(Pocket::from_persistence(
            id,
            self.name.clone(),
            currency,
            self.description.clone(),
            self.icon.clone(),
            self.color.clone(),
            self.initial_balance_cents,
            self.current_balance_cents,
            self.is_default,
            created_at,
            updated_at,
            deleted_at,
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_from_domain() {
        let pocket = Pocket::new(
            "Test Wallet".to_string(),
            Currency::from_code("EUR").unwrap(),
            Some("Test description".to_string()),
            Some("💶".to_string()),
            "#FF0000".to_string(),
            5000,
        )
        .unwrap();

        let row = PocketRow::from_domain(&pocket);

        assert_eq!(row.name, "Test Wallet");
        assert_eq!(row.currency, "EUR");
        assert_eq!(row.description, Some("Test description".to_string()));
        assert_eq!(row.icon, Some("💶".to_string()));
        assert_eq!(row.color, "#FF0000");
        assert_eq!(row.initial_balance_cents, 5000);
        assert_eq!(row.current_balance_cents, 5000);
        assert!(!row.is_default);
    }

    #[test]
    fn test_to_domain() {
        let row = PocketRow {
            id: TransactionId::new().to_string(),
            name: "Database Wallet".to_string(),
            currency: "USD".to_string(),
            description: Some("From DB".to_string()),
            icon: Some("💰".to_string()),
            color: "#00FF00".to_string(),
            initial_balance_cents: 1000,
            current_balance_cents: 2000,
            is_default: true,
            created_at: "2025-12-31T10:00:00Z".to_string(),
            updated_at: Some("2025-12-31T11:00:00Z".to_string()),
            deleted_at: None,
        };

        let pocket = row.to_domain().unwrap();

        assert_eq!(pocket.name(), "Database Wallet");
        assert_eq!(pocket.currency().as_str(), "USD");
        assert_eq!(pocket.description(), Some("From DB"));
        assert_eq!(pocket.icon(), Some("💰"));
        assert_eq!(pocket.color(), "#00FF00");
        assert_eq!(pocket.initial_balance_cents(), 1000);
        assert_eq!(pocket.current_balance_cents(), 2000);
        assert!(pocket.is_default());
        assert!(pocket.updated_at().is_some());
        assert!(pocket.deleted_at().is_none());
    }

    #[test]
    fn test_roundtrip() {
        let original = Pocket::new(
            "Roundtrip Wallet".to_string(),
            Currency::from_code("IDR").unwrap(),
            None,
            None,
            "#4299E1".to_string(),
            0,
        )
        .unwrap();

        let row = PocketRow::from_domain(&original);
        let restored = row.to_domain().unwrap();

        assert_eq!(restored.name(), original.name());
        assert_eq!(restored.currency().as_str(), original.currency().as_str());
        assert_eq!(restored.color(), original.color());
        assert_eq!(restored.initial_balance_cents(), original.initial_balance_cents());
        assert_eq!(restored.is_default(), original.is_default());
    }
}
