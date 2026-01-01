use std::sync::Arc;
use async_trait::async_trait;
use sqlx::SqlitePool;

use crate::domain::entities::Category;
use crate::domain::repositories::category_repository::CategoryRepository;
use crate::domain::repositories::transaction_repository::RepositoryError;
use crate::domain::value_objects::TransactionId;
use crate::infrastructure::persistence::models::category::CategoryRow;

/// SQLite implementation of CategoryRepository
///
/// Provides persistence for Category entities using SQLite database.
/// Implements all CRUD operations with proper error handling and data mapping.
pub struct SqliteCategoryRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteCategoryRepository {
    /// Create a new SqliteCategoryRepository
    ///
    /// # Arguments
    /// * `pool` - Shared SQLite connection pool
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl CategoryRepository for SqliteCategoryRepository {
    async fn create(&self, category: &Category) -> Result<(), RepositoryError> {
        let row = CategoryRow::from_domain(category);

        sqlx::query(
            "INSERT INTO categories (
                id, name, code, description, color,
                is_expense, is_income,
                created_at, updated_at, deleted_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&row.id)
        .bind(&row.name)
        .bind(&row.code)
        .bind(&row.description)
        .bind(&row.color)
        .bind(row.is_expense)
        .bind(row.is_income)
        .bind(&row.created_at)
        .bind(&row.updated_at)
        .bind(&row.deleted_at)
        .execute(self.pool.as_ref())
        .await
        .map_err(|e| {
            // Check for unique constraint violation (code already exists)
            if e.to_string().contains("UNIQUE constraint failed") {
                RepositoryError::ValidationError(
                    "A category with this code already exists".to_string(),
                )
            } else {
                RepositoryError::DatabaseError(e.to_string())
            }
        })?;

        Ok(())
    }

    async fn find_by_id(&self, id: &TransactionId) -> Result<Option<Category>, RepositoryError> {
        let id_str = id.to_string();

        let row = sqlx::query_as::<_, CategoryRow>(
            "SELECT id, name, code, description, color,
                   is_expense, is_income,
                   created_at, updated_at, deleted_at
            FROM categories
            WHERE id = ? AND deleted_at IS NULL"
        )
        .bind(&id_str)
        .fetch_optional(self.pool.as_ref())
        .await
        .map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;

        match row {
            Some(r) => {
                let category = r.to_domain()?;
                Ok(Some(category))
            }
            None => Ok(None),
        }
    }

    async fn find_by_code(&self, code: &str) -> Result<Option<Category>, RepositoryError> {
        let row = sqlx::query_as::<_, CategoryRow>(
            "SELECT id, name, code, description, color,
                   is_expense, is_income,
                   created_at, updated_at, deleted_at
            FROM categories
            WHERE LOWER(code) = LOWER(?) AND deleted_at IS NULL"
        )
        .bind(code)
        .fetch_optional(self.pool.as_ref())
        .await
        .map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;

        match row {
            Some(r) => {
                let category = r.to_domain()?;
                Ok(Some(category))
            }
            None => Ok(None),
        }
    }

    async fn list(&self) -> Result<Vec<Category>, RepositoryError> {
        let rows = sqlx::query_as::<_, CategoryRow>(
            "SELECT id, name, code, description, color,
                   is_expense, is_income,
                   created_at, updated_at, deleted_at
            FROM categories
            WHERE deleted_at IS NULL
            ORDER BY name ASC"
        )
        .fetch_all(self.pool.as_ref())
        .await
        .map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;

        let categories: Result<Vec<Category>, RepositoryError> = rows
            .iter()
            .map(|r| r.to_domain().map_err(|e| e.into()))
            .collect();

        categories
    }

    async fn list_by_type(
        &self,
        is_expense: bool,
        is_income: bool,
    ) -> Result<Vec<Category>, RepositoryError> {
        let rows = sqlx::query_as::<_, CategoryRow>(
            "SELECT id, name, code, description, color,
                   is_expense, is_income,
                   created_at, updated_at, deleted_at
            FROM categories
            WHERE deleted_at IS NULL
              AND (
                (? = 1 AND is_expense = 1) OR
                (? = 1 AND is_income = 1)
              )
            ORDER BY name ASC"
        )
        .bind(is_expense)
        .bind(is_income)
        .fetch_all(self.pool.as_ref())
        .await
        .map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;

        let categories: Result<Vec<Category>, RepositoryError> = rows
            .iter()
            .map(|r| r.to_domain().map_err(|e| e.into()))
            .collect();

        categories
    }

    async fn update(&self, category: &Category) -> Result<(), RepositoryError> {
        let row = CategoryRow::from_domain(category);

        let result = sqlx::query(
            "UPDATE categories
            SET name = ?,
                description = ?,
                color = ?,
                updated_at = ?
            WHERE id = ? AND deleted_at IS NULL"
        )
        .bind(&row.name)
        .bind(&row.description)
        .bind(&row.color)
        .bind(&row.updated_at)
        .bind(&row.id)
        .execute(self.pool.as_ref())
        .await
        .map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;

        if result.rows_affected() == 0 {
            return Err(RepositoryError::NotFound(format!(
                "Category with id {} not found",
                row.id
            )));
        }

        Ok(())
    }

    async fn soft_delete(&self, id: &TransactionId) -> Result<(), RepositoryError> {
        let id_str = id.to_string();
        let now = chrono::Utc::now().to_rfc3339();

        let result = sqlx::query(
            "UPDATE categories
            SET deleted_at = ?
            WHERE id = ? AND deleted_at IS NULL"
        )
        .bind(&now)
        .bind(&id_str)
        .execute(self.pool.as_ref())
        .await
        .map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;

        if result.rows_affected() == 0 {
            return Err(RepositoryError::NotFound(format!(
                "Category with id {} not found or already deleted",
                id_str
            )));
        }

        Ok(())
    }

    async fn is_category_in_use(&self, id: &TransactionId) -> Result<bool, RepositoryError> {
        let id_str = id.to_string();

        let count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM ledger_entries WHERE category_id = ?"
        )
        .bind(&id_str)
        .fetch_one(self.pool.as_ref())
        .await
        .map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;

        Ok(count.0 > 0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infrastructure::persistence::schema::run_migrations;

    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        run_migrations(&pool).await.unwrap();
        pool
    }

    #[tokio::test]
    async fn test_create_and_find_category() {
        let pool = setup_test_db().await;
        let repo = SqliteCategoryRepository::new(Arc::new(pool));

        let category = Category::new_category(
            "Test Category".to_string(),
            "test_category".to_string(),
            Some("Test description".to_string()),
            "#FF6B6B".to_string(),
            true,  // is_expense
            false, // is_income
        )
        .unwrap();

        let category_id = category.id.clone();

        // Create
        repo.create(&category).await.unwrap();

        // Find by ID
        let found = repo.find_by_id(&category_id).await.unwrap();
        assert!(found.is_some());

        let found_category = found.unwrap();
        assert_eq!(found_category.name, "Test Category");
        assert_eq!(found_category.code, "test_category");
        assert_eq!(found_category.is_expense, true);
        assert_eq!(found_category.is_income, false);
    }

    #[tokio::test]
    async fn test_find_by_code() {
        let pool = setup_test_db().await;
        let repo = SqliteCategoryRepository::new(Arc::new(pool));

        // Use a non-conflicting code (not in seeded data)
        let category = Category::new_category(
            "Test Custom Category".to_string(),
            "test_custom_category".to_string(),
            None,
            "#4ECDC4".to_string(),
            true,
            false,
        )
        .unwrap();

        repo.create(&category).await.unwrap();

        // Find by code (case-insensitive)
        let found = repo.find_by_code("test_custom_category").await.unwrap();
        assert!(found.is_some());

        let found_category = found.unwrap();
        assert_eq!(found_category.name, "Test Custom Category");
        assert_eq!(found_category.code, "test_custom_category");
    }

    #[tokio::test]
    async fn test_list_categories_includes_seeded() {
        let pool = setup_test_db().await;
        let repo = SqliteCategoryRepository::new(Arc::new(pool));

        // The migration creates 28 categories
        let categories = repo.list().await.unwrap();
        assert_eq!(categories.len(), 28);

        // Should be sorted by name
        assert_eq!(categories[0].name, "Business Income");
        assert!(categories.iter().any(|c| c.code == "food_dining"));
        assert!(categories.iter().any(|c| c.code == "salary"));
    }

    #[tokio::test]
    async fn test_list_by_type_expense() {
        let pool = setup_test_db().await;
        let repo = SqliteCategoryRepository::new(Arc::new(pool));

        // Get only expense categories
        let expense_categories = repo.list_by_type(true, false).await.unwrap();

        // Should have 20 expense categories
        assert_eq!(expense_categories.len(), 20);

        // All should be expense categories
        for category in &expense_categories {
            assert!(category.is_expense);
        }
    }

    #[tokio::test]
    async fn test_list_by_type_income() {
        let pool = setup_test_db().await;
        let repo = SqliteCategoryRepository::new(Arc::new(pool));

        // Get only income categories
        let income_categories = repo.list_by_type(false, true).await.unwrap();

        // Should have 8 income categories
        assert_eq!(income_categories.len(), 8);

        // All should be income categories
        for category in &income_categories {
            assert!(category.is_income);
        }
    }

    #[tokio::test]
    async fn test_update_category() {
        let pool = setup_test_db().await;
        let repo = SqliteCategoryRepository::new(Arc::new(pool));

        let mut category = Category::new_category(
            "Original Name".to_string(),
            "original_code".to_string(),
            None,
            "#000000".to_string(),
            true,
            false,
        )
        .unwrap();

        let category_id = category.id.clone();

        repo.create(&category).await.unwrap();

        // Update the category (only mutable fields)
        category.name = "Updated Name".to_string();
        category.description = Some("Updated description".to_string());
        category.color = "#FF0000".to_string();
        category.updated_at = Some(crate::domain::value_objects::Timestamp::now());

        repo.update(&category).await.unwrap();

        // Verify update
        let found = repo.find_by_id(&category_id).await.unwrap().unwrap();
        assert_eq!(found.name, "Updated Name");
        assert_eq!(found.description, Some("Updated description".to_string()));
        assert_eq!(found.color, "#FF0000");
        // Code should remain unchanged (immutable)
        assert_eq!(found.code, "original_code");
    }

    #[tokio::test]
    async fn test_soft_delete_category() {
        let pool = setup_test_db().await;
        let repo = SqliteCategoryRepository::new(Arc::new(pool));

        let category = Category::new_category(
            "To Delete".to_string(),
            "to_delete".to_string(),
            None,
            "#FF0000".to_string(),
            true,
            false,
        )
        .unwrap();

        let category_id = category.id.clone();

        repo.create(&category).await.unwrap();

        // Soft delete
        repo.soft_delete(&category_id).await.unwrap();

        // Verify it's not found anymore
        let found = repo.find_by_id(&category_id).await.unwrap();
        assert!(found.is_none());

        // Verify it's not in list
        let all_categories = repo.list().await.unwrap();
        assert!(!all_categories.iter().any(|c| c.id == category_id));
    }

    #[tokio::test]
    async fn test_is_category_in_use() {
        let pool = setup_test_db().await;
        let repo = SqliteCategoryRepository::new(Arc::new(pool));

        // Use a seeded category
        let categories = repo.list().await.unwrap();
        let test_category = &categories[0];

        // Initially not in use
        let in_use = repo.is_category_in_use(&test_category.id).await.unwrap();
        assert!(!in_use);

        // Note: To properly test the "in use" case, we would need to create
        // a ledger entry with this category_id. That requires setting up
        // a full transaction repository and pocket, which is beyond the scope
        // of this unit test. This will be tested in integration tests.
    }

    #[tokio::test]
    async fn test_unique_code_constraint() {
        let pool = setup_test_db().await;
        let repo = SqliteCategoryRepository::new(Arc::new(pool));

        let category1 = Category::new_category(
            "Category 1".to_string(),
            "test_duplicate_code".to_string(),
            None,
            "#FF0000".to_string(),
            true,
            false,
        )
        .unwrap();

        repo.create(&category1).await.unwrap();

        // Try to create another with same code
        let category2 = Category::new_category(
            "Category 2".to_string(),
            "test_duplicate_code".to_string(), // same code
            None,
            "#00FF00".to_string(),
            false,
            true,
        )
        .unwrap();

        let result = repo.create(&category2).await;
        assert!(result.is_err());

        match result {
            Err(RepositoryError::ValidationError(msg)) => {
                assert!(msg.contains("already exists"));
            }
            _ => panic!("Expected ValidationError"),
        }
    }
}
