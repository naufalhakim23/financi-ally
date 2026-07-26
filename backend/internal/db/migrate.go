package db

import (
	"embed"
	"fmt"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/stdlib"
)

// migrationsFS holds the embedded .sql migrations. golang-migrate runs them in
// filename order; each migration is a pair <n>_name.up.sql / <n>_name.down.sql.
//
//go:embed migrations/*.sql
var migrationsFS embed.FS

// Migrate runs all pending up migrations against dsn. It opens its own short-lived
// *sql.DB (via pgx stdlib); golang-migrate speaks database/sql, not the pgx pool,
// and we don't want migration locking to share pool connections with request traffic.
// Fail-closed: any migration error returns and the caller (main) refuses to start.
//
// Dirty-migration recovery: if a migration fails partway, golang-migrate marks the
// schema_versions row dirty and every subsequent boot fails on ErrDirty. To recover,
// inspect `migrate version` against the embedded migrations, fix the offending SQL,
// and force the version back: `migrate -database <dsn> -path migrations force <n>`
// (or the equivalent golang-migrate CLI / `m.Force(n)`). Never force forward past an
// unapplied migration; that skips it and desyncs the cluster.
func Migrate(dsn string) error {
	src, err := iofs.New(migrationsFS, "migrations")
	if err != nil {
		return fmt.Errorf("build migrate source: %w", err)
	}

	pgCfg, err := pgx.ParseConfig(dsn)
	if err != nil {
		return fmt.Errorf("parse dsn for migrations: %w", err)
	}
	sqlDB := stdlib.OpenDB(*pgCfg)
	defer sqlDB.Close()

	dbDriver, err := postgres.WithInstance(sqlDB, &postgres.Config{})
	if err != nil {
		return fmt.Errorf("init postgres driver for migrate: %w", err)
	}
	m, err := migrate.NewWithInstance("iofs", src, "postgres", dbDriver)
	if err != nil {
		return fmt.Errorf("init migrate: %w", err)
	}
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("apply migrations: %w", err)
	}
	srcErr, dbErr := m.Close()
	if srcErr != nil {
		return fmt.Errorf("close migrate source: %w", srcErr)
	}
	if dbErr != nil {
		return fmt.Errorf("close migrate db: %w", dbErr)
	}
	return nil
}
