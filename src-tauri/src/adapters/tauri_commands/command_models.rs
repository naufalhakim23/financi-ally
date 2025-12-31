/// Request/Response models for Tauri commands
///
/// These are the data structures that cross the IPC boundary between
/// the TypeScript frontend and Rust backend. They are kept simple and
/// focused on serialization, converting to/from domain types as needed.

use serde::{Deserialize, Deserializer, Serialize};

use crate::application::dtos::{PocketDto, TransactionDto};

/// Helper function to deserialize empty strings as None
fn empty_string_as_none<'de, D>(deserializer: D) -> Result<Option<String>, D::Error>
where
    D: Deserializer<'de>,
{
    let s: Option<String> = Option::deserialize(deserializer)?;
    Ok(s.and_then(|s| if s.is_empty() { None } else { Some(s) }))
}

// ============================================================================
// Request Models
// ============================================================================

/// Request to create a new transaction
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTransactionRequest {
    /// Amount in cents (positive value)
    pub amount_cents: i64,

    /// Type: "income" or "expense"
    pub transaction_type: String,

    /// Scope: "personal" or "business"
    pub scope: String,

    /// The pocket this transaction belongs to (required)
    pub pocket_id: String,

    /// Optional description
    #[serde(skip_serializing_if = "Option::is_none", deserialize_with = "empty_string_as_none", default)]
    pub description: Option<String>,

    /// Optional category (e.g., "Food", "Transportation")
    #[serde(skip_serializing_if = "Option::is_none", deserialize_with = "empty_string_as_none", default)]
    pub category: Option<String>,

    /// Optional payment method (e.g., "Cash", "Credit Card")
    #[serde(skip_serializing_if = "Option::is_none", deserialize_with = "empty_string_as_none", default)]
    pub payment_method: Option<String>,

    /// Optional notes
    #[serde(skip_serializing_if = "Option::is_none", deserialize_with = "empty_string_as_none", default)]
    pub notes: Option<String>,

    /// Optional receipt as Base64 string
    #[serde(skip_serializing_if = "Option::is_none", deserialize_with = "empty_string_as_none", default)]
    pub receipt_base64: Option<String>,

    /// When the transaction occurred (ISO 8601 string)
    /// If not provided, defaults to current time
    #[serde(skip_serializing_if = "Option::is_none", deserialize_with = "empty_string_as_none", default)]
    pub occurred_at: Option<String>,
}

/// Request to get a single transaction by ID
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetTransactionRequest {
    pub transaction_id: String,
}

/// Request to list transactions with pagination and filters
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListTransactionsRequest {
    /// Offset for pagination (default: 0)
    #[serde(default)]
    pub offset: usize,

    /// Limit/page size (default: 100, max: 1000)
    #[serde(default = "default_limit")]
    pub limit: usize,

    /// Optional filter by transaction type
    pub filter_type: Option<String>,

    /// Optional filter by scope
    pub filter_scope: Option<String>,

    /// Optional filter by date from (ISO 8601)
    pub filter_date_from: Option<String>,

    /// Optional filter by date to (ISO 8601)
    pub filter_date_to: Option<String>,

    /// Optional filter by category
    pub filter_category: Option<String>,

    /// Optional filter by payment method
    pub filter_payment_method: Option<String>,
}

fn default_limit() -> usize {
    100
}

/// Request to search transactions
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchTransactionsRequest {
    /// Search query string
    pub query: String,
}

/// Request to correct a transaction entry
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorrectTransactionRequest {
    /// Transaction ID containing the entry
    pub transaction_id: String,

    /// Entry ID to correct
    pub entry_id: String,

    /// New corrected amount in cents
    pub new_amount_cents: i64,

    /// New or updated category
    #[serde(skip_serializing_if = "Option::is_none")]
    pub new_category: Option<String>,

    /// New or updated payment method
    #[serde(skip_serializing_if = "Option::is_none")]
    pub new_payment_method: Option<String>,

    /// New or updated notes
    #[serde(skip_serializing_if = "Option::is_none")]
    pub new_notes: Option<String>,

    /// New or updated receipt (Base64)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub new_receipt_base64: Option<String>,
}

// ============================================================================
// Response Models
// ============================================================================

/// Standard success response wrapping a transaction
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionResponse {
    pub success: bool,
    pub data: TransactionDto,
}

impl TransactionResponse {
    pub fn ok(data: TransactionDto) -> Self {
        Self {
            success: true,
            data,
        }
    }
}

/// Response with optional transaction (for get_transaction)
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OptionalTransactionResponse {
    pub success: bool,
    pub data: Option<TransactionDto>,
}

impl OptionalTransactionResponse {
    pub fn ok(data: Option<TransactionDto>) -> Self {
        Self {
            success: true,
            data,
        }
    }
}

/// Response with list of transactions
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionListResponse {
    pub success: bool,
    pub data: Vec<TransactionDto>,
    pub count: usize,
}

impl TransactionListResponse {
    pub fn ok(data: Vec<TransactionDto>) -> Self {
        let count = data.len();
        Self {
            success: true,
            data,
            count,
        }
    }
}

/// Response with a single pocket
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PocketResponse {
    pub success: bool,
    pub data: PocketDto,
}

impl PocketResponse {
    pub fn ok(data: PocketDto) -> Self {
        Self {
            success: true,
            data,
        }
    }
}

/// Response with list of pockets
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PocketListResponse {
    pub success: bool,
    pub data: Vec<PocketDto>,
    pub count: usize,
}

impl PocketListResponse {
    pub fn ok(data: Vec<PocketDto>) -> Self {
        let count = data.len();
        Self {
            success: true,
            data,
            count,
        }
    }
}

/// Generic success response
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SuccessResponse {
    pub success: bool,
    pub message: String,
}

impl SuccessResponse {
    pub fn ok(message: impl Into<String>) -> Self {
        Self {
            success: true,
            message: message.into(),
        }
    }
}

/// Standard error response
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorResponse {
    pub success: bool,
    pub error: String,
    pub error_type: String,
}

impl ErrorResponse {
    pub fn new(error_type: String, error: String) -> Self {
        Self {
            success: false,
            error,
            error_type,
        }
    }

    pub fn validation_error(message: String) -> Self {
        Self::new("ValidationError".to_string(), message)
    }

    pub fn not_found(message: String) -> Self {
        Self::new("NotFoundError".to_string(), message)
    }

    pub fn internal_error(message: String) -> Self {
        Self::new("InternalError".to_string(), message)
    }
}
