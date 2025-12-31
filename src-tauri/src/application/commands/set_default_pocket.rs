use std::sync::Arc;

use crate::domain::{
    repositories::pocket_repository::PocketRepository,
    repositories::transaction_repository::RepositoryError,
    value_objects::TransactionId,
};

/// Command to set a pocket as the default
///
/// Business Rule: Exactly one pocket must be default at all times
/// Setting a new default automatically unsets the previous default
#[derive(Debug, Clone)]
pub struct SetDefaultPocketCommand {
    pub pocket_id: String,
}

/// Handler for SetDefaultPocketCommand
pub struct SetDefaultPocketHandler {
    pocket_repo: Arc<dyn PocketRepository>,
}

impl SetDefaultPocketHandler {
    /// Create a new handler
    pub fn new(pocket_repo: Arc<dyn PocketRepository>) -> Self {
        Self { pocket_repo }
    }

    /// Execute the command to set a pocket as default
    ///
    /// # Arguments
    /// * `command` - The set default pocket command
    ///
    /// # Returns
    /// * `Ok(())` - If pocket was successfully set as default
    /// * `Err(RepositoryError)` - If pocket not found
    pub async fn handle(&self, command: SetDefaultPocketCommand) -> Result<(), RepositoryError> {
        // Parse pocket ID
        let pocket_id = TransactionId::from_string(&command.pocket_id)?;

        // Verify pocket exists (set_default will also check, but we want explicit error)
        if self
            .pocket_repo
            .find_by_id(&pocket_id)
            .await?
            .is_none()
        {
            return Err(RepositoryError::NotFound(format!(
                "Pocket with id {} not found",
                command.pocket_id
            )));
        }

        // Set as default (atomically unsets previous default)
        self.pocket_repo.set_default(&pocket_id).await?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        domain::{entities::Pocket, value_objects::Currency},
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
    async fn test_set_default_pocket_success() {
        let pool = setup_test_db().await;
        let repo = Arc::new(SqlitePocketRepository::new(Arc::new(pool)));
        let handler = SetDefaultPocketHandler::new(repo.clone());

        // Create a new pocket
        let new_pocket = Pocket::new(
            "New Default".to_string(),
            Currency::from_code("EUR").unwrap(),
            None,
            None,
            "#00FF00".to_string(),
            0,
        )
        .unwrap();

        let new_id = new_pocket.id().clone();
        repo.create(&new_pocket).await.unwrap();

        // Set it as default
        let command = SetDefaultPocketCommand {
            pocket_id: new_id.to_string(),
        };

        let result = handler.handle(command).await;
        assert!(result.is_ok());

        // Verify it's the default
        let default = repo.find_default().await.unwrap().unwrap();
        assert_eq!(default.id(), &new_id);

        // Verify old default is no longer default
        let all = repo.list().await.unwrap();
        let defaults: Vec<_> = all.iter().filter(|p| p.is_default()).collect();
        assert_eq!(defaults.len(), 1);
        assert_eq!(defaults[0].id(), &new_id);
    }

    #[tokio::test]
    async fn test_set_default_pocket_not_found() {
        let pool = setup_test_db().await;
        let repo = Arc::new(SqlitePocketRepository::new(Arc::new(pool)));
        let handler = SetDefaultPocketHandler::new(repo);

        let fake_id = TransactionId::new();
        let command = SetDefaultPocketCommand {
            pocket_id: fake_id.to_string(),
        };

        let result = handler.handle(command).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_set_default_idempotent() {
        let pool = setup_test_db().await;
        let repo = Arc::new(SqlitePocketRepository::new(Arc::new(pool)));
        let handler = SetDefaultPocketHandler::new(repo.clone());

        // Get current default
        let current_default = repo.find_default().await.unwrap().unwrap();
        let default_id = current_default.id().clone();

        // Set it as default again (should be idempotent)
        let command = SetDefaultPocketCommand {
            pocket_id: default_id.to_string(),
        };

        let result = handler.handle(command).await;
        assert!(result.is_ok());

        // Verify still default
        let default = repo.find_default().await.unwrap().unwrap();
        assert_eq!(default.id(), &default_id);
    }
}
