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
    domain::repositories::{
        category_repository::CategoryRepository, pocket_repository::PocketRepository,
        transaction_repository::TransactionRepository,
    },
    infrastructure::persistence::{
        connection::{create_pool, DatabaseConfig},
        sqlite_category_repository::SqliteCategoryRepository,
        sqlite_pocket_repository::SqlitePocketRepository,
        sqlite_transaction_repository::SqliteTransactionRepository,
    },
};

/// Initialize the application state with database connection
///
/// This function:
/// 1. Uses the provided app data directory (or repo path in dev mode on desktop)
/// 2. Creates connection pool (migrations run automatically)
/// 3. Initializes repository
/// 4. Returns AppState for Tauri managed state
///
/// # Arguments
/// * `app_data_dir` - The application's data directory (from Tauri)
pub async fn initialize_app_state(app_data_dir: PathBuf) -> Result<AppState, String> {
    // Determine database path based on platform and build mode
    let db_path = if cfg!(target_os = "android") || cfg!(target_os = "ios") {
        // Mobile: Always use app data directory (debug and release)
        app_data_dir.join("pocket-log.db")
    } else if cfg!(debug_assertions) {
        // Desktop debug mode: use repo root database (not src-tauri to avoid file watcher triggers)
        std::env::current_dir()
            .map(|p| p.parent().map(|parent| parent.join("pocket-log.db")).unwrap_or_else(|| p.join("pocket-log.db")))
            .unwrap_or_else(|_| app_data_dir.join("pocket-log.db"))
    } else {
        // Desktop release mode: use app data directory
        app_data_dir.join("pocket-log.db")
    };

    println!("Using database at: {}", db_path.display());

    // Create database config
    let config = DatabaseConfig::file(db_path.to_str().unwrap());

    // Create connection pool (migrations run automatically inside create_pool)
    let pool = create_pool(config)
        .await
        .map_err(|e| format!("Failed to create database pool: {}", e))?;

    let pool_arc = Arc::new(pool);

    // Create repositories
    let transaction_repository: Arc<dyn TransactionRepository> =
        Arc::new(SqliteTransactionRepository::new(pool_arc.clone()));

    let pocket_repository: Arc<dyn PocketRepository> =
        Arc::new(SqlitePocketRepository::new(pool_arc.clone()));

    let category_repository: Arc<dyn CategoryRepository> =
        Arc::new(SqliteCategoryRepository::new(pool_arc.clone()));

    Ok(AppState {
        transaction_repository,
        pocket_repository,
        category_repository,
    })
}
