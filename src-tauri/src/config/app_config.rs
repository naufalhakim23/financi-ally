/// Application configuration and initialization
///
/// Handles:
/// - Database path resolution
/// - Repository initialization
/// - Application state setup

use std::path::PathBuf;
use std::sync::Arc;

use crate::{
    adapters::tauri_commands::transaction_commands::AppState,
    domain::repositories::transaction_repository::TransactionRepository,
    infrastructure::persistence::{
        connection::{create_pool, DatabaseConfig},
        sqlite_transaction_repository::SqliteTransactionRepository,
    },
};

/// Initialize the application state with database connection
///
/// This function:
/// 1. Uses the provided app data directory
/// 2. Creates connection pool (migrations run automatically)
/// 3. Initializes repository
/// 4. Returns AppState for Tauri managed state
///
/// # Arguments
/// * `app_data_dir` - The application's data directory (from Tauri)
pub async fn initialize_app_state(app_data_dir: PathBuf) -> Result<AppState, String> {
    let db_path = app_data_dir.join("pocket-log.db");

    // Create database config
    let config = DatabaseConfig::file(db_path.to_str().unwrap());

    // Create connection pool (migrations run automatically inside create_pool)
    let pool = create_pool(config)
        .await
        .map_err(|e| format!("Failed to create database pool: {}", e))?;

    // Create repository
    let repository: Arc<dyn TransactionRepository> =
        Arc::new(SqliteTransactionRepository::new(Arc::new(pool)));

    Ok(AppState { repository })
}
