/// Tauri commands for transaction operations
///
/// These functions are the PRIMARY ADAPTERS in our Hexagonal Architecture.
/// They:
/// 1. Accept requests from the TypeScript frontend
/// 2. Convert request models to application layer commands/queries
/// 3. Execute business logic via application handlers
/// 4. Convert results to response models
/// 5. Handle errors appropriately
///
/// IMPORTANT: These functions should contain MINIMAL logic - just translation
/// between the external world (JSON/IPC) and our internal application layer.

use std::sync::Arc;
use tauri::State;

use crate::{
    adapters::tauri_commands::command_models::{
        CorrectTransactionRequest, CreateTransactionRequest, ErrorResponse, GetTransactionRequest,
        ListTransactionsRequest, OptionalTransactionResponse, SearchTransactionsRequest,
        TransactionListResponse, TransactionResponse,
    },
    application::{
        commands::{
            CorrectTransactionCommand, CorrectTransactionHandler, CreateTransactionCommand,
            CreateTransactionHandler,
        },
        queries::{
            GetTransactionHandler, GetTransactionQuery, ListTransactionsHandler,
            ListTransactionsQuery, SearchTransactionsHandler, SearchTransactionsQuery,
        },
    },
    domain::{
        entities::types::{Scope, TransactionType},
        repositories::{
            category_repository::CategoryRepository, pocket_repository::PocketRepository,
            transaction_repository::TransactionRepository,
        },
        value_objects::Timestamp,
    },
};

/// Tauri managed state containing the repositories
pub struct AppState {
    pub transaction_repository: Arc<dyn TransactionRepository>,
    pub pocket_repository: Arc<dyn PocketRepository>,
    pub category_repository: Arc<dyn CategoryRepository>,
}

// ============================================================================
// Command: Create Transaction
// ============================================================================

#[tauri::command]
pub async fn create_transaction(
    request: CreateTransactionRequest,
    state: State<'_, AppState>,
) -> Result<TransactionResponse, ErrorResponse> {
    // Parse transaction type
    let transaction_type = match request.transaction_type.to_lowercase().as_str() {
        "income" => TransactionType::Income,
        "expense" => TransactionType::Expense,
        _ => {
            return Err(ErrorResponse::validation_error(format!(
                "Invalid transaction_type: '{}'. Must be 'income' or 'expense'",
                request.transaction_type
            )))
        }
    };

    // Parse scope
    let scope = match request.scope.to_lowercase().as_str() {
        "personal" => Scope::Personal,
        "business" => Scope::Business,
        _ => {
            return Err(ErrorResponse::validation_error(format!(
                "Invalid scope: '{}'. Must be 'personal' or 'business'",
                request.scope
            )))
        }
    };

    // Parse occurred_at if provided
    let occurred_at = match request.occurred_at {
        Some(timestamp_str) => {
            match Timestamp::from_string(&timestamp_str) {
                Ok(ts) => Some(ts),
                Err(e) => {
                    return Err(ErrorResponse::validation_error(format!(
                        "Invalid occurred_at timestamp: {}",
                        e
                    )))
                }
            }
        }
        None => None,
    };

    // Create application command
    let command = CreateTransactionCommand {
        amount_cents: request.amount_cents,
        transaction_type,
        scope,
        pocket_id: request.pocket_id,
        description: request.description,
        category_id: request.category_id,
        category: request.category,
        payment_method: request.payment_method,
        notes: request.notes,
        receipt_base64: request.receipt_base64,
        occurred_at,
    };

    // Execute via handler
    let handler = CreateTransactionHandler::new(
        state.transaction_repository.clone(),
        state.pocket_repository.clone(),
    );
    match handler.handle(command).await {
        Ok(dto) => Ok(TransactionResponse::ok(dto)),
        Err(e) => Err(ErrorResponse::internal_error(e.to_string())),
    }
}

// ============================================================================
// Query: Get Transaction by ID
// ============================================================================

