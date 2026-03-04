package handlers

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/paintingpromisesss/cobalt_bot/internal/cobalt"
	"github.com/paintingpromisesss/cobalt_bot/internal/downloader"
	"github.com/paintingpromisesss/cobalt_bot/internal/storage"
	"go.uber.org/zap"
	tele "gopkg.in/telebot.v4"
)

func (h *Handler) handleMessage(c tele.Context) error {
	metaCtx, cancelMeta := context.WithTimeout(h.appCtx, 30*time.Second)
	downloadCtx, cancelDownload := context.WithTimeout(h.appCtx, 10*time.Minute)
	defer cancelMeta()
	defer cancelDownload()

	userID := c.Sender().ID
	url := c.Text()
	sessionStartedAt := time.Now()

	normalizedURL, ok := h.urlValidator.Validate(url)
	if !ok {
		h.logger.Warn(
			"user sent invalid url",
			zap.Int64("user_id", userID),
			zap.String("input", url),
		)
		return c.Send("Похоже, это невалидная или недоступная ссылка. Отправьте корректный URL.")
	}

	url = normalizedURL

	h.logger.Info(
		"user started download session",
		zap.Int64("user_id", userID),
		zap.String("url", url),
	)

	settings, err := h.storage.GetUserSettings(metaCtx, userID)
	if err != nil {
		if errors.Is(err, storage.ErrUserSettingsNotFound) {
			if err := h.storage.EnsureUserSettings(metaCtx, userID); err != nil {
				return err
			}
			settings = storage.GetDefaultUserSettings()
			settings.UserID = userID
		} else {
			return err
		}
	}

	cobaltRequest := cobalt.GetCobaltRequest(url, settings)

	statusMsg, err := c.Bot().Send(c.Recipient(), "Ваш запрос принят. Получаю информацию о файле...")
	if err != nil {
		return err
	}

	err = h.queueManager.Run(userID, func() error {
		resp, err := h.cobaltClient.GetContentURL(metaCtx, cobaltRequest)
		if err != nil {
			return err
		}

		h.logger.Info(
			"cobalt content response received",
			zap.Int64("user_id", userID),
			zap.String("status", string(resp.Status)),
			zap.String("url", resp.Url),
			zap.String("filename", resp.Filename),
		)

		if _, err := c.Bot().Edit(statusMsg, "Информация о файле получена. Имя файла: "+resp.Filename+". Начинаю загрузку..."); err != nil {
			return err
		}

		dlResult, err := h.downloader.Download(downloadCtx, resp.Url, resp.Filename)
		if err != nil {
			return err
		}

		h.logger.Info(
			"download completed",
			zap.Int64("user_id", userID),
			zap.String("path", dlResult.Path),
			zap.String("filename", dlResult.Filename),
			zap.Int64("size", dlResult.Size),
			zap.String("content_type", dlResult.ContentType),
			zap.String("detected_mime", dlResult.DetectedMIME),
		)

		if dlResult.Size <= 0 {
			return fmt.Errorf("downloaded empty file: %s", dlResult.Filename)
		}

		if _, err := c.Bot().Edit(statusMsg, "Файл загружен. Отправляю вам..."); err != nil {
			return err
		}

		defer cleanupTempFile(h.logger, dlResult.Path)

		if err := h.sender.SendFile(c, dlResult.Path, dlResult.Filename, dlResult.DetectedMIME, statusMsg); err != nil {
			return err
		}

		h.logger.Info(
			"file sent successfully",
			zap.Int64("user_id", userID),
			zap.String("filename", dlResult.Filename),
			zap.String("detected_mime", dlResult.DetectedMIME),
			zap.Int64("size", dlResult.Size),
		)

		return nil
	})
	if err != nil {
		h.logger.Error(
			"download session failed",
			zap.Int64("user_id", userID),
			zap.Duration("session_duration", time.Since(sessionStartedAt)),
			zap.Error(err),
		)

		errorText := "Произошла ошибка при обработке вашего запроса: " + err.Error()
		switch {
		case errors.Is(err, context.DeadlineExceeded):
			errorText = "Не удалось завершить обработку вовремя. Попробуйте еще раз."
		case errors.Is(err, downloader.ErrFileTooLarge):
			errorText = "Файл слишком большой для отправки."
		case errors.Is(err, downloader.ErrEmptyFile):
			errorText = "Скачанный файл оказался пустым. Попробуйте повторить позже."
		}

		if _, editErr := c.Bot().Edit(statusMsg, errorText); editErr != nil {
			h.logger.Error("failed to edit status message with error", zap.Int64("user_id", userID), zap.Error(editErr))
		}

		return err
	}

	h.logger.Info(
		"download session completed",
		zap.Int64("user_id", userID),
		zap.Duration("session_duration", time.Since(sessionStartedAt)),
	)

	return nil
}
