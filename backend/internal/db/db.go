package db

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Pool wraps *pgxpool.Pool so callers depend on our type, not pgx directly.
type Pool struct {
	*pgxpool.Pool
}

// Config holds database pool configuration.
type Config struct {
	URL          string
	MaxOpenConns int
	MaxIdleConns int
	ConnMaxIdle  string
	ConnMaxLife  string
}

// New creates and pings a connection pool. A failed ping fails fast; the
// caller (main) treats a DB-less backend as a startup error, which is what
// /healthz depends on to mean anything.
func New(cfg *Config) (*Pool, error) {
	pc, err := pgxpool.ParseConfig(cfg.URL)
	if err != nil {
		return nil, fmt.Errorf("parse database URL: %w", err)
	}
	pc.MaxConns = int32(cfg.MaxOpenConns)
	pc.MinConns = int32(cfg.MaxIdleConns)
	if d, err := time.ParseDuration(cfg.ConnMaxIdle); err == nil {
		pc.MaxConnIdleTime = d
	}
	if d, err := time.ParseDuration(cfg.ConnMaxLife); err == nil {
		pc.MaxConnLifetime = d
	}

	pool, err := pgxpool.NewWithConfig(context.Background(), pc)
	if err != nil {
		return nil, fmt.Errorf("create connection pool: %w", err)
	}
	if err := pool.Ping(context.Background()); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}
	return &Pool{pool}, nil
}

// Close closes the pool.
func (p *Pool) Close() { p.Pool.Close() }
