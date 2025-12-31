// Hexagonal Architecture Layers
mod domain;          // Core business logic (no external dependencies)
mod application;     // Use cases (Phase 3)
mod infrastructure;  // External implementations (Phase 2)
mod adapters;        // Primary adapters: Tauri commands (Phase 4)
mod config;          // Configuration (Phase 4)

use adapters::tauri_commands::transaction_commands::{
    correct_transaction, create_transaction, get_transaction, list_transactions,
    search_transactions,
};
use config::app_config::initialize_app_state;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize async runtime for app state setup
    let runtime = tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime");

    // Initialize application state (database connection, repository)
    let app_state = runtime
        .block_on(initialize_app_state())
        .expect("Failed to initialize application state");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            create_transaction,
            get_transaction,
            list_transactions,
            search_transactions,
            correct_transaction,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
