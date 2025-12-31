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

/// Get the database path for the application
///
/// In production, this will use the app's data directory.
/// For now, we'll use a simple path in the app directory.
pub fn get_database_path() -> PathBuf {
    // TODO: Use tauri::api::path::app_data_dir() for production
    // For development, use a local path
    PathBuf::from("pocket-log.db")
}

/// Initialize the application state with database connection
///
/// This function:
/// 1. Gets the database path
/// 2. Creates connection pool (migrations run automatically)
/// 3. Initializes repository
/// 4. Returns AppState for Tauri managed state
pub async fn initialize_app_state() -> Result<AppState, String> {
    let db_path = get_database_path();

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
