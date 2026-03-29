package handlers

import (
	"context"
	"time"

	"github.com/paintingpromisesss/nodus/internal/adapters/memory"
	"github.com/paintingpromisesss/nodus/internal/telegram"
	"github.com/paintingpromisesss/nodus/internal/telegram/media"
	"github.com/paintingpromisesss/nodus/internal/telegram/presenter"
	usecasedownload "github.com/paintingpromisesss/nodus/internal/usecase/download"
	usecasepicker "github.com/paintingpromisesss/nodus/internal/usecase/picker"
	usecasestart "github.com/paintingpromisesss/nodus/internal/usecase/start"
	"go.uber.org/zap"
	tele "gopkg.in/telebot.v4"
)

type Handler struct {
	appCtx               context.Context
	requestTimeout       time.Duration
	downloadTimeout      time.Duration
	maxMediaDurationSecs int
	tb                   *telegram.Bot
	userJobGuard         *memory.UserJobGuard
	logger               *zap.Logger
	mediaService         *media.Service
	downloadService      *usecasedownload.Service
	pickerService        *usecasepicker.Service
	startService         *usecasestart.Service
}

func NewHandler(appCtx context.Context, requestTimeout time.Duration, downloadTimeout time.Duration, maxMediaDurationSecs int, tb *telegram.Bot, userJobGuard *memory.UserJobGuard, logger *zap.Logger, mediaService *media.Service, downloadService *usecasedownload.Service, pickerService *usecasepicker.Service, startService *usecasestart.Service) *Handler {
	return &Handler{
		appCtx:               appCtx,
		requestTimeout:       requestTimeout,
		downloadTimeout:      downloadTimeout,
		maxMediaDurationSecs: maxMediaDurationSecs,
		tb:                   tb,
		userJobGuard:         userJobGuard,
		logger:               logger,
		mediaService:         mediaService,
		downloadService:      downloadService,
		pickerService:        pickerService,
		startService:         startService,
	}
}

func (h *Handler) RegisterHandlers() error {
	h.tb.Bot.Handle("/start", h.handleStart)
	h.tb.Bot.Handle(tele.OnText, h.handleMessage)
	h.tb.Bot.Handle(&tele.Btn{Unique: presenter.CobaltPickerButtonUnique}, h.handleCobaltPickerCallback)
	h.tb.Bot.Handle(&tele.Btn{Unique: presenter.YtDLPPickerButtonUnique}, h.handleYtDLPPickerCallback)
	return nil
}
