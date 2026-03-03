package main

import (
	"fmt"

	"github.com/paintingpromisesss/cobalt_bot/internal/app"
	"github.com/paintingpromisesss/cobalt_bot/internal/config"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		panic(fmt.Sprintf("config error: %v", err))
	}
	if err := app.Run(cfg); err != nil {
		panic(fmt.Sprintf("app run error: %v", err))
	}
}
