use std::sync::Arc;

use crate::{
    application::dtos::PocketDto,
    domain::{
        entities::Pocket,
        repositories::pocket_repository::PocketRepository,
        repositories::transaction_repository::RepositoryError,
        value_objects::Currency,
    },
};

/// Command to create a new pocket
#[derive(Debug, Clone)]
pub struct CreatePocketCommand {
    pub name: String,
    pub currency: String,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub color: String,
    pub initial_balance_cents: i64,
}

/// Handler for CreatePocketCommand
pub struct CreatePocketHandler {
    pocket_repo: Arc<dyn PocketRepository>,
}

impl CreatePocketHandler {
    /// Create a new handler
    pub fn new(pocket_repo: Arc<dyn PocketRepository>) -> Self {
        Self { pocket_repo }
    }

    /// Execute the command to create a new pocket
    ///
    /// # Arguments
    /// * `command` - The create pocket command
    ///
    /// # Returns
    /// * `Ok(Pocket)` - The newly created pocket
    /// * `Err(RepositoryError)` - If validation fails or database error occurs
    pub async fn handle(&self, command: CreatePocketCommand) -> Result<PocketDto, RepositoryError> {
        // Parse and validate currency
        let currency = Currency::from_code(&command.currency)
            .map_err(|e| RepositoryError::ValidationError(e.to_string()))?;

        // Create pocket entity (domain validation happens here)
        let pocket = Pocket::new(
            command.name,
            currency,
            command.description,
            command.icon,
            command.color,
            command.initial_balance_cents,
        )
        .map_err(|e| RepositoryError::ValidationError(e.to_string()))?;

        // Persist the pocket
        self.pocket_repo.create(&pocket).await?;

        // Convert to DTO for response
        Ok(PocketDto::from(&pocket))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infrastructure::persistence::{
        schema::run_migrations, sqlite_pocket_repository::SqlitePocketRepository,
    };
    use sqlx::SqlitePool;

    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        run_migrations(&pool).await.unwrap();
        pool
    }

    #[tokio::test]
    async fn test_create_pocket_success() {
        let pool = setup_test_db().await;
        let repo = Arc::new(SqlitePocketRepository::new(Arc::new(pool)));
        let handler = CreatePocketHandler::new(repo.clone());

        let command = CreatePocketCommand {
            name: "Test Wallet".to_string(),
            currency: "USD".to_string(),
            description: Some("Test description".to_string()),
            icon: Some("💰".to_string()),
            color: "#4299E1".to_string(),
            initial_balance_cents: 10000,
        };

        let result = handler.handle(command).await;
        assert!(result.is_ok());

        let pocket = result.unwrap();
        assert_eq!(pocket.name(), "Test Wallet");
        assert_eq!(pocket.currency().as_str(), "USD");
        assert_eq!(pocket.initial_balance_cents(), 10000);
        assert_eq!(pocket.current_balance_cents(), 10000);
    }

    #[tokio::test]
    async fn test_create_pocket_invalid_currency() {
        let pool = setup_test_db().await;
        let repo = Arc::new(SqlitePocketRepository::new(Arc::new(pool)));
        let handler = CreatePocketHandler::new(repo);

        let command = CreatePocketCommand {
            name: "Test Wallet".to_string(),
            currency: "INVALID".to_string(),
            description: None,
            icon: None,
            color: "#000000".to_string(),
            initial_balance_cents: 0,
        };

        let result = handler.handle(command).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_create_pocket_duplicate_name() {
        let pool = setup_test_db().await;
        let repo = Arc::new(SqlitePocketRepository::new(Arc::new(pool)));
        let handler = CreatePocketHandler::new(repo);

        let command1 = CreatePocketCommand {
            name: "Duplicate".to_string(),
            currency: "EUR".to_string(),
            description: None,
            icon: None,
            color: "#FF0000".to_string(),
            initial_balance_cents: 0,
        };

        handler.handle(command1).await.unwrap();

        let command2 = CreatePocketCommand {
            name: "Duplicate".to_string(),
            currency: "USD".to_string(),
            description: None,
            icon: None,
            color: "#00FF00".to_string(),
            initial_balance_cents: 0,
        };

        let result = handler.handle(command2).await;
        assert!(result.is_err());
    }
}
