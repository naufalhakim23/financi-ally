use std::sync::Arc;

use crate::{
    application::dtos::CategoryDto,
    domain::{
        entities::Category,
        repositories::category_repository::CategoryRepository,
        repositories::transaction_repository::RepositoryError,
    },
};

/// Command to create a new category
#[derive(Debug, Clone)]
pub struct CreateCategoryCommand {
    pub name: String,
    pub code: String,
    pub description: Option<String>,
    pub color: String,
    pub is_expense: bool,
    pub is_income: bool,
}

/// Handler for CreateCategoryCommand
pub struct CreateCategoryHandler {
    category_repo: Arc<dyn CategoryRepository>,
}

impl CreateCategoryHandler {
    /// Create a new handler
    pub fn new(category_repo: Arc<dyn CategoryRepository>) -> Self {
        Self { category_repo }
    }

    /// Execute the command to create a new category
    ///
    /// # Arguments
    /// * `command` - The create category command
    ///
    /// # Returns
    /// * `Ok(CategoryDto)` - The newly created category
    /// * `Err(RepositoryError)` - If validation fails or database error occurs
    pub async fn handle(&self, command: CreateCategoryCommand) -> Result<CategoryDto, RepositoryError> {
        // Validate that at least one type flag is set
        if !command.is_expense && !command.is_income {
            return Err(RepositoryError::ValidationError(
                "Category must be marked as expense, income, or both".to_string(),
            ));
        }

        // Create category entity (domain validation happens here)
        let category = Category::new_category(
            command.name,
            command.code,
            command.description,
            command.color,
            command.is_expense,
            command.is_income,
        )
        .map_err(|e| RepositoryError::ValidationError(e.to_string()))?;

        // Persist the category
        self.category_repo.create(&category).await?;

        // Convert to DTO for response
        Ok(CategoryDto::from(&category))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infrastructure::persistence::{
        schema::run_migrations, sqlite_category_repository::SqliteCategoryRepository,
    };
    use sqlx::SqlitePool;

    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        run_migrations(&pool).await.unwrap();
        pool
    }

    #[tokio::test]
    async fn test_create_category_success() {
        let pool = setup_test_db().await;
        let repo = Arc::new(SqliteCategoryRepository::new(Arc::new(pool)));
        let handler = CreateCategoryHandler::new(repo.clone());

        let command = CreateCategoryCommand {
            name: "Test Category".to_string(),
            code: "test_category".to_string(),
            description: Some("Test description".to_string()),
            color: "#FF6B6B".to_string(),
            is_expense: true,
            is_income: false,
        };

        let result = handler.handle(command).await;
        assert!(result.is_ok());

        let category = result.unwrap();
        assert_eq!(category.name, "Test Category");
        assert_eq!(category.code, "test_category");
        assert_eq!(category.is_expense, true);
        assert_eq!(category.is_income, false);
    }

    #[tokio::test]
    async fn test_create_category_no_type_flags() {
        let pool = setup_test_db().await;
        let repo = Arc::new(SqliteCategoryRepository::new(Arc::new(pool)));
        let handler = CreateCategoryHandler::new(repo);

        let command = CreateCategoryCommand {
            name: "Invalid Category".to_string(),
            code: "invalid".to_string(),
            description: None,
            color: "#000000".to_string(),
            is_expense: false,
            is_income: false,
        };

        let result = handler.handle(command).await;
        assert!(result.is_err());

        match result {
            Err(RepositoryError::ValidationError(msg)) => {
                assert!(msg.contains("expense, income, or both"));
            }
            _ => panic!("Expected ValidationError"),
        }
    }

    #[tokio::test]
    async fn test_create_category_duplicate_code() {
        let pool = setup_test_db().await;
        let repo = Arc::new(SqliteCategoryRepository::new(Arc::new(pool)));
        let handler = CreateCategoryHandler::new(repo);

        let command1 = CreateCategoryCommand {
            name: "Category 1".to_string(),
            code: "duplicate_code".to_string(),
            description: None,
            color: "#FF0000".to_string(),
            is_expense: true,
            is_income: false,
        };

        handler.handle(command1).await.unwrap();

        let command2 = CreateCategoryCommand {
            name: "Category 2".to_string(),
            code: "duplicate_code".to_string(),
            description: None,
            color: "#00FF00".to_string(),
            is_expense: false,
            is_income: true,
        };

        let result = handler.handle(command2).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_create_category_both_types() {
        let pool = setup_test_db().await;
        let repo = Arc::new(SqliteCategoryRepository::new(Arc::new(pool)));
        let handler = CreateCategoryHandler::new(repo);

        let command = CreateCategoryCommand {
            name: "Transfer".to_string(),
            code: "transfer".to_string(),
            description: Some("Can be both income and expense".to_string()),
            color: "#808080".to_string(),
            is_expense: true,
            is_income: true,
        };

        let result = handler.handle(command).await;
        assert!(result.is_ok());

        let category = result.unwrap();
        assert!(category.is_expense);
        assert!(category.is_income);
    }
}
