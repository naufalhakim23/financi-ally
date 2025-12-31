use serde::{Deserialize, Serialize};

use crate::domain::errors::{DomainError, DomainResult};

/// Currency - Value object representing monetary currency
///
/// Supports common currencies with validation. Implements copy semantics
/// as currencies are immutable values.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Currency {
    code: CurrencyCode,
}

/// Supported currency codes
///
/// Currently supports major currencies. Can be extended as needed.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum CurrencyCode {
    /// US Dollar
    #[serde(rename = "USD")]
    USD,
    /// Euro
    #[serde(rename = "EUR")]
    EUR,
    /// Indonesian Rupiah
    #[serde(rename = "IDR")]
    IDR,
}

impl Currency {
    /// Create a new Currency from a currency code string
    ///
    /// # Arguments
    /// * `code` - Currency code string (e.g., "USD", "EUR", "IDR")
    ///
    /// # Returns
    /// * `Ok(Currency)` if the code is valid
    /// * `Err(DomainError::ValidationError)` if the code is invalid
    ///
    /// # Examples
    /// ```
    /// let usd = Currency::from_code("USD")?;
    /// let eur = Currency::from_code("EUR")?;
    /// ```
    pub fn from_code(code: &str) -> DomainResult<Self> {
        let currency_code = match code.to_uppercase().as_str() {
            "USD" => CurrencyCode::USD,
            "EUR" => CurrencyCode::EUR,
            "IDR" => CurrencyCode::IDR,
            _ => {
                return Err(DomainError::ValidationError(format!(
                    "Unsupported currency code: {}. Supported: USD, EUR, IDR",
                    code
                )))
            }
        };

        Ok(Self {
            code: currency_code,
        })
    }

    /// Get the currency code as a string
    ///
    /// # Returns
    /// The 3-letter currency code (e.g., "USD", "EUR", "IDR")
    pub fn as_str(&self) -> &str {
        match self.code {
            CurrencyCode::USD => "USD",
            CurrencyCode::EUR => "EUR",
            CurrencyCode::IDR => "IDR",
        }
    }

    /// Get the currency symbol
    ///
    /// # Returns
    /// The currency symbol (e.g., "$", "€", "Rp")
    pub fn symbol(&self) -> &str {
        match self.code {
            CurrencyCode::USD => "$",
            CurrencyCode::EUR => "€",
            CurrencyCode::IDR => "Rp",
        }
    }

    /// Get the currency code enum
    pub fn code(&self) -> CurrencyCode {
        self.code
    }
}

impl std::fmt::Display for Currency {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_from_code_valid() {
        let usd = Currency::from_code("USD").unwrap();
        assert_eq!(usd.as_str(), "USD");
        assert_eq!(usd.symbol(), "$");

        let eur = Currency::from_code("EUR").unwrap();
        assert_eq!(eur.as_str(), "EUR");
        assert_eq!(eur.symbol(), "€");

        let idr = Currency::from_code("IDR").unwrap();
        assert_eq!(idr.as_str(), "IDR");
        assert_eq!(idr.symbol(), "Rp");
    }

    #[test]
    fn test_from_code_case_insensitive() {
        let usd_lower = Currency::from_code("usd").unwrap();
        let usd_upper = Currency::from_code("USD").unwrap();
        let usd_mixed = Currency::from_code("UsD").unwrap();

        assert_eq!(usd_lower, usd_upper);
        assert_eq!(usd_upper, usd_mixed);
    }

    #[test]
    fn test_from_code_invalid() {
        let result = Currency::from_code("XYZ");
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("Unsupported currency code"));
    }

    #[test]
    fn test_display() {
        let usd = Currency::from_code("USD").unwrap();
        assert_eq!(format!("{}", usd), "USD");
    }

    #[test]
    fn test_equality() {
        let usd1 = Currency::from_code("USD").unwrap();
        let usd2 = Currency::from_code("USD").unwrap();
        let eur = Currency::from_code("EUR").unwrap();

        assert_eq!(usd1, usd2);
        assert_ne!(usd1, eur);
    }

    #[test]
    fn test_serialization() {
        let usd = Currency::from_code("USD").unwrap();
        let json = serde_json::to_string(&usd).unwrap();
        assert_eq!(json, r#"{"code":"USD"}"#);

        let deserialized: Currency = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized, usd);
    }
}
