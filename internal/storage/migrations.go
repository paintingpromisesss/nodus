package storage

import (
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"
)

func migrate(db *sql.DB) error {
	query, err := loadMigrationQuery()
	if err != nil {
		return err
	}

	if _, err := db.Exec(query); err != nil {
		return fmt.Errorf("run migrations: %w", err)
	}
	return nil
}

func loadMigrationQuery() (string, error) {
	candidates := []string{
		filepath.Join("migrations", "0001_init_user_settings.sql"),
		filepath.Join("..", "..", "migrations", "0001_init_user_settings.sql"),
		filepath.Join("..", "..", "..", "migrations", "0001_init_user_settings.sql"),
		filepath.Join("/app", "migrations", "0001_init_user_settings.sql"),
	}

	for _, p := range candidates {
		b, err := os.ReadFile(filepath.Clean(p))
		if err == nil {
			return string(b), nil
		}
		if !errors.Is(err, os.ErrNotExist) {
			return "", fmt.Errorf("read migration file %q: %w", p, err)
		}
	}

	return "", fmt.Errorf("migration file not found in candidates: %v", candidates)
}
