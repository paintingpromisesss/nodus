package storage

import (
	"errors"
	"fmt"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/sqlite"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"github.com/jmoiron/sqlx"
	migrations "github.com/paintingpromisesss/cobalt_bot/migrations"
)

func Migrate(db *sqlx.DB) error {
	sourceDriver, err := iofs.New(migrations.FS, ".")
	if err != nil {
		return fmt.Errorf("init embedded migration source: %w", err)
	}

	dbDriver, err := sqlite.WithInstance(db.DB, &sqlite.Config{
		MigrationsTable: "schema_migrations",
	})
	if err != nil {
		return fmt.Errorf("init migration db driver: %w", err)
	}

	migrateInstance, err := migrate.NewWithInstance("iofs", sourceDriver, "sqlite", dbDriver)
	if err != nil {
		return fmt.Errorf("init migrate instance: %w", err)
	}

	defer migrateInstance.Close()

	if err := migrateInstance.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("run migrations: %w", err)
	}

	return nil
}
