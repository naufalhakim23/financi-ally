package config

import "testing"

// TestLoadDefaults verifies env defaults apply when nothing is set; the
// smallest check that proves `make test` runs and the config path compiles.
func TestLoadDefaults(t *testing.T) {
	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Server.Port != "8080" {
		t.Errorf("port = %q, want 8080", cfg.Server.Port)
	}
	if cfg.Database.URL == "" {
		t.Error("db url should default to local docker compose DSN")
	}
}

func TestLoadEnvOverride(t *testing.T) {
	t.Setenv("SERVER_PORT", "9090")
	t.Setenv("DATABASE_URL", "postgres://x:x@localhost:5432/x?sslmode=disable")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Server.Port != "9090" {
		t.Errorf("port = %q, want 9090", cfg.Server.Port)
	}
	if cfg.Database.URL != "postgres://x:x@localhost:5432/x?sslmode=disable" {
		t.Errorf("db url override not applied: %q", cfg.Database.URL)
	}
}
