package handlers

import (
	"context"
	"time"

	"go.uber.org/zap"
	tele "gopkg.in/telebot.v4"
)

func (h *Handler) handleStart(c tele.Context) error {
	reqCtx, cancel := context.WithTimeout(h.appCtx, 30*time.Second)
	defer cancel()
	userID := c.Sender().ID
	if err := h.storage.EnsureUserSettings(reqCtx, userID); err != nil {
		return err
	}
	h.logger.Info("user started the bot", zap.Int64("user_id", userID))
	return c.Send("Бот запущен. Просто отправьте ссылку на контент, который хотите скачать. Доступные сервисы: " + formatAvailableServices(h.availableServices))
}
