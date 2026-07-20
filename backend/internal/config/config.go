package config

import (
	"errors"
	"os"
	"strconv"
	"time"
)

// devJWTSecret is the insecure default used only in development. A production
// load fails fast if JWTSecret is still this value — a forgetful deploy must
// never mint tokens signed with a public default.
const devJWTSecret = "change-this-jwt-secret-in-production"

// Config holds application configuration.
type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	Auth     AuthConfig
	Google   GoogleOAuthConfig
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
// ClientSecret lives on the server only — the app never sees it.
type GoogleOAuthConfig struct {
	ClientID    string
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
	}

	if cfg.Server.Environment == "production" && cfg.Auth.JWTSecret == devJWTSecret {
		return nil, errors.New("JWT_SECRET must be set to a non-default value in production")
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

func getEnvDuration(key string, defaultVal time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
	}
	return defaultVal
}
