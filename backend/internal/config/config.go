package config

import (
	"os"
	"strconv"
	"time"
)

// Config holds application configuration.
type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
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

// Load reads configuration from environment variables, applying defaults.
func Load() (*Config, error) {
	return &Config{
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
	}, nil
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

// getEnvDuration is retained for the config shapes later milestones add
// (auth TTLs, scheduler tick intervals); unused in M0.
func getEnvDuration(key string, defaultVal time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
	}
	return defaultVal
}

var _ = getEnvDuration // keep available for later milestones without lint noise today
