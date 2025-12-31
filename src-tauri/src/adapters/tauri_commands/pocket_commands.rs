/// Tauri commands for pocket operations
///
/// These are the adapters for pocket management in the Hexagonal Architecture.
/// They translate between the frontend IPC layer and the application layer.

use tauri::State;

use crate::{
    adapters::tauri_commands::{
        command_models::{ErrorResponse, PocketListResponse, PocketResponse, SuccessResponse},
        transaction_commands::AppState,
    },
    application::{
        commands::{
            CreatePocketCommand, CreatePocketHandler, DeletePocketCommand, DeletePocketHandler,
            SetDefaultPocketCommand, SetDefaultPocketHandler, UpdatePocketCommand,
            UpdatePocketHandler,
        },
        queries::{GetPocketHandler, GetPocketQuery, ListPocketsHandler, ListPocketsQuery},
    },
};

// ============================================================================
// Command: Create Pocket
// ============================================================================

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePocketRequest {
    pub name: String,
    pub currency: String,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub color: String,
    pub initial_balance_cents: i64,
}

#[tauri::command]
pub async fn create_pocket(
    request: CreatePocketRequest,
    state: State<'_, AppState>,
) -> Result<PocketResponse, ErrorResponse> {
    let command = CreatePocketCommand {
        name: request.name,
        currency: request.currency,
        description: request.description,
        icon: request.icon,
        color: request.color,
        initial_balance_cents: request.initial_balance_cents,
    };

    let handler = CreatePocketHandler::new(state.pocket_repository.clone());
    match handler.handle(command).await {
        Ok(dto) => Ok(PocketResponse::ok(dto)),
        Err(e) => Err(ErrorResponse::internal_error(e.to_string())),
    }
}

// ============================================================================
// Query: List Pockets
// ============================================================================

#[tauri::command]
pub async fn list_pockets(
    state: State<'_, AppState>,
) -> Result<PocketListResponse, ErrorResponse> {
    let query = ListPocketsQuery {};
    let handler = ListPocketsHandler::new(state.pocket_repository.clone());
    match handler.handle(query).await {
        Ok(dtos) => Ok(PocketListResponse::ok(dtos)),
        Err(e) => Err(ErrorResponse::internal_error(e.to_string())),
    }
}

// ============================================================================
// Query: Get Pocket by ID
// ============================================================================

#[tauri::command]
pub async fn get_pocket(
    pocket_id: String,
    state: State<'_, AppState>,
) -> Result<PocketResponse, ErrorResponse> {
    let query = GetPocketQuery { pocket_id };
    let handler = GetPocketHandler::new(state.pocket_repository.clone());

    match handler.handle(query).await {
        Ok(dto) => Ok(PocketResponse::ok(dto)),
        Err(e) => {
            // Check if it's a not found error
            if e.to_string().contains("not found") {
                Err(ErrorResponse::not_found(e.to_string()))
            } else {
                Err(ErrorResponse::internal_error(e.to_string()))
            }
        }
    }
}

// ============================================================================
// Command: Update Pocket
// ============================================================================

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePocketRequest {
    pub pocket_id: String,
    pub name: Option<String>,
    pub description: Option<Option<String>>,
    pub icon: Option<Option<String>>,
    pub color: Option<String>,
}

#[tauri::command]
pub async fn update_pocket(
    request: UpdatePocketRequest,
    state: State<'_, AppState>,
) -> Result<PocketResponse, ErrorResponse> {
    let command = UpdatePocketCommand {
        pocket_id: request.pocket_id,
        name: request.name,
        description: request.description,
        icon: request.icon,
        color: request.color,
    };

    let handler = UpdatePocketHandler::new(state.pocket_repository.clone());
    match handler.handle(command).await {
        Ok(dto) => Ok(PocketResponse::ok(dto)),
        Err(e) => Err(ErrorResponse::internal_error(e.to_string())),
    }
}

// ============================================================================
// Command: Delete Pocket
// ============================================================================

#[tauri::command]
pub async fn delete_pocket(
    pocket_id: String,
    state: State<'_, AppState>,
) -> Result<SuccessResponse, ErrorResponse> {
    let command = DeletePocketCommand { pocket_id };
    let handler = DeletePocketHandler::new(
        state.pocket_repository.clone(),
        state.transaction_repository.clone(),
    );

    match handler.handle(command).await {
        Ok(_) => Ok(SuccessResponse::ok("Pocket deleted successfully")),
        Err(e) => Err(ErrorResponse::internal_error(e.to_string())),
    }
}

// ============================================================================
// Command: Set Default Pocket
// ============================================================================

#[tauri::command]
pub async fn set_default_pocket(
    pocket_id: String,
    state: State<'_, AppState>,
) -> Result<SuccessResponse, ErrorResponse> {
    let command = SetDefaultPocketCommand { pocket_id };
    let handler = SetDefaultPocketHandler::new(state.pocket_repository.clone());

    match handler.handle(command).await {
        Ok(_) => Ok(SuccessResponse::ok("Default pocket updated successfully")),
        Err(e) => Err(ErrorResponse::internal_error(e.to_string())),
    }
}
