use std::sync::Arc;

use crate::{
    application::dtos::PocketDto,
    domain::repositories::{pocket_repository::PocketRepository, transaction_repository::RepositoryError},
};

/// Query to list all pockets
///
/// Returns pockets ordered by: default first, then by creation date
#[derive(Debug, Clone)]
pub struct ListPocketsQuery;

/// Handler for ListPocketsQuery
pub struct ListPocketsHandler {
    pocket_repo: Arc<dyn PocketRepository>,
}

impl ListPocketsHandler {
    /// Create a new handler
    pub fn new(pocket_repo: Arc<dyn PocketRepository>) -> Self {
        Self { pocket_repo }
    }

    /// Execute the query to list all pockets
    ///
    /// # Returns
    /// * `Ok(Vec<PocketDto>)` - List of pockets (default first)
    /// * `Err(RepositoryError)` - If database error occurs
    pub async fn handle(&self, _query: ListPocketsQuery) -> Result<Vec<PocketDto>, RepositoryError> {
        let pockets = self.pocket_repo.list().await?;

        // Convert to DTOs
        let dtos: Vec<PocketDto> = pockets.iter().map(PocketDto::from).collect();

        Ok(dtos)
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
    async fn test_list_pockets() {
        let pool = setup_test_db().await;
        let repo = Arc::new(SqlitePocketRepository::new(Arc::new(pool)));
        let handler = ListPocketsHandler::new(repo.clone());

        let query = ListPocketsQuery;
        let result = handler.handle(query).await.unwrap();

        // Should have at least the default pocket from migration
        assert!(!result.is_empty());

        // First pocket should be default
        assert!(result[0].is_default);
        assert_eq!(result[0].name, "Main Wallet");
    }

    #[tokio::test]
    async fn test_list_pockets_multiple() {
        let pool = setup_test_db().await;
        let repo = Arc::new(SqlitePocketRepository::new(Arc::new(pool)));
        let handler = ListPocketsHandler::new(repo.clone());

        // Create additional pocket
        let new_pocket = crate::domain::entities::Pocket::new(
            "Second Pocket".to_string(),
            crate::domain::value_objects::Currency::from_code("EUR").unwrap(),
            None,
            None,
            "#FF0000".to_string(),
            0,
        )
        .unwrap();

        repo.create(&new_pocket).await.unwrap();

        let query = ListPocketsQuery;
        let result = handler.handle(query).await.unwrap();

        // Should have 2 pockets
        assert_eq!(result.len(), 2);

        // First should still be default
        assert!(result[0].is_default);
    }
}
