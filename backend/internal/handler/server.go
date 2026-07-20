// Package handler implements the oapi-codegen-generated ServerInterface and
// hosts hand-mounted routes that don't fit the generated surface (later:
// OAuth redirects, sync push/pull). M0: just /healthz.
package handler

import (
	"encoding/json"
	"net/http"

	"github.com/naufalhakim23/financi-ally/backend/api"
	"github.com/naufalhakim23/financi-ally/backend/internal/db"
)

// ServerImpl implements api.ServerInterface.
type ServerImpl struct {
	db *db.Pool
}

// NewServerImpl wires the handler with its dependencies.
func NewServerImpl(pool *db.Pool) *ServerImpl {
	return &ServerImpl{db: pool}
}

// Compile-time interface satisfaction — breaks at build if the generated
// interface drifts from our impl.
var _ api.ServerInterface = (*ServerImpl)(nil)

// GetHealthz is the liveness + DB-connectivity probe.
// 200 {"status":"ok","db":"up"} when Postgres answers; 503 {"db":"down"} when not.
func (s *ServerImpl) GetHealthz(w http.ResponseWriter, r *http.Request) {
	dbStatus := api.Up
	if err := s.db.Ping(r.Context()); err != nil {
		dbStatus = api.Down
	}
	code := http.StatusOK
	if dbStatus == api.Down {
		code = http.StatusServiceUnavailable
	}
	writeJSON(w, code, api.HealthStatus{Status: "ok", Db: dbStatus})
}

// writeJSON encodes v as JSON with the given status. Errors are logged-only —
// a response has usually already started; there is no one to surface them to.
func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}
