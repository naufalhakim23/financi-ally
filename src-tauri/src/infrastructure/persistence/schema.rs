use sqlx::{Sqlite, SqlitePool};

/// Database schema version 1
///
/// This schema implements the immutable ledger design:
/// - UUID v7 for time-sortable IDs
/// - Amount stored as cents (INTEGER) to prevent floating-point errors
/// - Metadata stored as JSON TEXT for flexibility
/// - Triggers prevent UPDATE/DELETE on ledger_entries (immutability enforcement)
/// - FTS5 for fast search (<300ms requirement)
pub const SCHEMA_V1: &str = r#"
-- Transactions table: Header information about financial events
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,              -- UUID v7 as TEXT
    description TEXT,                 -- Optional description
    occurred_at TEXT NOT NULL,        -- ISO 8601: when transaction occurred
    scope TEXT CHECK(scope IN ('personal', 'business')) NOT NULL,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'corrected', 'voided')) NOT NULL,
    created_at TEXT DEFAULT (datetime('now')) NOT NULL
);

-- Ledger entries table: Immutable record of value movements
CREATE TABLE IF NOT EXISTS ledger_entries (
    id TEXT PRIMARY KEY,              -- UUID v7 as TEXT
    transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
    amount_cents INTEGER NOT NULL,    -- Amount in cents (prevents float errors)
    type TEXT CHECK(type IN ('income', 'expense')) NOT NULL,
    is_correction BOOLEAN DEFAULT 0 NOT NULL,
    parent_entry_id TEXT REFERENCES ledger_entries(id),  -- For correction chain
    metadata TEXT,                    -- JSON: {category, payment_method, notes, receipt_base64}
    created_at TEXT DEFAULT (datetime('now')) NOT NULL
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_transactions_occurred_at ON transactions(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_scope ON transactions(scope);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_transaction_id ON ledger_entries(transaction_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_parent ON ledger_entries(parent_entry_id) WHERE parent_entry_id IS NOT NULL;

-- Full-text search (FR-07: <300ms search requirement)
CREATE VIRTUAL TABLE IF NOT EXISTS transactions_fts USING fts5(
    transaction_id UNINDEXED,
    description,
    category,
    payment_method,
    notes,
    content=''  -- External content table
);

-- CRITICAL: Immutability enforcement at database level
-- Prevent UPDATE on ledger_entries
CREATE TRIGGER IF NOT EXISTS prevent_ledger_update
BEFORE UPDATE ON ledger_entries
BEGIN
    SELECT RAISE(ABORT, 'Ledger entries are immutable - use correction entries instead');
END;

-- Prevent DELETE on ledger_entries
CREATE TRIGGER IF NOT EXISTS prevent_ledger_delete
BEFORE DELETE ON ledger_entries
BEGIN
    SELECT RAISE(ABORT, 'Ledger entries cannot be deleted - immutable ledger');
END;

-- Keep FTS index in sync with ledger entries
CREATE TRIGGER IF NOT EXISTS ledger_entries_fts_insert
AFTER INSERT ON ledger_entries
BEGIN
    INSERT INTO transactions_fts(transaction_id, description, category, payment_method, notes)
    SELECT
        t.id,
        t.description,
        json_extract(NEW.metadata, '$.category'),
        json_extract(NEW.metadata, '$.payment_method'),
        json_extract(NEW.metadata, '$.notes')
    FROM transactions t
    WHERE t.id = NEW.transaction_id
    ON CONFLICT(transaction_id) DO UPDATE SET
        description = excluded.description,
        category = excluded.category,
        payment_method = excluded.payment_method,
        notes = excluded.notes;
END;
"#;

/// Schema version table to track migrations
pub const VERSION_TABLE: &str = r#"
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT DEFAULT (datetime('now')) NOT NULL
);
"#;

/// Run database migrations
///
/// # Arguments
/// * `pool` - SQLite connection pool
///
/// # Returns
/// Result indicating success or error
pub async fn run_migrations(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    // Create version table if it doesn't exist
    sqlx::query(VERSION_TABLE)
        .execute(pool)
        .await?;

    // Check current version
    let current_version: Option<(i64,)> = sqlx::query_as(
        "SELECT version FROM schema_version ORDER BY version DESC LIMIT 1"
    )
    .fetch_optional(pool)
    .await?;

    let version = current_version.map(|(v,)| v).unwrap_or(0);

    // Apply migrations based on current version
    if version < 1 {
        apply_v1_schema(pool).await?;

        // Mark version as applied
        sqlx::query("INSERT INTO schema_version (version) VALUES (1)")
            .execute(pool)
            .await?;
    }

    if version < 2 {
        apply_v2_schema(pool).await?;

        // Mark version as applied
        sqlx::query("INSERT INTO schema_version (version) VALUES (2)")
            .execute(pool)
            .await?;
    }

    Ok(())
}

/// Apply version 1 schema
async fn apply_v1_schema(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    // Execute each statement individually
    // We need to be careful with statements that contain semicolons (like triggers)

    // Split by CREATE statements and process each
    let statements = vec![
        // Transactions table
        "CREATE TABLE IF NOT EXISTS transactions (
            id TEXT PRIMARY KEY,
            description TEXT,
            occurred_at TEXT NOT NULL,
            scope TEXT CHECK(scope IN ('personal', 'business')) NOT NULL,
            status TEXT DEFAULT 'active' CHECK(status IN ('active', 'corrected', 'voided')) NOT NULL,
            created_at TEXT DEFAULT (datetime('now')) NOT NULL
        )",
        // Ledger entries table
        "CREATE TABLE IF NOT EXISTS ledger_entries (
            id TEXT PRIMARY KEY,
            transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
            amount_cents INTEGER NOT NULL,
            type TEXT CHECK(type IN ('income', 'expense')) NOT NULL,
            is_correction BOOLEAN DEFAULT 0 NOT NULL,
            parent_entry_id TEXT REFERENCES ledger_entries(id),
            metadata TEXT,
            created_at TEXT DEFAULT (datetime('now')) NOT NULL
        )",
        // Indexes
        "CREATE INDEX IF NOT EXISTS idx_transactions_occurred_at ON transactions(occurred_at DESC)",
        "CREATE INDEX IF NOT EXISTS idx_transactions_scope ON transactions(scope)",
        "CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status)",
        "CREATE INDEX IF NOT EXISTS idx_ledger_entries_transaction_id ON ledger_entries(transaction_id)",
        "CREATE INDEX IF NOT EXISTS idx_ledger_entries_parent ON ledger_entries(parent_entry_id) WHERE parent_entry_id IS NOT NULL",
        // FTS table
        "CREATE VIRTUAL TABLE IF NOT EXISTS transactions_fts USING fts5(
            transaction_id UNINDEXED,
            description,
            category,
            payment_method,
            notes,
            content=''
        )",
        // Immutability triggers
        "CREATE TRIGGER IF NOT EXISTS prevent_ledger_update
        BEFORE UPDATE ON ledger_entries
        BEGIN
            SELECT RAISE(ABORT, 'Ledger entries are immutable - use correction entries instead');
        END",
        "CREATE TRIGGER IF NOT EXISTS prevent_ledger_delete
        BEFORE DELETE ON ledger_entries
        BEGIN
            SELECT RAISE(ABORT, 'Ledger entries cannot be deleted - immutable ledger');
        END",
        // FTS sync trigger
        // Note: FTS5 doesn't support UPSERT, so we delete then insert
        "CREATE TRIGGER IF NOT EXISTS ledger_entries_fts_insert
        AFTER INSERT ON ledger_entries
        BEGIN
            DELETE FROM transactions_fts WHERE transaction_id = NEW.transaction_id;
            INSERT INTO transactions_fts(transaction_id, description, category, payment_method, notes)
            SELECT
                t.id,
                t.description,
                json_extract(NEW.metadata, '$.category'),
                json_extract(NEW.metadata, '$.payment_method'),
                json_extract(NEW.metadata, '$.notes')
            FROM transactions t
            WHERE t.id = NEW.transaction_id;
        END",
    ];

    for statement in statements {
        sqlx::query(statement)
            .execute(pool)
            .await?;
    }

    Ok(())
}

