use crate::domain::errors::{DomainError, DomainResult};
use crate::domain::value_objects::Amount;

/// Validation rules for domain entities
pub struct Validator;

impl Validator {
    /// Validate that an amount is not zero for income/expense entries
    /// Zero amounts don't make sense for actual transactions
    pub fn validate_non_zero_amount(amount: &Amount) -> DomainResult<()> {
        if amount.is_zero() {
            return Err(DomainError::ValidationError(
                "Amount cannot be zero for transaction entries".to_string(),
            ));
        }
        Ok(())
    }

    /// Validate that description doesn't exceed maximum length
    pub fn validate_description(description: &Option<String>) -> DomainResult<()> {
        if let Some(desc) = description {
            if desc.len() > 500 {
                return Err(DomainError::ValidationError(
                    "Description cannot exceed 500 characters".to_string(),
                ));
            }
        }
        Ok(())
    }

    /// Validate category string
    pub fn validate_category(category: &Option<String>) -> DomainResult<()> {
        if let Some(cat) = category {
            if cat.is_empty() {
                return Err(DomainError::ValidationError(
                    "Category cannot be empty string".to_string(),
                ));
            }
            if cat.len() > 100 {
                return Err(DomainError::ValidationError(
                    "Category cannot exceed 100 characters".to_string(),
                ));
            }
        }
        Ok(())
    }

    /// Validate payment method string
    pub fn validate_payment_method(payment_method: &Option<String>) -> DomainResult<()> {
        if let Some(pm) = payment_method {
            if pm.is_empty() {
                return Err(DomainError::ValidationError(
                    "Payment method cannot be empty string".to_string(),
                ));
            }
            if pm.len() > 100 {
                return Err(DomainError::ValidationError(
                    "Payment method cannot exceed 100 characters".to_string(),
                ));
            }
        }
        Ok(())
    }

    /// Validate notes field
    pub fn validate_notes(notes: &Option<String>) -> DomainResult<()> {
        if let Some(n) = notes {
            if n.len() > 1000 {
                return Err(DomainError::ValidationError(
                    "Notes cannot exceed 1000 characters".to_string(),
                ));
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_non_zero_amount_passes() {
        let amount = Amount::from_cents(100);
        assert!(Validator::validate_non_zero_amount(&amount).is_ok());
    }

    #[test]
    fn test_validate_non_zero_amount_fails() {
        let amount = Amount::from_cents(0);
        assert!(Validator::validate_non_zero_amount(&amount).is_err());
    }

    #[test]
    fn test_validate_description_passes() {
        let desc = Some("Valid description".to_string());
        assert!(Validator::validate_description(&desc).is_ok());
    }

    #[test]
    fn test_validate_description_too_long() {
        let long_desc = Some("a".repeat(501));
        assert!(Validator::validate_description(&long_desc).is_err());
    }

    #[test]
    fn test_validate_category_passes() {
        let cat = Some("Groceries".to_string());
        assert!(Validator::validate_category(&cat).is_ok());
    }

    #[test]
    fn test_validate_category_empty() {
        let cat = Some("".to_string());
        assert!(Validator::validate_category(&cat).is_err());
    }

    #[test]
    fn test_validate_payment_method_passes() {
        let pm = Some("Credit Card".to_string());
        assert!(Validator::validate_payment_method(&pm).is_ok());
    }

    #[test]
    fn test_validate_notes_too_long() {
        let notes = Some("a".repeat(1001));
        assert!(Validator::validate_notes(&notes).is_err());
    }
}
