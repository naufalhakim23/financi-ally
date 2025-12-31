use serde::{Deserialize, Serialize};

use crate::domain::entities::Pocket;

/// Data Transfer Object for Pocket entity
///
/// Used to transfer pocket data between application layers
/// without exposing domain entity internals
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PocketDto {
    pub id: String,
    pub name: String,
    pub currency: String,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub color: String,
    pub initial_balance_cents: i64,
    pub current_balance_cents: i64,
    pub is_default: bool,
    pub created_at: String,
    pub updated_at: Option<String>,
}

impl From<&Pocket> for PocketDto {
    fn from(pocket: &Pocket) -> Self {
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
        }
    }
}

impl From<Pocket> for PocketDto {
    fn from(pocket: Pocket) -> Self {
        Self::from(&pocket)
    }
}
