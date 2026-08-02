package handler

import (
	"context"
	"errors"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/naufalhakim23/financi-ally/backend/api"
	"github.com/naufalhakim23/financi-ally/backend/internal/household"
)

// --- ledger (book) handlers -------------------------------------------------
//
// These are the only handlers that take a ledger id from the path rather than
// from the request scope: managing a book is not the same as working inside it,
// and forcing the caller to switch books just to rename or leave one would be
// backwards. Every path id is still membership-checked in the service.

// ListLedgers returns every book the caller can open.
func (s *ServerImpl) ListLedgers(ctx context.Context, _ api.ListLedgersRequestObject) (api.ListLedgersResponseObject, error) {
	p, ok := PrincipalFrom(ctx)
	if !ok {
		return api.ListLedgers401JSONResponse(unauthenticated()), nil
	}
	memberships, err := s.household.List(ctx, p.UserID)
	if err != nil {
		return nil, err
	}
	out := make([]api.LedgerMembership, 0, len(memberships))
	for _, m := range memberships {
		out = append(out, api.LedgerMembership{
			Ledger: toAPILedger(m.Ledger),
			Role:   api.LedgerRole(m.Role),
		})
	}
	return api.ListLedgers200JSONResponse(out), nil
}

// CreateLedger makes a shared household book owned by the caller.
func (s *ServerImpl) CreateLedger(ctx context.Context, req api.CreateLedgerRequestObject) (api.CreateLedgerResponseObject, error) {
	p, ok := PrincipalFrom(ctx)
	if !ok {
		return api.CreateLedger401JSONResponse(unauthenticated()), nil
	}
	baseCurrency := ""
	if req.Body.BaseCurrency != nil {
		baseCurrency = *req.Body.BaseCurrency
	}
	l, err := s.household.Create(ctx, p.UserID, req.Body.Name, baseCurrency)
	if errors.Is(err, household.ErrInvalidInput) {
		return api.CreateLedger400JSONResponse(api.Error{
			Code: "invalid_input", Message: "name is required and currency must be a 3-letter code"}), nil
	}
	if err != nil {
		return nil, err
	}
	return api.CreateLedger201JSONResponse(toAPILedger(*l)), nil
}

// ListLedgerMembers returns who is in a book.
func (s *ServerImpl) ListLedgerMembers(ctx context.Context, req api.ListLedgerMembersRequestObject) (api.ListLedgerMembersResponseObject, error) {
	p, ok := PrincipalFrom(ctx)
	if !ok {
		return api.ListLedgerMembers401JSONResponse(unauthenticated()), nil
	}
	members, err := s.household.Members(ctx, p.UserID, req.Id)
	if errors.Is(err, household.ErrLedgerNotFound) {
		return api.ListLedgerMembers403JSONResponse(notAMember()), nil
	}
	if err != nil {
		return nil, err
	}
	out := make([]api.LedgerMember, 0, len(members))
	for _, m := range members {
		out = append(out, api.LedgerMember{
			UserId:   m.UserID,
			Email:    openapi_types.Email(m.Email),
			Role:     api.LedgerRole(m.Role),
			JoinedAt: m.JoinedAt,
		})
	}
	return api.ListLedgerMembers200JSONResponse(out), nil
}

// RemoveLedgerMember removes someone from a book, or lets a member leave.
func (s *ServerImpl) RemoveLedgerMember(ctx context.Context, req api.RemoveLedgerMemberRequestObject) (api.RemoveLedgerMemberResponseObject, error) {
	p, ok := PrincipalFrom(ctx)
	if !ok {
		return api.RemoveLedgerMember401JSONResponse(unauthenticated()), nil
	}
	err := s.household.RemoveMember(ctx, p.UserID, req.Id, req.UserId)
	switch {
	case errors.Is(err, household.ErrLedgerNotFound):
		return api.RemoveLedgerMember403JSONResponse(notAMember()), nil
	case errors.Is(err, household.ErrNotOwner):
		return api.RemoveLedgerMember403JSONResponse(api.Error{
			Code: "not_owner", Message: "only an owner can remove another member"}), nil
	case errors.Is(err, household.ErrPersonalLedger):
		return api.RemoveLedgerMember403JSONResponse(api.Error{
			Code: "personal_ledger", Message: "your personal book cannot be left"}), nil
	case err != nil:
		return nil, err
	}
	return api.RemoveLedgerMember204Response{}, nil
}

// CreateLedgerInvite issues a join code for a household book.
func (s *ServerImpl) CreateLedgerInvite(ctx context.Context, req api.CreateLedgerInviteRequestObject) (api.CreateLedgerInviteResponseObject, error) {
	p, ok := PrincipalFrom(ctx)
	if !ok {
		return api.CreateLedgerInvite401JSONResponse(unauthenticated()), nil
	}
	inv, err := s.household.Invite(ctx, p.UserID, req.Id)
	switch {
	case errors.Is(err, household.ErrLedgerNotFound):
		return api.CreateLedgerInvite403JSONResponse(notAMember()), nil
	case errors.Is(err, household.ErrNotOwner):
		return api.CreateLedgerInvite403JSONResponse(api.Error{
			Code: "not_owner", Message: "only an owner can invite to this ledger"}), nil
	case errors.Is(err, household.ErrPersonalLedger):
		return api.CreateLedgerInvite403JSONResponse(api.Error{
			Code: "personal_ledger", Message: "create a household ledger to share with someone"}), nil
	case err != nil:
		return nil, err
	}
	return api.CreateLedgerInvite201JSONResponse(api.LedgerInvite{
		Code:      inv.Code,
		LedgerId:  inv.LedgerID,
		ExpiresAt: inv.ExpiresAt,
	}), nil
}

// JoinLedger redeems a join code.
func (s *ServerImpl) JoinLedger(ctx context.Context, req api.JoinLedgerRequestObject) (api.JoinLedgerResponseObject, error) {
	p, ok := PrincipalFrom(ctx)
	if !ok {
		return api.JoinLedger401JSONResponse(unauthenticated()), nil
	}
	l, err := s.household.Join(ctx, p.UserID, req.Body.Code)
	// An invalid code and a malformed one are the same answer on purpose: a
	// different response for "well-formed but wrong" would let someone probe
	// the code space more cheaply.
	if errors.Is(err, household.ErrInviteInvalid) || errors.Is(err, household.ErrInvalidInput) {
		return api.JoinLedger404JSONResponse(api.Error{
			Code: "invalid_code", Message: "this code is not valid or has expired"}), nil
	}
	if err != nil {
		return nil, err
	}
	return api.JoinLedger200JSONResponse(toAPILedger(*l)), nil
}

func toAPILedger(l household.Ledger) api.Ledger {
	return api.Ledger{
		Id:           l.ID,
		Name:         l.Name,
		BaseCurrency: l.BaseCurrency,
		Kind:         api.LedgerKind(l.Kind),
		CreatedAt:    l.CreatedAt,
	}
}

func unauthenticated() api.Error {
	return api.Error{Code: "unauthenticated", Message: "missing or invalid token"}
}

func notAMember() api.Error {
	return api.Error{Code: "ledger_forbidden", Message: "you are not a member of this ledger"}
}
