package start

import (
	"context"

	"github.com/paintingpromisesss/nodus/internal/domain/user"
)

type SettingsService interface {
	GetOrCreateUserSettings(ctx context.Context, userID int64) (user.Settings, error)
}
