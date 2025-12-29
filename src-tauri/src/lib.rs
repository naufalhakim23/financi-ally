// Hexagonal Architecture Layers
mod domain;          // Core business logic (no external dependencies)
// mod application;  // Use cases (Phase 3)
mod infrastructure;  // External implementations (Phase 2)
// mod adapters;     // Primary adapters: Tauri commands (Phase 4)
// mod config;       // Configuration (Phase 4)

// Temporary example command - will be replaced with real commands in Phase 4
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
