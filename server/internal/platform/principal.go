package platform

type PrincipalKind string

const (
	PrincipalKindUser       PrincipalKind = "user"
	PrincipalKindLocalOwner PrincipalKind = "local_owner"
	PrincipalKindService    PrincipalKind = "service"
)

type PrincipalRole string

const (
	PrincipalRoleOwner PrincipalRole = "owner"
	PrincipalRoleAdmin PrincipalRole = "admin"
	PrincipalRoleUser  PrincipalRole = "user"
)

const (
	DesktopLocalOwnerEmail    = "local-owner@easyssh.desktop"
	DesktopLocalOwnerUsername = "Local Owner"
)

type Principal struct {
	ID      string         `json:"id,omitempty"`
	Kind    PrincipalKind  `json:"kind"`
	Role    PrincipalRole  `json:"role"`
	Profile RuntimeProfile `json:"profile"`
}

type PrincipalDescriptor struct {
	Kind PrincipalKind `json:"kind"`
	Role PrincipalRole `json:"role"`
}

func WebUserPrincipal() PrincipalDescriptor {
	return PrincipalDescriptor{
		Kind: PrincipalKindUser,
		Role: PrincipalRoleUser,
	}
}

func DesktopLocalOwnerPrincipal() PrincipalDescriptor {
	return PrincipalDescriptor{
		Kind: PrincipalKindLocalOwner,
		Role: PrincipalRoleOwner,
	}
}

func NewPrincipal(id string, kind PrincipalKind, role PrincipalRole, profile RuntimeProfile) Principal {
	return Principal{
		ID:      id,
		Kind:    kind,
		Role:    role,
		Profile: NormalizeProfile(profile),
	}
}

func NewDesktopLocalOwner(id string) Principal {
	return NewPrincipal(id, PrincipalKindLocalOwner, PrincipalRoleOwner, RuntimeProfileDesktop)
}
