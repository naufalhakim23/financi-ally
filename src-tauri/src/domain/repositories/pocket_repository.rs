use async_trait::async_trait;

use crate::domain::entities::Pocket;
use crate::domain::repositories::transaction_repository::RepositoryError;
use crate::domain::value_objects::TransactionId;

/// Repository trait for Pocket persistence
///
/// Defines the contract for pocket storage and retrieval.
/// Unlike TransactionRepository, this allows updates since pockets are mutable entities.
///
/// Implementations should ensure:
/// - Name uniqueness is enforced (at database level via unique constraint)
/// - Exactly one default pocket exists at all times
/// - Soft deletes are used (deleted_at timestamp)
/// - Transactions prevent pocket deletion
#[async_trait]
pub trait PocketRepository: Send + Sync {
    /// Create a new pocket
    ///
    /// # Arguments
    /// * `pocket` - The pocket to create
    ///
    /// # Returns
    /// * `Ok(())` if creation succeeds
    /// * `Err(RepositoryError::ValidationError)` if name already exists
    /// * `Err(RepositoryError::DatabaseError)` for database errors
    async fn create(&self, pocket: &Pocket) -> Result<(), RepositoryError>;

    /// Find a pocket by ID
    ///
    /// # Arguments
    /// * `id` - The pocket ID to search for
    ///
    /// # Returns
    /// * `Ok(Some(Pocket))` if found (and not deleted)
    /// * `Ok(None)` if not found or deleted
    /// * `Err(RepositoryError::DatabaseError)` for database errors
    async fn find_by_id(&self, id: &TransactionId) -> Result<Option<Pocket>, RepositoryError>;

    /// List all non-deleted pockets
    ///
    /// # Returns
    /// * `Ok(Vec<Pocket>)` - All non-deleted pockets, ordered by is_default DESC, created_at ASC
    /// * `Err(RepositoryError::DatabaseError)` for database errors
    ///
    /// Note: The default pocket will be first in the list
    async fn list(&self) -> Result<Vec<Pocket>, RepositoryError>;

    /// Update pocket metadata
    ///
    /// # Arguments
    /// * `pocket` - The pocket with updated fields
    ///
    /// # Returns
    /// * `Ok(())` if update succeeds
    /// * `Err(RepositoryError::NotFound)` if pocket doesn't exist
    /// * `Err(RepositoryError::ValidationError)` if name conflicts
    /// * `Err(RepositoryError::DatabaseError)` for database errors
    ///
    /// Note: Currency cannot be changed (immutable after creation)
    async fn update(&self, pocket: &Pocket) -> Result<(), RepositoryError>;

    /// Soft delete a pocket
    ///
    /// Sets deleted_at timestamp. Should only be called after validating
    /// no transactions exist for this pocket.
    ///
    /// # Arguments
    /// * `id` - The pocket ID to delete
    ///
    /// # Returns
    /// * `Ok(())` if deletion succeeds
    /// * `Err(RepositoryError::NotFound)` if pocket doesn't exist
    /// * `Err(RepositoryError::DatabaseError)` for database errors
    async fn soft_delete(&self, id: &TransactionId) -> Result<(), RepositoryError>;

    /// Find the default pocket
    ///
    /// # Returns
    /// * `Ok(Some(Pocket))` if default pocket exists
    /// * `Ok(None)` if no default pocket exists (should never happen in valid state)
    /// * `Err(RepositoryError::DatabaseError)` for database errors
    async fn find_default(&self) -> Result<Option<Pocket>, RepositoryError>;

    /// Set a pocket as the default pocket
    ///
    /// This operation is atomic:
    /// 1. Unset is_default for all other pockets
    /// 2. Set is_default=true for the specified pocket
    ///
    /// # Arguments
    /// * `id` - The pocket ID to make default
    ///
    /// # Returns
    /// * `Ok(())` if update succeeds
    /// * `Err(RepositoryError::NotFound)` if pocket doesn't exist
    /// * `Err(RepositoryError::DatabaseError)` for database errors
    async fn set_default(&self, id: &TransactionId) -> Result<(), RepositoryError>;
}
