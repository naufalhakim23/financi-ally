package config

import (
	"errors"
	"os"
	"strconv"
	"time"
)

// devJWTSecret is the insecure default used only in development. A production
// load fails fast if JWTSecret is still this value; a forgetful deploy must
// never mint tokens signed with a public default.
const devJWTSecret = "change-this-jwt-secret-in-production"

// Config holds application configuration.
type Config struct {
	Server    ServerConfig
	Database  DatabaseConfig
	Auth      AuthConfig
	Google    GoogleOAuthConfig
	FX        FXConfig
	Recurring RecurringConfig
	Mail      MailConfig
}

// MailConfig holds the transactional-email settings. An empty APIKey (or
// Mock=true) puts the sender in logging mode — see internal/mail.
type MailConfig struct {
	APIKey string
	From   string
	Mock   bool
}

// RecurringConfig holds the M6 scheduler settings. Location is the timezone the
// scheduler resolves occurrence dates in — "the 1st of the month" is a calendar
// question, so it must not silently follow the host's zone.
//
// ponytail: one server-wide zone, not per-user. Per-user timezones need a
// users.timezone column and a per-user sweep; add that when the product serves
// more than one region.
type RecurringConfig struct {
	Enabled  bool
	Interval time.Duration
	Location *time.Location
}

// FXConfig holds foreign-exchange settings.
type FXConfig struct {
	BaseCurrencies    []string // which currencies to fetch daily
	RefreshSchedule   string   // cron expression (unused in M4, manual via API)
	FrankfurterAPIURL string   // override for testing
}

// ServerConfig holds HTTP server settings.
type ServerConfig struct {
	Port        string
	Environment string // development | production
}

// DatabaseConfig holds the Postgres connection pool settings.
type DatabaseConfig struct {
	URL          string
	MaxOpenConns int
	MaxIdleConns int
	ConnMaxIdle  string
	ConnMaxLife  string
}

// AuthConfig holds JWT + refresh-token + base-currency settings.
type AuthConfig struct {
	JWTSecret           string
	AccessTokenTTL      time.Duration
	RefreshTokenTTL     time.Duration
	BaseCurrencyDefault string // ISO 4217, e.g. IDR
}

// GoogleOAuthConfig holds the server-side Google OAuth client used to exchange
// the authorization code that the mobile app (expo-auth-session, PKCE) produces.
// ClientSecret lives on the server only; the app never sees it.
type GoogleOAuthConfig struct {
	ClientID     string
	ClientSecret string
}

// Load reads configuration from environment variables, applying defaults.
// In production it fails fast on a missing JWT secret.
func Load() (*Config, error) {
	cfg := &Config{
		Server: ServerConfig{
			Port:        getEnv("SERVER_PORT", "8080"),
			Environment: getEnv("ENVIRONMENT", "development"),
		},
		Database: DatabaseConfig{
			URL:          getEnv("DATABASE_URL", "postgres://financially:financially@localhost:5433/financially?sslmode=disable"),
			MaxOpenConns: getEnvInt("DB_MAX_OPEN_CONNS", 25),
			MaxIdleConns: getEnvInt("DB_MAX_IDLE_CONNS", 5),
			ConnMaxIdle:  getEnv("DB_CONN_MAX_IDLE", "5m"),
			ConnMaxLife:  getEnv("DB_CONN_MAX_LIFE", "1h"),
		},
		Auth: AuthConfig{
			JWTSecret:           getEnv("JWT_SECRET", devJWTSecret),
			AccessTokenTTL:      getEnvDuration("JWT_ACCESS_TTL", 15*time.Minute),
			RefreshTokenTTL:     getEnvDuration("REFRESH_TOKEN_TTL", 30*24*time.Hour),
			BaseCurrencyDefault: getEnv("BASE_CURRENCY_DEFAULT", "IDR"),
		},
		Google: GoogleOAuthConfig{
			ClientID:     getEnv("GOOGLE_OAUTH_CLIENT_ID", ""),
			ClientSecret: getEnv("GOOGLE_OAUTH_CLIENT_SECRET", ""),
		},
		FX: FXConfig{
			BaseCurrencies:    []string{"EUR", "USD", "IDR", "GBP", "JPY", "SGD", "MYR", "AUD"},
			FrankfurterAPIURL: getEnv("FX_FRANKFURTER_URL", "https://api.frankfurter.app"),
		},
		Mail: MailConfig{
			APIKey: getEnv("RESEND_API_KEY", ""),
			From:   getEnv("MAIL_FROM", "Financi-Ally <onboarding@resend.dev>"),
			Mock:   getEnvBool("MAIL_MOCK", false),
		},
		Recurring: RecurringConfig{
			Enabled:  getEnvBool("RECURRING_ENABLED", true),
			Interval: getEnvDuration("RECURRING_INTERVAL", 15*time.Minute),
			Location: getEnvLocation("RECURRING_TZ", time.UTC),
		},
	}

	if cfg.Server.Environment == "production" && cfg.Auth.JWTSecret == devJWTSecret {
		return nil, errors.New("JWT_SECRET must be set to a non-default value in production")
	}
	// The mock sender logs the reset code in full; a production fallback would
	// write credentials to the app log while the user received nothing.
	if cfg.Server.Environment == "production" && !cfg.Mail.Mock && cfg.Mail.APIKey == "" {
		return nil, errors.New("RESEND_API_KEY must be set in production (or MAIL_MOCK=true to acknowledge no email is sent)")
	}
	return cfg, nil
}

func getEnv(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}

func getEnvInt(key string, defaultVal int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return defaultVal
}

func getEnvBool(key string, defaultVal bool) bool {
	if v := os.Getenv(key); v != "" {
		if b, err := strconv.ParseBool(v); err == nil {
			return b
		}
	}
	return defaultVal
}

// getEnvLocation resolves an IANA zone name. An unparseable zone falls back to
// the default rather than failing the boot — a mistyped zone shouldn't take the
// API down, and the scheduler still runs on a well-defined calendar.
func getEnvLocation(key string, defaultVal *time.Location) *time.Location {
	if v := os.Getenv(key); v != "" {
		if loc, err := time.LoadLocation(v); err == nil {
			return loc
		}
	}
	return defaultVal
}

func getEnvDuration(key string, defaultVal time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
	}
	return defaultVal
}
