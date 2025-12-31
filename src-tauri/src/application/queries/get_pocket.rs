use std::sync::Arc;

use crate::{
    application::dtos::PocketDto,
    domain::{
        repositories::{pocket_repository::PocketRepository, transaction_repository::RepositoryError},
        value_objects::TransactionId,
    },
};

/// Query to get a single pocket by ID
#[derive(Debug, Clone)]
pub struct GetPocketQuery {
    pub pocket_id: String,
}

/// Handler for GetPocketQuery
pub struct GetPocketHandler {
    pocket_repo: Arc<dyn PocketRepository>,
}

impl GetPocketHandler {
    /// Create a new handler
    pub fn new(pocket_repo: Arc<dyn PocketRepository>) -> Self {
        Self { pocket_repo }
    }

    /// Execute the query to get a pocket
    ///
    /// # Arguments
    /// * `query` - The get pocket query
    ///
    /// # Returns
    /// * `Ok(PocketDto)` - The pocket
    /// * `Err(RepositoryError)` - If pocket not found or ID invalid
    pub async fn handle(&self, query: GetPocketQuery) -> Result<PocketDto, RepositoryError> {
        // Parse pocket ID
        let pocket_id = TransactionId::from_string(&query.pocket_id)?;

        // Fetch pocket
        let pocket = self
            .pocket_repo
            .find_by_id(&pocket_id)
            .await?
            .ok_or_else(|| {
                RepositoryError::NotFound(format!("Pocket with id {} not found", query.pocket_id))
            })?;

        // Convert to DTO
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
    async fn test_get_pocket_success() {
        let pool = setup_test_db().await;
        let repo = Arc::new(SqlitePocketRepository::new(Arc::new(pool)));
        let handler = GetPocketHandler::new(repo.clone());

        // Get default pocket from migration
        let default = repo.find_default().await.unwrap().unwrap();

        let query = GetPocketQuery {
            pocket_id: default.id().to_string(),
        };

        let result = handler.handle(query).await.unwrap();

        assert_eq!(result.id, default.id().to_string());
        assert_eq!(result.name, "Main Wallet");
        assert!(result.is_default);
    }

    #[tokio::test]
    async fn test_get_pocket_not_found() {
        let pool = setup_test_db().await;
        let repo = Arc::new(SqlitePocketRepository::new(Arc::new(pool)));
        let handler = GetPocketHandler::new(repo);

        let fake_id = TransactionId::new();
        let query = GetPocketQuery {
            pocket_id: fake_id.to_string(),
        };

        let result = handler.handle(query).await;
        assert!(result.is_err());
    }
}
