use serde::{Deserialize, Serialize};
use std::fmt;

use crate::domain::errors::DomainError;

/// Amount value object - stores monetary amounts as cents (i64)
/// This prevents floating-point errors in financial calculations
///
/// Examples:
/// - $10.50 is stored as 1050 cents
/// - $0.01 is stored as 1 cent
/// - $100.00 is stored as 10000 cents
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct Amount(i64);

impl Amount {
    /// Create a new Amount from cents
    ///
    /// # Arguments
    /// * `cents` - The amount in cents (can be negative for reversals)
    ///
    /// # Examples
    /// ```
    /// let amount = Amount::from_cents(1050); // $10.50
    /// ```
    pub fn from_cents(cents: i64) -> Self {
        Amount(cents)
    }

    /// Create an Amount from dollars (will be converted to cents)
    ///
    /// # Arguments
    /// * `dollars` - The amount in dollars as f64
    ///
    /// # Returns
    /// Result containing Amount or DomainError if conversion fails
    ///
    /// # Examples
    /// ```
    /// let amount = Amount::from_dollars(10.50)?; // Stores as 1050 cents
    /// ```
    pub fn from_dollars(dollars: f64) -> Result<Self, DomainError> {
        if !dollars.is_finite() {
            return Err(DomainError::InvalidAmount(
                "Amount must be a finite number".to_string(),
            ));
        }

        // Multiply by 100 and round to nearest cent
        let cents = (dollars * 100.0).round() as i64;
        Ok(Amount(cents))
    }

    /// Get the amount in cents
    pub fn cents(&self) -> i64 {
        self.0
    }

    /// Get the amount in dollars (for display purposes)
    pub fn dollars(&self) -> f64 {
        self.0 as f64 / 100.0
    }

    /// Check if amount is zero
    pub fn is_zero(&self) -> bool {
        self.0 == 0
    }

    /// Check if amount is positive
    pub fn is_positive(&self) -> bool {
        self.0 > 0
    }

    /// Check if amount is negative
    pub fn is_negative(&self) -> bool {
        self.0 < 0
    }

    /// Create a reversal (negated) amount
    /// Used for correction entries
    pub fn negate(&self) -> Self {
        Amount(-self.0)
    }

    /// Add two amounts
    pub fn add(&self, other: &Amount) -> Self {
        Amount(self.0 + other.0)
    }

    /// Subtract another amount
    pub fn subtract(&self, other: &Amount) -> Self {
        Amount(self.0 - other.0)
    }
}

impl fmt::Display for Amount {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "${:.2}", self.dollars())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_from_cents() {
        let amount = Amount::from_cents(1050);
        assert_eq!(amount.cents(), 1050);
        assert_eq!(amount.dollars(), 10.50);
    }

    #[test]
    fn test_from_dollars() {
        let amount = Amount::from_dollars(10.50).unwrap();
        assert_eq!(amount.cents(), 1050);
    }

    #[test]
    fn test_from_dollars_invalid() {
        let result = Amount::from_dollars(f64::NAN);
        assert!(result.is_err());
    }

    #[test]
    fn test_is_zero() {
        assert!(Amount::from_cents(0).is_zero());
        assert!(!Amount::from_cents(1).is_zero());
    }

    #[test]
    fn test_is_positive() {
        assert!(Amount::from_cents(100).is_positive());
        assert!(!Amount::from_cents(0).is_positive());
        assert!(!Amount::from_cents(-100).is_positive());
    }

    #[test]
    fn test_is_negative() {
        assert!(Amount::from_cents(-100).is_negative());
        assert!(!Amount::from_cents(0).is_negative());
        assert!(!Amount::from_cents(100).is_negative());
    }

    #[test]
    fn test_negate() {
        let amount = Amount::from_cents(1050);
        let negated = amount.negate();
        assert_eq!(negated.cents(), -1050);
    }

    #[test]
    fn test_add() {
        let a = Amount::from_cents(1000);
        let b = Amount::from_cents(500);
        let sum = a.add(&b);
        assert_eq!(sum.cents(), 1500);
    }

    #[test]
    fn test_subtract() {
        let a = Amount::from_cents(1000);
        let b = Amount::from_cents(300);
        let diff = a.subtract(&b);
        assert_eq!(diff.cents(), 700);
    }

    #[test]
    fn test_display() {
        let amount = Amount::from_cents(1050);
        assert_eq!(format!("{}", amount), "$10.50");
    }

    #[test]
    fn test_ordering() {
        let a = Amount::from_cents(100);
        let b = Amount::from_cents(200);
        assert!(a < b);
        assert!(b > a);
    }
}
