use std::sync::Arc;

use crate::{
    application::dtos::CategoryDto,
    domain::repositories::{
        category_repository::CategoryRepository,
        transaction_repository::RepositoryError,
    },
};

/// Filter for category type
#[derive(Debug, Clone)]
pub enum CategoryTypeFilter {
    /// Only expense categories
    Expense,
    /// Only income categories
    Income,
    /// Categories that can be both
    Both,
    /// All categories (no filter)
    All,
}

/// Query to list categories
///
/// Returns categories ordered by name
#[derive(Debug, Clone)]
pub struct ListCategoriesQuery {
    pub filter: CategoryTypeFilter,
}

impl ListCategoriesQuery {
    /// List all categories (no filter)
    pub fn all() -> Self {
        Self {
            filter: CategoryTypeFilter::All,
        }
    }

    /// List only expense categories
    pub fn expense_only() -> Self {
        Self {
            filter: CategoryTypeFilter::Expense,
        }
    }

    /// List only income categories
    pub fn income_only() -> Self {
        Self {
            filter: CategoryTypeFilter::Income,
        }
    }
}

/// Handler for ListCategoriesQuery
pub struct ListCategoriesHandler {
    category_repo: Arc<dyn CategoryRepository>,
}

impl ListCategoriesHandler {
    /// Create a new handler
    pub fn new(category_repo: Arc<dyn CategoryRepository>) -> Self {
        Self { category_repo }
    }

    /// Execute the query to list categories
    ///
    /// # Arguments
    /// * `query` - The list categories query with optional filter
    ///
    /// # Returns
    /// * `Ok(Vec<CategoryDto>)` - List of categories (sorted by name)
    /// * `Err(RepositoryError)` - If database error occurs
    pub async fn handle(&self, query: ListCategoriesQuery) -> Result<Vec<CategoryDto>, RepositoryError> {
        let categories = match query.filter {
            CategoryTypeFilter::All => self.category_repo.list().await?,
            CategoryTypeFilter::Expense => {
                self.category_repo.list_by_type(true, false).await?
            }
            CategoryTypeFilter::Income => {
                self.category_repo.list_by_type(false, true).await?
            }
            CategoryTypeFilter::Both => {
                self.category_repo.list_by_type(true, true).await?
            }
        };

        // Convert to DTOs
        let dtos: Vec<CategoryDto> = categories.iter().map(CategoryDto::from).collect();

        Ok(dtos)
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
    async fn test_list_all_categories() {
        let pool = setup_test_db().await;
        let repo = Arc::new(SqliteCategoryRepository::new(Arc::new(pool)));
        let handler = ListCategoriesHandler::new(repo.clone());

        let query = ListCategoriesQuery::all();
        let result = handler.handle(query).await.unwrap();

        // Should have 28 seeded categories
        assert_eq!(result.len(), 28);

        // Should be sorted by name
        assert_eq!(result[0].name, "Business Income");
    }

    #[tokio::test]
    async fn test_list_expense_categories() {
        let pool = setup_test_db().await;
        let repo = Arc::new(SqliteCategoryRepository::new(Arc::new(pool)));
        let handler = ListCategoriesHandler::new(repo.clone());

        let query = ListCategoriesQuery::expense_only();
        let result = handler.handle(query).await.unwrap();

        // Should have 20 expense categories
        assert_eq!(result.len(), 20);

        // All should be expense categories
        for category in &result {
            assert!(category.is_expense);
        }
    }

    #[tokio::test]
    async fn test_list_income_categories() {
        let pool = setup_test_db().await;
        let repo = Arc::new(SqliteCategoryRepository::new(Arc::new(pool)));
        let handler = ListCategoriesHandler::new(repo.clone());

        let query = ListCategoriesQuery::income_only();
        let result = handler.handle(query).await.unwrap();

        // Should have 8 income categories
        assert_eq!(result.len(), 8);

        // All should be income categories
        for category in &result {
            assert!(category.is_income);
        }
    }

    #[tokio::test]
    async fn test_list_both_type_categories() {
        let pool = setup_test_db().await;
        let repo = Arc::new(SqliteCategoryRepository::new(Arc::new(pool)));
        let handler = ListCategoriesHandler::new(repo.clone());

        // First create a category that can be both
        let both_category = crate::domain::entities::Category::new_category(
            "Transfer".to_string(),
            "transfer".to_string(),
            None,
            "#808080".to_string(),
            true,
            true,
        )
        .unwrap();
        repo.create(&both_category).await.unwrap();

        let query = ListCategoriesQuery {
            filter: CategoryTypeFilter::Both,
        };
        let result = handler.handle(query).await.unwrap();

        // Should include all categories (expense OR income OR both)
        // 20 expense + 8 income + 1 both = 29 total
        assert_eq!(result.len(), 29);
    }
}
