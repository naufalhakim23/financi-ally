use std::sync::Arc;

use crate::{
    application::dtos::CategoryDto,
    domain::{
        repositories::{
            category_repository::CategoryRepository,
            transaction_repository::RepositoryError,
        },
        value_objects::TransactionId,
    },
};

/// Query to get a single category by ID
#[derive(Debug, Clone)]
pub struct GetCategoryQuery {
    pub category_id: String,
}

/// Handler for GetCategoryQuery
pub struct GetCategoryHandler {
    category_repo: Arc<dyn CategoryRepository>,
}

impl GetCategoryHandler {
    /// Create a new handler
    pub fn new(category_repo: Arc<dyn CategoryRepository>) -> Self {
        Self { category_repo }
    }

    /// Execute the query to get a category by ID
    ///
    /// # Arguments
    /// * `query` - The get category query
    ///
    /// # Returns
    /// * `Ok(CategoryDto)` - The category
    /// * `Err(RepositoryError)` - If category not found or database error occurs
    pub async fn handle(&self, query: GetCategoryQuery) -> Result<CategoryDto, RepositoryError> {
        // Parse ID
        let id = TransactionId::from_string(&query.category_id)
            .map_err(|e| RepositoryError::ValidationError(e.to_string()))?;

        // Find category
        let category = self
            .category_repo
            .find_by_id(&id)
            .await?
            .ok_or_else(|| {
                RepositoryError::NotFound(format!("Category with id {} not found", query.category_id))
            })?;

        // Convert to DTO
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
    async fn test_get_category_success() {
        let pool = setup_test_db().await;
        let repo = Arc::new(SqliteCategoryRepository::new(Arc::new(pool)));
        let handler = GetCategoryHandler::new(repo.clone());

        // Get one of the seeded categories
        let all_categories = repo.list().await.unwrap();
        let first_category = &all_categories[0];

        let query = GetCategoryQuery {
            category_id: first_category.id.to_string(),
        };

        let result = handler.handle(query).await;
        assert!(result.is_ok());

        let category = result.unwrap();
        assert_eq!(category.id, first_category.id.to_string());
        assert_eq!(category.name, first_category.name);
    }

    #[tokio::test]
    async fn test_get_category_not_found() {
        let pool = setup_test_db().await;
        let repo = Arc::new(SqliteCategoryRepository::new(Arc::new(pool)));
        let handler = GetCategoryHandler::new(repo);

        let query = GetCategoryQuery {
            category_id: "01234567-89ab-cdef-0123-456789abcdef".to_string(),
        };

        let result = handler.handle(query).await;
        assert!(result.is_err());

        match result {
            Err(RepositoryError::NotFound(_)) => {}
            _ => panic!("Expected NotFound error"),
        }
    }

    #[tokio::test]
    async fn test_get_category_invalid_id() {
        let pool = setup_test_db().await;
        let repo = Arc::new(SqliteCategoryRepository::new(Arc::new(pool)));
        let handler = GetCategoryHandler::new(repo);

        let query = GetCategoryQuery {
            category_id: "invalid-id-format".to_string(),
        };

        let result = handler.handle(query).await;
        assert!(result.is_err());

        match result {
            Err(RepositoryError::ValidationError(_)) => {}
            _ => panic!("Expected ValidationError for invalid ID"),
        }
    }
}
