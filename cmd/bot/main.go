package main

import (
	"fmt"

	"github.com/paintingpromisesss/nodus/internal/bootstrap"
	"github.com/paintingpromisesss/nodus/internal/platform/config"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		panic(fmt.Sprintf("config error: %v", err))
	}
	if err := bootstrap.Run(cfg); err != nil {
		panic(fmt.Sprintf("app run error: %v", err))
	}
}