/// Apply version 2 schema - Adds Pockets feature
///
/// This migration:
/// 1. Creates the pockets table with constraints and indexes
/// 2. Creates a default pocket ("Main Wallet", USD)
/// 3. Adds pocket_id column to transactions table
/// 4. Migrates all existing transactions to the default pocket
/// 5. Creates index on transactions.pocket_id
///
/// All operations are atomic within a transaction
async fn apply_v2_schema(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    // Start a transaction for atomicity
    let mut tx = pool.begin().await?;

    // 1. Create pockets table
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS pockets (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            currency TEXT NOT NULL,
            description TEXT,
            icon TEXT,
            color TEXT NOT NULL,
            initial_balance_cents INTEGER NOT NULL DEFAULT 0,
            current_balance_cents INTEGER NOT NULL DEFAULT 0,
            is_default BOOLEAN DEFAULT 0 NOT NULL,
            created_at TEXT DEFAULT (datetime('now')) NOT NULL,
            updated_at TEXT,
            deleted_at TEXT
        )"
    )
    .execute(&mut *tx)
    .await?;

    // 2. Create unique index on pocket name (case-insensitive, only for non-deleted)
    sqlx::query(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_pockets_name
         ON pockets(LOWER(name)) WHERE deleted_at IS NULL"
    )
    .execute(&mut *tx)
    .await?;

    // 3. Create index on default pocket
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_pockets_default
         ON pockets(is_default) WHERE is_default = 1 AND deleted_at IS NULL"
    )
    .execute(&mut *tx)
    .await?;

    // 4. Create index on currency
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_pockets_currency
         ON pockets(currency)"
    )
    .execute(&mut *tx)
    .await?;

    // 5. Create default pocket (using UUID v7 style ID)
    // Generate a time-based ID (simplified version, production should use proper UUID v7)
    use std::time::{SystemTime, UNIX_EPOCH};
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis();
    let default_pocket_id = format!("pocket-default-{}", timestamp);

    sqlx::query(
        "INSERT INTO pockets (id, name, currency, description, icon, color, is_default, initial_balance_cents, current_balance_cents)
         VALUES (?, 'Main Wallet', 'USD', 'Default pocket for all transactions', '💰', '#4299E1', 1, 0, 0)"
    )
    .bind(&default_pocket_id)
    .execute(&mut *tx)
    .await?;

    // 6. Add pocket_id column to transactions table
    // Note: SQLite doesn't support adding columns with foreign keys directly
    // We add it as nullable first, then populate it, then we can enforce it at app level
    sqlx::query(
        "ALTER TABLE transactions ADD COLUMN pocket_id TEXT REFERENCES pockets(id) ON DELETE RESTRICT"
    )
    .execute(&mut *tx)
    .await?;

    // 7. Update all existing transactions to use the default pocket
    sqlx::query(
        "UPDATE transactions SET pocket_id = ? WHERE pocket_id IS NULL"
    )
    .bind(&default_pocket_id)
    .execute(&mut *tx)
    .await?;

    // 8. Create index on transactions.pocket_id for performance
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_transactions_pocket
         ON transactions(pocket_id)"
    )
    .execute(&mut *tx)
    .await?;

    // Commit the transaction
    tx.commit().await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_schema_creation() {
        let pool = SqlitePool::connect("sqlite::memory:")
            .await
            .unwrap();

        // Run migrations
        run_migrations(&pool).await.unwrap();

        // Verify tables exist
        let tables: Vec<(String,)> = sqlx::query_as(
            "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('transactions', 'ledger_entries', 'schema_version')"
        )
        .fetch_all(&pool)
        .await
        .unwrap();

        assert_eq!(tables.len(), 3);

        // Verify version was recorded
        let version: (i64,) = sqlx::query_as("SELECT version FROM schema_version")
            .fetch_one(&pool)
            .await
            .unwrap();

        assert_eq!(version.0, 1);

        pool.close().await;
    }

    #[tokio::test]
    async fn test_immutability_trigger_prevents_update() {
        let pool = SqlitePool::connect("sqlite::memory:")
            .await
            .unwrap();

        run_migrations(&pool).await.unwrap();

        // Insert a transaction and entry
        sqlx::query(
            "INSERT INTO transactions (id, description, occurred_at, scope) VALUES (?, ?, ?, ?)"
        )
        .bind("tx-123")
        .bind("Test")
        .bind("2025-12-29T10:00:00Z")
        .bind("personal")
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query(
            "INSERT INTO ledger_entries (id, transaction_id, amount_cents, type) VALUES (?, ?, ?, ?)"
        )
        .bind("entry-123")
        .bind("tx-123")
        .bind(1000)
        .bind("expense")
        .execute(&pool)
        .await
        .unwrap();

        // Try to update - should fail
        let result = sqlx::query("UPDATE ledger_entries SET amount_cents = 2000 WHERE id = 'entry-123'")
            .execute(&pool)
            .await;

        assert!(result.is_err());
        let error_msg = result.unwrap_err().to_string();
        assert!(error_msg.contains("immutable"));

        pool.close().await;
    }

    #[tokio::test]
    async fn test_immutability_trigger_prevents_delete() {
        let pool = SqlitePool::connect("sqlite::memory:")
            .await
            .unwrap();

        run_migrations(&pool).await.unwrap();

        // Insert a transaction and entry
        sqlx::query(
            "INSERT INTO transactions (id, description, occurred_at, scope) VALUES (?, ?, ?, ?)"
        )
        .bind("tx-456")
        .bind("Test")
        .bind("2025-12-29T10:00:00Z")
        .bind("business")
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query(
            "INSERT INTO ledger_entries (id, transaction_id, amount_cents, type) VALUES (?, ?, ?, ?)"
        )
        .bind("entry-456")
        .bind("tx-456")
        .bind(500)
        .bind("income")
        .execute(&pool)
        .await
        .unwrap();

        // Try to delete - should fail
        let result = sqlx::query("DELETE FROM ledger_entries WHERE id = 'entry-456'")
            .execute(&pool)
            .await;

        assert!(result.is_err());
        let error_msg = result.unwrap_err().to_string();
        assert!(error_msg.contains("immutable") || error_msg.contains("cannot be deleted"));

        pool.close().await;
    }
}
