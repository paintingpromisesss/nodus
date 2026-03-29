package settings

import (
	"context"

	"github.com/paintingpromisesss/nodus/internal/domain/user"
)

type Repository interface {
	GetUserSettings(ctx context.Context, userID int64) (user.Settings, error)
	UpsertUserSettings(ctx context.Context, settings user.Settings) error
}
