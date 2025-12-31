use sqlx::FromRow;

use crate::domain::{
    entities::{
        category::Category,
    },
    errors::DomainError,
    value_objects::{Timestamp, TransactionId},
};

/// Database row for categories table
#[derive(Debug, FromRow)]
pub struct CategoryRow {
    pub id: String,
    pub name: String,
    pub code: String,
    pub description: Option<String>,
    pub color: String,
    pub is_expense: bool,
    pub is_income: bool,
    pub created_at: String,
    pub updated_at: Option<String>,
    pub deleted_at: Option<String>,
}

impl CategoryRow {
    /// Conver database row to domain entity
    pub fn to_domain(&self) -> Result<Category, DomainError> {
        let id = TransactionId::from_string(&self.id)?;
        let name = self.name.clone();
        let code = self.code.clone();
        let description = self.description.clone();
        let color = self.color.clone();
        let is_expense = self.is_expense;
        let is_income = self.is_income;
        let created_at = Timestamp::from_string(&self.created_at)?;
        let updated_at = if let Some(updated_at_str) = &self.updated_at {
            Some(Timestamp::from_string(updated_at_str)?)
        } else {
            None
        };
        let deleted_at = if let Some(deleted_at_str) = &self.deleted_at {
            Some(Timestamp::from_string(deleted_at_str)?)
        } else {
            None
        };

        let tx = Category::from_persistence(
            id, 
            name,
            code,
            description, 
            color, 
            is_expense, 
            is_income, 
            created_at, 
            updated_at, 
            deleted_at
        );
        Ok(tx)
    }

    // Create database row from domain entity
    pub fn from_domain(category: &Category) -> Self {
        Self {
            id: category.id.to_string(),
            name: category.name.clone(),
            code: category.code.clone(),
            description: category.description.clone(),
            color: category.color.clone(),
            is_expense: category.is_expense,
            is_income: category.is_income,
            created_at: category.created_at.to_string(),
            updated_at: category.updated_at.as_ref().map(|ts| ts.to_string()),
            deleted_at: category.deleted_at.as_ref().map(|ts| ts.to_string()),
        }
    }
}