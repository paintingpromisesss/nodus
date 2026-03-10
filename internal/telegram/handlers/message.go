package handlers

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/paintingpromisesss/cobalt_bot/internal/cobalt"
	"github.com/paintingpromisesss/cobalt_bot/internal/storage"
	"github.com/paintingpromisesss/cobalt_bot/internal/telegram"
	"go.uber.org/zap"
	tele "gopkg.in/telebot.v4"
)

func (h *Handler) handleMessage(c tele.Context) error {
	metaCtx, cancelMeta := context.WithTimeout(h.appCtx, h.requestTimeout)
	downloadCtx, cancelDownload := context.WithTimeout(h.appCtx, h.downloadTimeout)
	defer cancelMeta()
	defer cancelDownload()

	userID := c.Sender().ID
	username := c.Sender().Username
	user := c.Recipient()
	url := c.Text()
	sessionStartedAt := time.Now()

	normalizedURL, ok := h.urlValidator.Validate(url)
	if !ok {
		h.logger.Warn(
			"user sent invalid url",
			zap.Int64("user_id", userID),
			zap.String("username", username),
			zap.String("input", url),
		)
		return c.Send("Похоже, это невалидная или недоступная ссылка. Отправьте корректный URL.")
	}

	url = normalizedURL

	h.logger.Info(
		"user started download session",
		zap.Int64("user_id", userID),
		zap.String("username", username),
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

	statusMsg, err := c.Bot().Send(user, "Ваш запрос принят. Получаю информацию...")
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
			zap.String("username", username),
			zap.String("status", string(resp.Status)),
			zap.String("url", resp.Url),
			zap.String("filename", resp.Filename),
		)

		switch resp.Status {
		case cobalt.StatusRedirect, cobalt.StatusTunnel:
			if err := h.handleMessageStatusSingle(c, downloadCtx, statusMsg, user, userID, url, resp); err != nil {
				return err
			}
		case cobalt.StatusPicker:
			if err := h.handleMessageStatusPicker(c, statusMsg, userID, resp); err != nil {
				return err
			}
		case cobalt.StatusError:
			return cobaltErrorToErr(resp.Error)
		default:
			return fmt.Errorf("unsupported cobalt status: %q", resp.Status)
		}

		return nil
	})
	if err != nil {
		h.logger.Error(
			"download session failed",
			zap.Int64("user_id", userID),
			zap.String("username", username),
			zap.Duration("session_duration", time.Since(sessionStartedAt)),
			zap.Error(err),
		)

		if _, err := c.Bot().Edit(statusMsg, pickerErrorToText(err)); err != nil {
			h.logger.Error("failed to edit status message with error", zap.Int64("user_id", userID), zap.String("username", username), zap.Error(err))
			return err
		}

		return telegram.MarkHandled(err)
	}

	h.logger.Info(
		"download session completed",
		zap.Int64("user_id", userID),
		zap.String("username", username),
		zap.Duration("session_duration", time.Since(sessionStartedAt)),
	)

	return nil
}
