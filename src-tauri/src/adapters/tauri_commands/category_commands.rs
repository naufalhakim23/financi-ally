/// Tauri commands for category operations
///
/// These are the adapters for category management in the Hexagonal Architecture.
/// They translate between the frontend IPC layer and the application layer.

use tauri::State;

use crate::{
    adapters::tauri_commands::{
        command_models::{CategoryListResponse, CategoryResponse, ErrorResponse, SuccessResponse},
        transaction_commands::AppState,
    },
    application::{
        commands::{
            CreateCategoryCommand, CreateCategoryHandler, DeleteCategoryCommand,
            DeleteCategoryHandler, UpdateCategoryCommand, UpdateCategoryHandler,
        },
        queries::{
            CategoryTypeFilter, GetCategoryHandler, GetCategoryQuery, ListCategoriesHandler,
            ListCategoriesQuery,
        },
    },
};

// ============================================================================
// Command: Create Category
// ============================================================================

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCategoryRequest {
    pub name: String,
    pub code: String,
    pub description: Option<String>,
    pub color: String,
    pub is_expense: bool,
    pub is_income: bool,
}

#[tauri::command]
pub async fn create_category(
    request: CreateCategoryRequest,
    state: State<'_, AppState>,
) -> Result<CategoryResponse, ErrorResponse> {
    let command = CreateCategoryCommand {
        name: request.name,
        code: request.code,
        description: request.description,
        color: request.color,
        is_expense: request.is_expense,
        is_income: request.is_income,
    };

    let handler = CreateCategoryHandler::new(state.category_repository.clone());
    match handler.handle(command).await {
        Ok(dto) => Ok(CategoryResponse::ok(dto)),
        Err(e) => {
            // Check if it's a validation error
            if e.to_string().contains("ValidationError")
                || e.to_string().contains("already exists")
                || e.to_string().contains("must be marked")
            {
                Err(ErrorResponse::validation_error(e.to_string()))
            } else {
                Err(ErrorResponse::internal_error(e.to_string()))
            }
        }
    }
}

// ============================================================================
// Query: List Categories
// ============================================================================

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListCategoriesRequest {
    /// Optional filter: "expense", "income", "both", or "all" (default)
    pub filter_type: Option<String>,
}

#[tauri::command]
pub async fn list_categories(
    request: Option<ListCategoriesRequest>,
    state: State<'_, AppState>,
) -> Result<CategoryListResponse, ErrorResponse> {
    // Parse filter from request
    let filter = request
        .and_then(|r| r.filter_type)
        .map(|f| match f.as_str() {
            "expense" => CategoryTypeFilter::Expense,
            "income" => CategoryTypeFilter::Income,
            "both" => CategoryTypeFilter::Both,
            _ => CategoryTypeFilter::All,
        })
        .unwrap_or(CategoryTypeFilter::All);

    let query = ListCategoriesQuery { filter };
    let handler = ListCategoriesHandler::new(state.category_repository.clone());

    match handler.handle(query).await {
        Ok(dtos) => Ok(CategoryListResponse::ok(dtos)),
        Err(e) => Err(ErrorResponse::internal_error(e.to_string())),
    }
}

// ============================================================================
// Query: Get Category by ID
// ============================================================================

#[tauri::command]
pub async fn get_category(
    category_id: String,
    state: State<'_, AppState>,
) -> Result<CategoryResponse, ErrorResponse> {
    let query = GetCategoryQuery { category_id };
    let handler = GetCategoryHandler::new(state.category_repository.clone());

    match handler.handle(query).await {
        Ok(dto) => Ok(CategoryResponse::ok(dto)),
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
// Command: Update Category
// ============================================================================

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCategoryRequest {
    pub category_id: String,
    pub name: Option<String>,
    pub description: Option<Option<String>>,
    pub color: Option<String>,
}

#[tauri::command]
pub async fn update_category(
    request: UpdateCategoryRequest,
    state: State<'_, AppState>,
) -> Result<CategoryResponse, ErrorResponse> {
    let command = UpdateCategoryCommand {
        category_id: request.category_id,
        name: request.name,
        description: request.description,
        color: request.color,
    };

    let handler = UpdateCategoryHandler::new(state.category_repository.clone());
    match handler.handle(command).await {
        Ok(dto) => Ok(CategoryResponse::ok(dto)),
        Err(e) => {
            if e.to_string().contains("not found") {
                Err(ErrorResponse::not_found(e.to_string()))
            } else {
                Err(ErrorResponse::internal_error(e.to_string()))
            }
        }
    }
}

// ============================================================================
// Command: Delete Category
// ============================================================================

#[tauri::command]
pub async fn delete_category(
    category_id: String,
    state: State<'_, AppState>,
) -> Result<SuccessResponse, ErrorResponse> {
    let command = DeleteCategoryCommand { category_id };
    let handler = DeleteCategoryHandler::new(state.category_repository.clone());

    match handler.handle(command).await {
        Ok(_) => Ok(SuccessResponse::ok("Category deleted successfully")),
        Err(e) => {
            // Check if it's a validation error (category in use)
            if e.to_string().contains("used by existing transactions") {
                Err(ErrorResponse::validation_error(e.to_string()))
            } else if e.to_string().contains("not found") {
                Err(ErrorResponse::not_found(e.to_string()))
            } else {
                Err(ErrorResponse::internal_error(e.to_string()))
            }
        }
    }
}
