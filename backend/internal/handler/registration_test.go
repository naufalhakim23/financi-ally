package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestClosedRegistration(t *testing.T) {
	tests := []struct {
		name   string
		open   bool
		method string
		path   string
		want   int
	}{
		{"open lets register through", true, http.MethodPost, "/auth/register", http.StatusOK},
		{"closed blocks register", false, http.MethodPost, "/auth/register", http.StatusForbidden},
		{"closed still allows login", false, http.MethodPost, "/auth/login", http.StatusOK},
		{"closed ignores non-POST", false, http.MethodGet, "/auth/register", http.StatusOK},
	}

	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			ClosedRegistration(tt.open)(next).ServeHTTP(rec, httptest.NewRequest(tt.method, tt.path, nil))
			if rec.Code != tt.want {
				t.Fatalf("status = %d, want %d", rec.Code, tt.want)
			}
		})
	}
}
