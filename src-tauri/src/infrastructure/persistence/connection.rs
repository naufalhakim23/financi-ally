use sqlx::{SqlitePool, sqlite::SqlitePoolOptions};
use std::time::Duration;

use super::schema::run_migrations;

/// Database connection configuration
pub struct DatabaseConfig {
    /// Path to the SQLite database file
    /// For in-memory database (testing), use ":memory:"
    pub database_path: String,

    /// Maximum number of connections in the pool
    pub max_connections: u32,

    /// Connection timeout in seconds
    pub connection_timeout_secs: u64,
}

impl Default for DatabaseConfig {
    fn default() -> Self {
        Self {
            database_path: "pocket-log.db".to_string(),
            max_connections: 5,
            connection_timeout_secs: 30,
        }
    }
}

impl DatabaseConfig {
    /// Create config for in-memory database (useful for testing)
    pub fn in_memory() -> Self {
        Self {
            database_path: ":memory:".to_string(),
            max_connections: 1,
            connection_timeout_secs: 5,
        }
    }

    /// Create config for file-based database
    pub fn file(path: impl Into<String>) -> Self {
        Self {
            database_path: path.into(),
            max_connections: 5,
            connection_timeout_secs: 30,
        }
    }
}

/// Create and configure a SQLite connection pool
///
/// # Arguments
/// * `config` - Database configuration
///
/// # Returns
/// Configured SQLite connection pool with migrations applied
///
/// # Errors
/// Returns error if connection fails or migrations fail
pub async fn create_pool(config: DatabaseConfig) -> Result<SqlitePool, sqlx::Error> {
    // Build connection string
    let connection_string = if config.database_path == ":memory:" {
        "sqlite::memory:".to_string()
    } else {
        format!("sqlite:{}?mode=rwc", config.database_path)
    };

    // Create pool with configuration
    let pool = SqlitePoolOptions::new()
        .max_connections(config.max_connections)
        .acquire_timeout(Duration::from_secs(config.connection_timeout_secs))
        .connect(&connection_string)
        .await?;

    // Enable foreign keys (SQLite disables them by default)
    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(&pool)
        .await?;

    // Enable WAL mode for better concurrency
    sqlx::query("PRAGMA journal_mode = WAL")
        .execute(&pool)
        .await?;

    // Run migrations to set up schema
    run_migrations(&pool).await?;

    Ok(pool)
}

/// Create a pool for testing (in-memory database)
#[cfg(test)]
pub async fn create_test_pool() -> Result<SqlitePool, sqlx::Error> {
    create_pool(DatabaseConfig::in_memory()).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_create_in_memory_pool() {
        let pool = create_pool(DatabaseConfig::in_memory())
            .await
            .unwrap();

        // Verify connection works
        let result: (i64,) = sqlx::query_as("SELECT 1")
            .fetch_one(&pool)
            .await
            .unwrap();

        assert_eq!(result.0, 1);

        pool.close().await;
    }

    #[tokio::test]
    async fn test_foreign_keys_enabled() {
        let pool = create_pool(DatabaseConfig::in_memory())
            .await
            .unwrap();

        // Check if foreign keys are enabled
        let result: (i64,) = sqlx::query_as("PRAGMA foreign_keys")
            .fetch_one(&pool)
            .await
            .unwrap();

        assert_eq!(result.0, 1); // 1 = enabled

        pool.close().await;
    }

    #[tokio::test]
    async fn test_migrations_run_automatically() {
        let pool = create_pool(DatabaseConfig::in_memory())
            .await
            .unwrap();

        // Verify schema_version table exists
        let version: (i64,) = sqlx::query_as("SELECT version FROM schema_version")
            .fetch_one(&pool)
            .await
            .unwrap();

        assert_eq!(version.0, 1);

        pool.close().await;
    }
}
