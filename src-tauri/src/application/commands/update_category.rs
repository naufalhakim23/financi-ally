use std::sync::Arc;

use crate::{
    application::dtos::CategoryDto,
    domain::{
        repositories::category_repository::CategoryRepository,
        repositories::transaction_repository::RepositoryError,
        value_objects::TransactionId,
    },
};

/// Command to update an existing category
///
/// Note: Category code and type flags (is_expense/is_income) are immutable
/// Only name, description, and color can be updated
#[derive(Debug, Clone)]
pub struct UpdateCategoryCommand {
    pub category_id: String,
    pub name: Option<String>,
    pub description: Option<Option<String>>, // None = don't update, Some(None) = clear, Some(Some(val)) = set
    pub color: Option<String>,
}

/// Handler for UpdateCategoryCommand
pub struct UpdateCategoryHandler {
    category_repo: Arc<dyn CategoryRepository>,
}

impl UpdateCategoryHandler {
    /// Create a new handler
    pub fn new(category_repo: Arc<dyn CategoryRepository>) -> Self {
        Self { category_repo }
    }

    /// Execute the command to update a category
    ///
    /// # Arguments
    /// * `command` - The update category command
    ///
    /// # Returns
    /// * `Ok(CategoryDto)` - The updated category
    /// * `Err(RepositoryError)` - If category not found or validation fails
    pub async fn handle(&self, command: UpdateCategoryCommand) -> Result<CategoryDto, RepositoryError> {
        // Parse ID
        let id = TransactionId::from_string(&command.category_id)
            .map_err(|e| RepositoryError::ValidationError(e.to_string()))?;

        // Find existing category
        let mut category = self
            .category_repo
            .find_by_id(&id)
            .await?
            .ok_or_else(|| RepositoryError::NotFound(format!("Category with id {} not found", command.category_id)))?;

        // Update mutable fields
        if let Some(name) = command.name {
            category.name = name;
        }

        if let Some(description_opt) = command.description {
            category.description = description_opt;
        }

        if let Some(color) = command.color {
            category.color = color;
        }

        // Update timestamp
        category.updated_at = Some(crate::domain::value_objects::Timestamp::now());

        // Persist changes
        self.category_repo.update(&category).await?;

        // Convert to DTO for response
        Ok(CategoryDto::from(&category))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        application::commands::create_category::{CreateCategoryCommand, CreateCategoryHandler},
        infrastructure::persistence::{
            schema::run_migrations, sqlite_category_repository::SqliteCategoryRepository,
        },
    };
    use sqlx::SqlitePool;

    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        run_migrations(&pool).await.unwrap();
        pool
    }

    async fn create_test_category(repo: &Arc<SqliteCategoryRepository>) -> CategoryDto {
        let handler = CreateCategoryHandler::new(repo.clone());
        let command = CreateCategoryCommand {
            name: "Original Name".to_string(),
            code: "original_code".to_string(),
            description: Some("Original description".to_string()),
            color: "#000000".to_string(),
            is_expense: true,
            is_income: false,
        };
        handler.handle(command).await.unwrap()
    }

    #[tokio::test]
    async fn test_update_category_name() {
        let pool = setup_test_db().await;
        let repo = Arc::new(SqliteCategoryRepository::new(Arc::new(pool)));
        let handler = UpdateCategoryHandler::new(repo.clone());

        let category = create_test_category(&repo).await;

        let command = UpdateCategoryCommand {
            category_id: category.id.clone(),
            name: Some("Updated Name".to_string()),
            description: None,
            color: None,
        };

        let result = handler.handle(command).await;
        assert!(result.is_ok());

        let updated = result.unwrap();
        assert_eq!(updated.name, "Updated Name");
        assert_eq!(updated.description, Some("Original description".to_string()));
        assert_eq!(updated.color, "#000000");
    }

    #[tokio::test]
    async fn test_update_category_all_fields() {
        let pool = setup_test_db().await;
        let repo = Arc::new(SqliteCategoryRepository::new(Arc::new(pool)));
        let handler = UpdateCategoryHandler::new(repo.clone());

        let category = create_test_category(&repo).await;

        let command = UpdateCategoryCommand {
            category_id: category.id.clone(),
            name: Some("New Name".to_string()),
            description: Some(Some("New description".to_string())),
            color: Some("#FF0000".to_string()),
        };

        let result = handler.handle(command).await;
        assert!(result.is_ok());

        let updated = result.unwrap();
        assert_eq!(updated.name, "New Name");
        assert_eq!(updated.description, Some("New description".to_string()));
        assert_eq!(updated.color, "#FF0000");
        // Code should remain unchanged (immutable)
        assert_eq!(updated.code, "original_code");
    }

    #[tokio::test]
    async fn test_update_category_clear_description() {
        let pool = setup_test_db().await;
        let repo = Arc::new(SqliteCategoryRepository::new(Arc::new(pool)));
        let handler = UpdateCategoryHandler::new(repo.clone());

        let category = create_test_category(&repo).await;

        let command = UpdateCategoryCommand {
            category_id: category.id.clone(),
            name: None,
            description: Some(None), // Clear description
            color: None,
        };

        let result = handler.handle(command).await;
        assert!(result.is_ok());

        let updated = result.unwrap();
        assert_eq!(updated.description, None);
    }

    #[tokio::test]
    async fn test_update_category_not_found() {
        let pool = setup_test_db().await;
        let repo = Arc::new(SqliteCategoryRepository::new(Arc::new(pool)));
        let handler = UpdateCategoryHandler::new(repo);

        let command = UpdateCategoryCommand {
            category_id: "01234567-89ab-cdef-0123-456789abcdef".to_string(),
            name: Some("New Name".to_string()),
            description: None,
            color: None,
        };

        let result = handler.handle(command).await;
        assert!(result.is_err());

        match result {
            Err(RepositoryError::NotFound(_)) => {}
            _ => panic!("Expected NotFound error"),
        }
    }
}
