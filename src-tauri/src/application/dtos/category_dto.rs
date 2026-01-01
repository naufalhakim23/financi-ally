use serde::{Deserialize, Serialize};

use crate::domain::entities::Category;

/// Data Transfer Object for Category entity
///
/// Used to transfer category data between application layers
/// without exposing domain entity internals
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryDto {
    pub id: String,
    pub name: String,
    pub code: String,
    pub description: Option<String>,
    pub color: String,
    pub is_expense: bool,
    pub is_income: bool,
    pub created_at: String,
    pub updated_at: Option<String>,
}

impl From<&Category> for CategoryDto {
    fn from(category: &Category) -> Self {
        Self {
            id: category.id.to_string(),
            name: category.name.clone(),
            code: category.code.clone(),
            description: category.description.clone(),
            color: category.color.clone(),
            is_expense: category.is_expense,
            is_income: category.is_income,
            created_at: category.created_at.to_string(),
            updated_at: category.updated_at.as_ref().map(|t| t.to_string()),
        }
    }
}

impl From<Category> for CategoryDto {
    fn from(category: Category) -> Self {
        Self::from(&category)
    }
}