#[tauri::command]
pub async fn get_transaction(
    request: GetTransactionRequest,
    state: State<'_, AppState>,
) -> Result<OptionalTransactionResponse, ErrorResponse> {
    let query = GetTransactionQuery {
        transaction_id: request.transaction_id,
    };

    let handler = GetTransactionHandler::new(state.transaction_repository.clone());
    match handler.handle(query).await {
        Ok(dto_option) => Ok(OptionalTransactionResponse::ok(dto_option)),
        Err(e) => Err(ErrorResponse::internal_error(e.to_string())),
    }
}

// ============================================================================
// Query: List Transactions
// ============================================================================

#[tauri::command]
pub async fn list_transactions(
    request: ListTransactionsRequest,
    state: State<'_, AppState>,
) -> Result<TransactionListResponse, ErrorResponse> {
    // Parse filter_type
    let filter_type = match request.filter_type {
        Some(ref type_str) => match type_str.to_lowercase().as_str() {
            "income" => Some(TransactionType::Income),
            "expense" => Some(TransactionType::Expense),
            _ => None,
        },
        None => None,
    };

    // Parse filter_scope
    let filter_scope = match request.filter_scope {
        Some(ref scope_str) => match scope_str.to_lowercase().as_str() {
            "personal" => Some(Scope::Personal),
            "business" => Some(Scope::Business),
            _ => None,
        },
        None => None,
    };

    // Parse filter_date_from
    let filter_date_from = match request.filter_date_from {
        Some(ref date_str) => match Timestamp::from_string(date_str) {
            Ok(ts) => Some(ts),
            Err(_) => None,
        },
        None => None,
    };

    // Parse filter_date_to
    let filter_date_to = match request.filter_date_to {
        Some(ref date_str) => match Timestamp::from_string(date_str) {
            Ok(ts) => Some(ts),
            Err(_) => None,
        },
        None => None,
    };

    let query = ListTransactionsQuery {
        offset: request.offset,
        limit: request.limit,
        filter_type,
        filter_scope,
        filter_date_from,
        filter_date_to,
        filter_category: request.filter_category,
        filter_payment_method: request.filter_payment_method,
    };

    let handler = ListTransactionsHandler::new(state.transaction_repository.clone());
    match handler.handle(query).await {
        Ok(dtos) => Ok(TransactionListResponse::ok(dtos)),
        Err(e) => Err(ErrorResponse::internal_error(e.to_string())),
    }
}

// ============================================================================
// Query: Search Transactions
// ============================================================================

#[tauri::command]
pub async fn search_transactions(
    request: SearchTransactionsRequest,
    state: State<'_, AppState>,
) -> Result<TransactionListResponse, ErrorResponse> {
    let query = SearchTransactionsQuery {
        query: request.query,
    };

    let handler = SearchTransactionsHandler::new(state.transaction_repository.clone());
    match handler.handle(query).await {
        Ok(dtos) => Ok(TransactionListResponse::ok(dtos)),
        Err(e) => Err(ErrorResponse::internal_error(e.to_string())),
    }
}

// ============================================================================
// Command: Correct Transaction
// ============================================================================

#[tauri::command]
pub async fn correct_transaction(
    request: CorrectTransactionRequest,
    state: State<'_, AppState>,
) -> Result<TransactionResponse, ErrorResponse> {
    let command = CorrectTransactionCommand {
        transaction_id: request.transaction_id,
        entry_id: request.entry_id,
        new_amount_cents: request.new_amount_cents,
        new_category: request.new_category,
        new_payment_method: request.new_payment_method,
        new_notes: request.new_notes,
        new_receipt_base64: request.new_receipt_base64,
    };

    let handler = CorrectTransactionHandler::new(state.transaction_repository.clone());
    match handler.handle(command).await {
        Ok(dto) => Ok(TransactionResponse::ok(dto)),
        Err(e) => Err(ErrorResponse::internal_error(e.to_string())),
    }
}
