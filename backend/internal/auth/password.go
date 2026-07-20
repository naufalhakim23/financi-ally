package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"golang.org/x/crypto/argon2"
)

// argon2id parameters. OWASP-recommended band (64 MiB / 3 iterations / degree-2
// parallelism) — strong against offline GPU cracking, ~50ms on a laptop. Tunable
// here in one place if the threat model or hardware changes.
const (
	argonMemory      uint32 = 64 * 1024
	argonIterations  uint32 = 3
	argonParallelism uint8  = 2
	argonSaltLen            = 16
	argonKeyLen             = 32
)

// ErrMalformedHash means a stored hash didn't parse — treat as a server error,
// never as "wrong password" (a bad parse is a data-integrity problem).
var ErrMalformedHash = errors.New("malformed password hash")

// HashPassword salts and hashes a plaintext password with argon2id, returning a
// self-describing PHC-style string: $argon2id$v=19$m=..,t=..,p=..$salt$hash.
// Storing the params in the string lets us retune the constants above and still
// verify old hashes until each user re-hashes on next login.
func HashPassword(password string) (string, error) {
	salt := make([]byte, argonSaltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("generate salt: %w", err)
	}
	key := argon2.IDKey([]byte(password), salt, argonIterations, argonMemory, argonParallelism, argonKeyLen)
	b64 := base64.RawStdEncoding
	return fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version, argonMemory, argonIterations, argonParallelism,
		b64.EncodeToString(salt), b64.EncodeToString(key)), nil
}

// VerifyPassword checks plaintext against an encoded hash in constant time.
// A malformed hash returns ErrMalformedHash; a well-formed but non-matching
// hash returns (false, nil) so callers can map it to "invalid credentials".
func VerifyPassword(encoded, password string) (bool, error) {
	parts := strings.Split(encoded, "$")
	// ["", "argon2id", "v=19", "m=..,t=..,p=..", "salt", "key"]
	if len(parts) != 6 || parts[1] != "argon2id" {
		return false, ErrMalformedHash
	}

	var version int
	if _, err := fmt.Sscanf(parts[2], "v=%d", &version); err != nil {
		return false, ErrMalformedHash
	}

	memory, iterations, parallelism, err := parseParams(parts[3])
	if err != nil {
		return false, err
	}

	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		return false, ErrMalformedHash
	}
	wantKey, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil {
		return false, ErrMalformedHash
	}

	gotKey := argon2.IDKey([]byte(password), salt, iterations, memory, parallelism, uint32(len(wantKey)))
	return subtle.ConstantTimeCompare(gotKey, wantKey) == 1, nil
}

// parseParams reads the "m=..,t=..,p=.." segment. Order-invariant.
func parseParams(s string) (memory uint32, iterations uint32, parallelism uint8, err error) {
	for _, field := range strings.Split(s, ",") {
		kv := strings.SplitN(field, "=", 2)
		if len(kv) != 2 {
			return 0, 0, 0, ErrMalformedHash
		}
		switch kv[0] {
		case "m":
			n, e := strconv.ParseUint(kv[1], 10, 32)
			if e != nil {
				return 0, 0, 0, ErrMalformedHash
			}
			memory = uint32(n)
		case "t":
			n, e := strconv.ParseUint(kv[1], 10, 32)
			if e != nil {
				return 0, 0, 0, ErrMalformedHash
			}
			iterations = uint32(n)
		case "p":
			n, e := strconv.ParseUint(kv[1], 10, 8)
			if e != nil {
				return 0, 0, 0, ErrMalformedHash
			}
			parallelism = uint8(n)
		default:
			return 0, 0, 0, ErrMalformedHash
		}
	}
	return memory, iterations, parallelism, nil
}
