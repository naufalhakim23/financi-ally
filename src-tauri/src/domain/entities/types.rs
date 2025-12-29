use serde::{Deserialize, Serialize};

/// Type of financial transaction
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TransactionType {
    /// Money coming in
    Income,
    /// Money going out
    Expense,
}

impl TransactionType {
    pub fn as_str(&self) -> &'static str {
        match self {
            TransactionType::Income => "income",
            TransactionType::Expense => "expense",
        }
    }
}

impl std::fmt::Display for TransactionType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// Scope of the transaction - personal or business
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Scope {
    /// Personal expense/income
    Personal,
    /// Business expense/income
    Business,
}

impl Scope {
    pub fn as_str(&self) -> &'static str {
        match self {
            Scope::Personal => "personal",
            Scope::Business => "business",
        }
    }
}

impl std::fmt::Display for Scope {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// Status of a transaction
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TransactionStatus {
    /// Active transaction with no corrections
    Active,
    /// Transaction has been corrected (has correction entries)
    Corrected,
    /// Transaction has been voided (rare, for exceptional cases)
    Voided,
}

impl TransactionStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            TransactionStatus::Active => "active",
            TransactionStatus::Corrected => "corrected",
            TransactionStatus::Voided => "voided",
        }
    }
}

impl std::fmt::Display for TransactionStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_transaction_type_serialization() {
        let income = TransactionType::Income;
        let json = serde_json::to_string(&income).unwrap();
        assert_eq!(json, r#""income""#);

        let expense = TransactionType::Expense;
        let json = serde_json::to_string(&expense).unwrap();
        assert_eq!(json, r#""expense""#);
    }

    #[test]
    fn test_transaction_type_deserialization() {
        let income: TransactionType = serde_json::from_str(r#""income""#).unwrap();
        assert_eq!(income, TransactionType::Income);

        let expense: TransactionType = serde_json::from_str(r#""expense""#).unwrap();
        assert_eq!(expense, TransactionType::Expense);
    }

    #[test]
    fn test_scope_serialization() {
        let personal = Scope::Personal;
        let json = serde_json::to_string(&personal).unwrap();
        assert_eq!(json, r#""personal""#);

        let business = Scope::Business;
        let json = serde_json::to_string(&business).unwrap();
        assert_eq!(json, r#""business""#);
    }

    #[test]
    fn test_scope_deserialization() {
        let personal: Scope = serde_json::from_str(r#""personal""#).unwrap();
        assert_eq!(personal, Scope::Personal);

        let business: Scope = serde_json::from_str(r#""business""#).unwrap();
        assert_eq!(business, Scope::Business);
    }

    #[test]
    fn test_status_serialization() {
        let active = TransactionStatus::Active;
        let json = serde_json::to_string(&active).unwrap();
        assert_eq!(json, r#""active""#);

        let corrected = TransactionStatus::Corrected;
        let json = serde_json::to_string(&corrected).unwrap();
        assert_eq!(json, r#""corrected""#);
    }

    #[test]
    fn test_status_display() {
        assert_eq!(format!("{}", TransactionType::Income), "income");
        assert_eq!(format!("{}", Scope::Business), "business");
        assert_eq!(format!("{}", TransactionStatus::Active), "active");
    }
}
