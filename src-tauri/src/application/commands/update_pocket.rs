use std::sync::Arc;

use crate::domain::{
    entities::Pocket,
    repositories::pocket_repository::PocketRepository,
    repositories::transaction_repository::RepositoryError,
    value_objects::TransactionId,
};

/// Command to update an existing pocket's metadata
///
/// Note: Currency and initial_balance cannot be changed after creation
#[derive(Debug, Clone)]
pub struct UpdatePocketCommand {
    pub pocket_id: String,
    pub name: Option<String>,
    pub description: Option<Option<String>>,  // Some(None) clears, Some(Some(x)) sets, None keeps unchanged
    pub icon: Option<Option<String>>,
    pub color: Option<String>,
}

/// Handler for UpdatePocketCommand
pub struct UpdatePocketHandler {
    pocket_repo: Arc<dyn PocketRepository>,
}

impl UpdatePocketHandler {
    /// Create a new handler
    pub fn new(pocket_repo: Arc<dyn PocketRepository>) -> Self {
        Self { pocket_repo }
    }

    /// Execute the command to update a pocket
    ///
    /// # Arguments
    /// * `command` - The update pocket command
    ///
    /// # Returns
    /// * `Ok(Pocket)` - The updated pocket
    /// * `Err(RepositoryError)` - If pocket not found or validation fails
    pub async fn handle(&self, command: UpdatePocketCommand) -> Result<Pocket, RepositoryError> {
        // Parse pocket ID
        let pocket_id = TransactionId::from_string(&command.pocket_id)?;

        // Fetch existing pocket
        let mut pocket = self
            .pocket_repo
            .find_by_id(&pocket_id)
            .await?
            .ok_or_else(|| {
                RepositoryError::NotFound(format!(
                    "Pocket with id {} not found",
                    command.pocket_id
                ))
            })?;

        // Update metadata (domain validation happens here)
        pocket
            .update_metadata(
                command.name,
                command.description,
                command.icon,
                command.color,
            )
            .map_err(|e| RepositoryError::ValidationError(e.to_string()))?;

        // Persist the changes
        self.pocket_repo.update(&pocket).await?;

        Ok(pocket)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        domain::value_objects::Currency,
        infrastructure::persistence::{
            schema::run_migrations, sqlite_pocket_repository::SqlitePocketRepository,
        },
    };
    use sqlx::SqlitePool;

    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        run_migrations(&pool).await.unwrap();
        pool
    }

    #[tokio::test]
    async fn test_update_pocket_success() {
        let pool = setup_test_db().await;
        let repo = Arc::new(SqlitePocketRepository::new(Arc::new(pool)));
        let handler = UpdatePocketHandler::new(repo.clone());

        // Create a pocket first
        let pocket = Pocket::new(
            "Original Name".to_string(),
            Currency::from_code("USD").unwrap(),
            None,
            None,
            "#000000".to_string(),
            0,
        )
        .unwrap();

        let pocket_id = pocket.id().clone();
        repo.create(&pocket).await.unwrap();

        // Update it
        let command = UpdatePocketCommand {
            pocket_id: pocket_id.to_string(),
            name: Some("Updated Name".to_string()),
            description: Some(Some("New description".to_string())),
            icon: Some(Some("🎯".to_string())),
            color: Some("#FF0000".to_string()),
        };

        let result = handler.handle(command).await;
        assert!(result.is_ok());

        let updated = result.unwrap();
        assert_eq!(updated.name(), "Updated Name");
        assert_eq!(updated.description(), Some("New description"));
        assert_eq!(updated.icon(), Some("🎯"));
        assert_eq!(updated.color(), "#FF0000");
    }

    #[tokio::test]
    async fn test_update_pocket_not_found() {
        let pool = setup_test_db().await;
        let repo = Arc::new(SqlitePocketRepository::new(Arc::new(pool)));
        let handler = UpdatePocketHandler::new(repo);

        let fake_id = TransactionId::new();
        let command = UpdatePocketCommand {
            pocket_id: fake_id.to_string(),
            name: Some("Test".to_string()),
            description: None,
            icon: None,
            color: None,
        };

        let result = handler.handle(command).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_update_pocket_clear_description() {
        let pool = setup_test_db().await;
        let repo = Arc::new(SqlitePocketRepository::new(Arc::new(pool)));
        let handler = UpdatePocketHandler::new(repo.clone());

        // Create pocket with description
        let pocket = Pocket::new(
            "Test".to_string(),
            Currency::from_code("EUR").unwrap(),
            Some("Initial description".to_string()),
            None,
            "#000000".to_string(),
            0,
        )
        .unwrap();

        let pocket_id = pocket.id().clone();
        repo.create(&pocket).await.unwrap();

        // Clear description by passing Some(None)
        let command = UpdatePocketCommand {
            pocket_id: pocket_id.to_string(),
            name: None,
            description: Some(None),
            icon: None,
            color: None,
        };

        let result = handler.handle(command).await.unwrap();
        assert_eq!(result.description(), None);
    }
}
