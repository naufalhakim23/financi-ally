use async_trait::async_trait;

use crate::domain::{
    entities::Category,
    repositories::transaction_repository::RepositoryError,
    value_objects::TransactionId,
};

/// Repository interface for Category operations
///
/// Defines all operations that can be performed on categories.
/// This follows the Repository pattern from Domain-Driven Design.
#[async_trait]
pub trait CategoryRepository: Send + Sync {
    /// Create a new category
    ///
    /// # Arguments
    /// * `category` - The category to create
    ///
    /// # Returns
    /// * `Ok(())` - Category created successfully
    /// * `Err(RepositoryError)` - If creation fails (e.g., duplicate code)
    async fn create(&self, category: &Category) -> Result<(), RepositoryError>;

    /// Find a category by its ID
    ///
    /// # Arguments
    /// * `id` - The category ID to search for
    ///
    /// # Returns
    /// * `Ok(Some(Category))` - Category found
    /// * `Ok(None)` - Category not found or soft-deleted
    /// * `Err(RepositoryError)` - If database error occurs
    async fn find_by_id(&self, id: &TransactionId) -> Result<Option<Category>, RepositoryError>;

    /// Find a category by its code
    ///
    /// # Arguments
    /// * `code` - The category code to search for
    ///
    /// # Returns
    /// * `Ok(Some(Category))` - Category found
    /// * `Ok(None)` - Category not found or soft-deleted
    /// * `Err(RepositoryError)` - If database error occurs
    async fn find_by_code(&self, code: &str) -> Result<Option<Category>, RepositoryError>;

    /// List all categories (excluding soft-deleted)
    ///
    /// # Returns
    /// * `Ok(Vec<Category>)` - All non-deleted categories, sorted by name
    /// * `Err(RepositoryError)` - If database error occurs
    async fn list(&self) -> Result<Vec<Category>, RepositoryError>;

    /// List categories filtered by type (expense/income)
    ///
    /// # Arguments
    /// * `is_expense` - If true, include expense categories
    /// * `is_income` - If true, include income categories
    ///
    /// # Returns
    /// * `Ok(Vec<Category>)` - Filtered categories, sorted by name
    /// * `Err(RepositoryError)` - If database error occurs
    ///
    /// # Examples
    /// ```ignore
    /// // Get only expense categories
    /// let expense_categories = repo.list_by_type(true, false).await?;
    ///
    /// // Get only income categories
    /// let income_categories = repo.list_by_type(false, true).await?;
    ///
    /// // Get categories that can be used for both
    /// let both_categories = repo.list_by_type(true, true).await?;
    /// ```
    async fn list_by_type(
        &self,
        is_expense: bool,
        is_income: bool,
    ) -> Result<Vec<Category>, RepositoryError>;

    /// Update an existing category
    ///
    /// Note: Category code and type flags (is_expense/is_income) are immutable
    /// Only name, description, and color can be updated
    ///
    /// # Arguments
    /// * `category` - The updated category
    ///
    /// # Returns
    /// * `Ok(())` - Category updated successfully
    /// * `Err(RepositoryError)` - If update fails or category not found
    async fn update(&self, category: &Category) -> Result<(), RepositoryError>;

    /// Soft-delete a category
    ///
    /// Sets the deleted_at timestamp instead of physically removing the record.
    /// This allows historical data to remain intact.
    ///
    /// # Arguments
    /// * `id` - The category ID to soft-delete
    ///
    /// # Returns
    /// * `Ok(())` - Category soft-deleted successfully
    /// * `Err(RepositoryError)` - If deletion fails or category not found
    async fn soft_delete(&self, id: &TransactionId) -> Result<(), RepositoryError>;

    /// Check if a category is currently in use by any transactions
    ///
    /// Used to prevent deletion of categories that are referenced by ledger entries.
    ///
    /// # Arguments
    /// * `id` - The category ID to check
    ///
    /// # Returns
    /// * `Ok(true)` - Category is in use
    /// * `Ok(false)` - Category is not in use
    /// * `Err(RepositoryError)` - If database error occurs
    async fn is_category_in_use(&self, id: &TransactionId) -> Result<bool, RepositoryError>;
}
