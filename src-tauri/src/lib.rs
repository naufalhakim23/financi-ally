// Hexagonal Architecture Layers
mod domain;          // Core business logic (no external dependencies)
mod application;     // Use cases (Phase 3)
mod infrastructure;  // External implementations (Phase 2)
mod adapters;        // Primary adapters: Tauri commands (Phase 4)
mod config;          // Configuration (Phase 4)

use adapters::tauri_commands::{
    pocket_commands::{
        create_pocket, delete_pocket, get_pocket, list_pockets, set_default_pocket,
        update_pocket,
    },
    transaction_commands::{
        correct_transaction, create_transaction, get_transaction, list_transactions,
        search_transactions,
    },
};
use config::app_config::initialize_app_state;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Initialize async runtime for app state setup
            let runtime = tokio::runtime::Runtime::new()
                .map_err(|e| format!("Failed to create Tokio runtime: {}", e))?;

            // Get the app data directory
            let app_data_dir = app.path().app_data_dir()
                .map_err(|e| format!("Failed to get app data dir: {}", e))?;

            // Create the directory if it doesn't exist
            std::fs::create_dir_all(&app_data_dir)
                .map_err(|e| format!("Failed to create app data dir: {}", e))?;

            // Initialize application state (database connection, repository)
            let app_state = runtime
                .block_on(initialize_app_state(app_data_dir))
                .map_err(|e| format!("Failed to initialize application state: {}", e))?;

            app.manage(app_state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Transaction commands
            create_transaction,
            get_transaction,
            list_transactions,
            search_transactions,
            correct_transaction,
            // Pocket commands
            create_pocket,
            list_pockets,
            get_pocket,
            update_pocket,
            delete_pocket,
            set_default_pocket,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
