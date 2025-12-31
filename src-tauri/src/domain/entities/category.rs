use serde::{Deserialize, Serialize};

use crate::domain::errors::{DomainError, DomainResult};
use crate::domain::validation::Validator;
use crate::domain::value_objects::{Amount, Timestamp, TransactionId};

/// Category entity representing a financial category
///
/// A category can be used to classify transactions as income or expense.
/// It contains:
/// - metadata such as name, code, description, color, and timestamps
///
/// Key invariants:
/// - A category must have a unique name
/// - Once created, the category ID is immutable

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Category {
    pub id: TransactionId,
    pub name: String,
    pub code: String,
    pub description: Option<String>,
    pub color: String,
    pub is_expense: bool,
    pub is_income: bool,
    pub created_at: Timestamp,
    pub updated_at: Option<Timestamp>,
    pub deleted_at: Option<Timestamp>,
}

impl Category {
    // Create new Category from entry point
    pub fn new_category(
        name: String,
        code: String,
        description: Option<String>,
        color: String,
        is_expense: bool,
        is_income: bool,
    ) -> DomainResult<Self> {
        // Validate inputs
        Validator::validate_category_name(&name)?;
        Validator::validate_category_code(&code)?;
        Validator::validate_color_code(&color)?;

        let category = Category {
            id: TransactionId::new(),
            name,
            code,
            description,
            color,
            is_expense,
            is_income,
            created_at: Timestamp::now(),
            updated_at: Some(Timestamp::now()),
            deleted_at: None,
        };

        Ok(category)
    }

    /// Reconstruct Category from persistence layer
    #[doc(hidden)]
    pub fn from_persistence(
        id: TransactionId,
        name: String,
        code: String,
        description: Option<String>,
        color: String,
        is_expense: bool,
        is_income: bool,
        created_at: Timestamp,
        updated_at: Option<Timestamp>,
        deleted_at: Option<Timestamp>,
    ) -> Self {
        Self {
            id,
            name,
            code,
            description,
            color,
            is_expense,
            is_income,
            created_at,
            updated_at,
            deleted_at,
        }
    }
}
