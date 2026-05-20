package auth

import (
	"errors"

	"github.com/easyssh/server/internal/pkg/password"
)

func validatePasswordNotPwned(passwordValue string) error {
	err := password.ValidateNotPwned(passwordValue)
	if err == nil {
		return nil
	}
	return errors.New(err.Error())
}
