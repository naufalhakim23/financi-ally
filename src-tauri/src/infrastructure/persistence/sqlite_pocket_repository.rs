use std::sync::Arc;
use async_trait::async_trait;
use sqlx::SqlitePool;

use crate::domain::entities::Pocket;
use crate::domain::repositories::pocket_repository::PocketRepository;
use crate::domain::repositories::transaction_repository::RepositoryError;
use crate::domain::value_objects::TransactionId;
use crate::infrastructure::persistence::models::pocket::PocketRow;

/// SQLite implementation of PocketRepository
///
/// Provides persistence for Pocket entities using SQLite database.
/// Implements all CRUD operations with proper error handling and data mapping.
pub struct SqlitePocketRepository {
    pool: Arc<SqlitePool>,
}

impl SqlitePocketRepository {
    /// Create a new SqlitePocketRepository
    ///
    /// # Arguments
    /// * `pool` - Shared SQLite connection pool
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl PocketRepository for SqlitePocketRepository {
    async fn create(&self, pocket: &Pocket) -> Result<(), RepositoryError> {
        let row = PocketRow::from_domain(pocket);

        sqlx::query(
            "INSERT INTO pockets (
                id, name, currency, description, icon, color,
                initial_balance_cents, current_balance_cents, is_default,
                created_at, updated_at, deleted_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&row.id)
        .bind(&row.name)
        .bind(&row.currency)
        .bind(&row.description)
        .bind(&row.icon)
        .bind(&row.color)
        .bind(row.initial_balance_cents)
        .bind(row.current_balance_cents)
        .bind(row.is_default)
        .bind(&row.created_at)
        .bind(&row.updated_at)
        .bind(&row.deleted_at)
        .execute(self.pool.as_ref())
        .await
        .map_err(|e| {
            // Check for unique constraint violation (name already exists)
            if e.to_string().contains("UNIQUE constraint failed") {
                RepositoryError::ValidationError(
                    "A pocket with this name already exists".to_string(),
                )
            } else {
                RepositoryError::DatabaseError(e.to_string())
            }
        })?;

        Ok(())
    }

    async fn find_by_id(&self, id: &TransactionId) -> Result<Option<Pocket>, RepositoryError> {
        let id_str = id.to_string();

        let row = sqlx::query_as::<_, PocketRow>(
            "SELECT id, name, currency, description, icon, color,
                   initial_balance_cents, current_balance_cents, is_default,
                   created_at, updated_at, deleted_at
            FROM pockets
            WHERE id = ? AND deleted_at IS NULL"
        )
        .bind(&id_str)
        .fetch_optional(self.pool.as_ref())
        .await
        .map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;

        match row {
            Some(r) => {
                let pocket = r.to_domain()?;
                Ok(Some(pocket))
            }
            None => Ok(None),
        }
    }

    async fn list(&self) -> Result<Vec<Pocket>, RepositoryError> {
        let rows = sqlx::query_as::<_, PocketRow>(
            "SELECT id, name, currency, description, icon, color,
                   initial_balance_cents, current_balance_cents, is_default,
                   created_at, updated_at, deleted_at
            FROM pockets
            WHERE deleted_at IS NULL
            ORDER BY is_default DESC, created_at ASC"
        )
        .fetch_all(self.pool.as_ref())
        .await
        .map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;

        let pockets: Result<Vec<Pocket>, RepositoryError> =
            rows.iter().map(|r| r.to_domain()).collect();

        pockets
    }

    async fn update(&self, pocket: &Pocket) -> Result<(), RepositoryError> {
        let row = PocketRow::from_domain(pocket);

        let result = sqlx::query(
            "UPDATE pockets
            SET name = ?,
                description = ?,
                icon = ?,
                color = ?,
                current_balance_cents = ?,
                updated_at = ?
            WHERE id = ? AND deleted_at IS NULL"
        )
        .bind(&row.name)
        .bind(&row.description)
        .bind(&row.icon)
        .bind(&row.color)
        .bind(row.current_balance_cents)
        .bind(&row.updated_at)
        .bind(&row.id)
        .execute(self.pool.as_ref())
        .await
        .map_err(|e| {
            if e.to_string().contains("UNIQUE constraint failed") {
                RepositoryError::ValidationError(
                    "A pocket with this name already exists".to_string(),
                )
            } else {
                RepositoryError::DatabaseError(e.to_string())
            }
        })?;

        if result.rows_affected() == 0 {
            return Err(RepositoryError::NotFound(format!(
                "Pocket with id {} not found",
                row.id
            )));
        }

        Ok(())
    }

    async fn soft_delete(&self, id: &TransactionId) -> Result<(), RepositoryError> {
        let id_str = id.to_string();
        let now = chrono::Utc::now().to_rfc3339();

        let result = sqlx::query(
            "UPDATE pockets
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
                "Pocket with id {} not found or already deleted",
                id_str
            )));
        }

        Ok(())
    }

    async fn find_default(&self) -> Result<Option<Pocket>, RepositoryError> {
        let row = sqlx::query_as::<_, PocketRow>(
            "SELECT id, name, currency, description, icon, color,
                   initial_balance_cents, current_balance_cents, is_default,
                   created_at, updated_at, deleted_at
            FROM pockets
            WHERE is_default = 1 AND deleted_at IS NULL
            LIMIT 1"
        )
        .fetch_optional(self.pool.as_ref())
        .await
        .map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;

        match row {
            Some(r) => {
                let pocket = r.to_domain()?;
                Ok(Some(pocket))
            }
            None => Ok(None),
        }
    }

    async fn set_default(&self, id: &TransactionId) -> Result<(), RepositoryError> {
        let id_str = id.to_string();
        let now = chrono::Utc::now().to_rfc3339();

        // Use a transaction to ensure atomicity
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;

        // First, verify the pocket exists and is not deleted
        let exists: Option<(i64,)> = sqlx::query_as(
            "SELECT 1 FROM pockets WHERE id = ? AND deleted_at IS NULL"
        )
        .bind(&id_str)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;

        if exists.is_none() {
            return Err(RepositoryError::NotFound(format!(
                "Pocket with id {} not found",
                id_str
            )));
        }

        // Unset all other defaults
        sqlx::query(
            "UPDATE pockets SET is_default = 0, updated_at = ? WHERE is_default = 1 AND deleted_at IS NULL"
        )
        .bind(&now)
        .execute(&mut *tx)
        .await
        .map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;

        // Set this pocket as default
        sqlx::query(
            "UPDATE pockets SET is_default = 1, updated_at = ? WHERE id = ?"
        )
        .bind(&now)
        .bind(&id_str)
        .execute(&mut *tx)
        .await
        .map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;

        // Commit the transaction
        tx.commit()
            .await
            .map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::value_objects::Currency;
    use crate::infrastructure::persistence::schema::run_migrations;

    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        run_migrations(&pool).await.unwrap();
        pool
    }

    #[tokio::test]
    async fn test_create_and_find_pocket() {
        let pool = setup_test_db().await;
        let repo = SqlitePocketRepository::new(Arc::new(pool));

        let pocket = Pocket::new(
            "Test Wallet".to_string(),
            Currency::from_code("USD").unwrap(),
            Some("Test description".to_string()),
            Some("💰".to_string()),
            "#4299E1".to_string(),
            1000,
        )
        .unwrap();

        let pocket_id = pocket.id().clone();

        // Create
        repo.create(&pocket).await.unwrap();

        // Find by ID
        let found = repo.find_by_id(&pocket_id).await.unwrap();
        assert!(found.is_some());

        let found_pocket = found.unwrap();
        assert_eq!(found_pocket.name(), "Test Wallet");
        assert_eq!(found_pocket.currency().as_str(), "USD");
        assert_eq!(found_pocket.initial_balance_cents(), 1000);
    }

    #[tokio::test]
    async fn test_list_pockets_includes_default_first() {
        let pool = setup_test_db().await;
        let repo = SqlitePocketRepository::new(Arc::new(pool));

        // The migration creates a default pocket, so list should return it first
        let pockets = repo.list().await.unwrap();
        assert!(!pockets.is_empty());

        // First pocket should be the default
        assert!(pockets[0].is_default());
        assert_eq!(pockets[0].name(), "Main Wallet");
    }

    #[tokio::test]
    async fn test_update_pocket() {
        let pool = setup_test_db().await;
        let repo = SqlitePocketRepository::new(Arc::new(pool));

        let mut pocket = Pocket::new(
            "Original Name".to_string(),
            Currency::from_code("EUR").unwrap(),
            None,
            None,
            "#000000".to_string(),
            0,
        )
        .unwrap();

        let pocket_id = pocket.id().clone();

        repo.create(&pocket).await.unwrap();

        // Update the pocket
        pocket
            .update_metadata(
                Some("Updated Name".to_string()),
                Some(Some("Updated description".to_string())),
                Some(Some("🎯".to_string())),
                Some("#FF0000".to_string()),
            )
            .unwrap();

        repo.update(&pocket).await.unwrap();

        // Verify update
        let found = repo.find_by_id(&pocket_id).await.unwrap().unwrap();
        assert_eq!(found.name(), "Updated Name");
        assert_eq!(found.description(), Some("Updated description"));
        assert_eq!(found.color(), "#FF0000");
    }

    #[tokio::test]
    async fn test_soft_delete_pocket() {
        let pool = setup_test_db().await;
        let repo = SqlitePocketRepository::new(Arc::new(pool));

        let pocket = Pocket::new(
            "To Delete".to_string(),
            Currency::from_code("USD").unwrap(),
            None,
            None,
            "#FF0000".to_string(),
            0,
        )
        .unwrap();

        let pocket_id = pocket.id().clone();

        repo.create(&pocket).await.unwrap();

        // Soft delete
        repo.soft_delete(&pocket_id).await.unwrap();

        // Verify it's not found anymore
        let found = repo.find_by_id(&pocket_id).await.unwrap();
        assert!(found.is_none());
    }

    #[tokio::test]
    async fn test_set_default_pocket() {
        let pool = setup_test_db().await;
        let repo = SqlitePocketRepository::new(Arc::new(pool));

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

        let new_pocket_id = new_pocket.id().clone();

        repo.create(&new_pocket).await.unwrap();

        // Set it as default
        repo.set_default(&new_pocket_id).await.unwrap();

        // Verify it's the default
        let default_pocket = repo.find_default().await.unwrap().unwrap();
        assert_eq!(default_pocket.id(), &new_pocket_id);
        assert_eq!(default_pocket.name(), "New Default");
        assert!(default_pocket.is_default());

        // Verify old default is no longer default
        let all_pockets = repo.list().await.unwrap();
        let old_defaults: Vec<_> = all_pockets
            .iter()
            .filter(|p| p.name() == "Main Wallet")
            .collect();

        assert_eq!(old_defaults.len(), 1);
        assert!(!old_defaults[0].is_default());
    }

    #[tokio::test]
    async fn test_unique_name_constraint() {
        let pool = setup_test_db().await;
        let repo = SqlitePocketRepository::new(Arc::new(pool));

        let pocket1 = Pocket::new(
            "Duplicate Name".to_string(),
            Currency::from_code("USD").unwrap(),
            None,
            None,
            "#FF0000".to_string(),
            0,
        )
        .unwrap();

        repo.create(&pocket1).await.unwrap();

        // Try to create another with same name (case-insensitive)
        let pocket2 = Pocket::new(
            "duplicate name".to_string(), // lowercase
            Currency::from_code("EUR").unwrap(),
            None,
            None,
            "#00FF00".to_string(),
            0,
        )
        .unwrap();

        let result = repo.create(&pocket2).await;
        assert!(result.is_err());

        match result {
            Err(RepositoryError::ValidationError(msg)) => {
                assert!(msg.contains("already exists"));
            }
            _ => panic!("Expected ValidationError"),
        }
    }
}
