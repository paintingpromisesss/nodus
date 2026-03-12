package pickersession

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/paintingpromisesss/cobalt_bot/internal/cobalt"
)

var (
	ErrSessionNotFound   = errors.New("picker session not found")
	ErrSessionForbidden  = errors.New("picker session access forbidden")
	ErrSessionExpired    = errors.New("picker session expired")
	ErrWrongSessionKind  = errors.New("wrong picker session kind")
	ErrInvalidOptionIdx  = errors.New("invalid option index")
	ErrNoOptionsSelected = errors.New("no options selected")
	ErrInvalidPickerMode = errors.New("invalid picker mode")
	ErrFormatNotFound    = errors.New("format option not found")
)

type SessionKind string
type PickerMode string

const (
	SessionKindCobaltPicker SessionKind = "cobalt_picker"
	SessionKindFormatPicker SessionKind = "format_picker"

	PickerModeAudio          PickerMode = "audio"
	PickerModeVideoOnly      PickerMode = "video_only"
	PickerModeVideoWithAudio PickerMode = "video_with_audio"
)

type PickerOption struct {
	Label    string
	URL      string
	Filename string
}

type FormatPickerOption struct {
	FormatID   string
	FormatNote string
	URL        string
	Filename   string
}

type CobaltPickerState struct {
	Selected []bool
	Options  []PickerOption
}

type FormatPickerState struct {
	ActiveMode    PickerMode
	FormatsByMode map[PickerMode][]FormatPickerOption
}

type pickerSession struct {
	kind      SessionKind
	userID    int64
	cobalt    *CobaltPickerState
	format    *FormatPickerState
	expiresAt time.Time
}

type PickerView struct {
	Options []PickerOptionView
}

type PickerOptionView struct {
	PickerOption
	Selected bool
}

type FormatPickerView struct {
	ActiveMode PickerMode
	Modes      []FormatPickerModeView
	Options    []FormatPickerOptionView
}

type FormatPickerModeView struct {
	Mode     PickerMode
	Selected bool
}

type FormatPickerOptionView struct {
	FormatPickerOption
	Selected bool
}

type PickerSessionManager struct {
	sessions map[string]*pickerSession
	mu       sync.Mutex
	seq      uint64
	ttl      time.Duration
}

func NewPickerSessionManager(ctx context.Context, ttl time.Duration, cleanupInterval time.Duration) *PickerSessionManager {
	if ttl <= 0 {
		panic("ttl must be positive")
	}

	if cleanupInterval <= 0 {
		panic("cleanupInterval must be positive")
	}

	m := &PickerSessionManager{
		sessions: make(map[string]*pickerSession),
		ttl:      ttl,
	}

	go m.startCleanup(ctx, cleanupInterval)

	return m
}

func (m *PickerSessionManager) CreateSession(userID int64, cobaltResponse cobalt.MainResponse) string {
	id := fmt.Sprintf("%d", atomic.AddUint64(&m.seq, 1))

	opts := ParsePickerObjects(cobaltResponse)
	sel := make([]bool, len(opts))

	m.mu.Lock()
	defer m.mu.Unlock()

	m.sessions[id] = &pickerSession{
		kind:   SessionKindCobaltPicker,
		userID: userID,
		cobalt: &CobaltPickerState{
			Selected: sel,
			Options:  opts,
		},
		expiresAt: time.Now().Add(m.ttl),
	}

	return id
}

func (m *PickerSessionManager) CreateFormatSession(userID int64, formatsByMode map[PickerMode][]FormatPickerOption, defaultMode PickerMode) string {
	id := fmt.Sprintf("%d", atomic.AddUint64(&m.seq, 1))

	state := cloneFormatPickerState(formatsByMode, defaultMode)
	if !hasFormatPickerMode(state.FormatsByMode, state.ActiveMode) {
		state.ActiveMode = firstAvailableFormatPickerMode(state.FormatsByMode)
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	m.sessions[id] = &pickerSession{
		kind:      SessionKindFormatPicker,
		userID:    userID,
		format:    &state,
		expiresAt: time.Now().Add(m.ttl),
	}

	return id
}

func (m *PickerSessionManager) GetPickerView(sessionID string, userID int64) (PickerView, error) {
	return m.withSessionView(sessionID, userID, func(s *pickerSession) error {
		if s.kind != SessionKindCobaltPicker || s.cobalt == nil {
			return ErrWrongSessionKind
		}
		return nil
	})
}

func (m *PickerSessionManager) GetFormatPickerView(sessionID string, userID int64) (FormatPickerView, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	s, err := m.validateSessionLocked(sessionID, userID)
	if err != nil {
		return FormatPickerView{}, err
	}
	if s.kind != SessionKindFormatPicker || s.format == nil {
		return FormatPickerView{}, ErrWrongSessionKind
	}

	return buildFormatPickerView(s.format), nil
}

func (m *PickerSessionManager) TogglePickerOption(sessionID string, userID int64, optionIdx int) (PickerView, error) {
	return m.withSessionView(sessionID, userID, func(s *pickerSession) error {
		if s.kind != SessionKindCobaltPicker || s.cobalt == nil {
			return ErrWrongSessionKind
		}
		if optionIdx < 0 || optionIdx >= len(s.cobalt.Options) {
			return ErrInvalidOptionIdx
		}
		s.cobalt.Selected[optionIdx] = !s.cobalt.Selected[optionIdx]
		return nil
	})
}

func (m *PickerSessionManager) MarkAllPickerOptions(sessionID string, userID int64, flag bool) (PickerView, error) {
	return m.withSessionView(sessionID, userID, func(s *pickerSession) error {
		if s.kind != SessionKindCobaltPicker || s.cobalt == nil {
			return ErrWrongSessionKind
		}
		for i := range s.cobalt.Selected {
			s.cobalt.Selected[i] = flag
		}
		return nil
	})
}

func (m *PickerSessionManager) SetFormatPickerMode(sessionID string, userID int64, mode PickerMode) (FormatPickerView, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	s, err := m.validateSessionLocked(sessionID, userID)
	if err != nil {
		return FormatPickerView{}, err
	}
	if s.kind != SessionKindFormatPicker || s.format == nil {
		return FormatPickerView{}, ErrWrongSessionKind
	}
	if !hasFormatPickerMode(s.format.FormatsByMode, mode) {
		return FormatPickerView{}, ErrInvalidPickerMode
	}

	s.format.ActiveMode = mode
	return buildFormatPickerView(s.format), nil
}

func (m *PickerSessionManager) ChooseFormatOption(sessionID string, userID int64, formatID string) (FormatPickerOption, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	s, err := m.validateSessionLocked(sessionID, userID)
	if err != nil {
		return FormatPickerOption{}, err
	}
	if s.kind != SessionKindFormatPicker || s.format == nil {
		return FormatPickerOption{}, ErrWrongSessionKind
	}

	options := s.format.FormatsByMode[s.format.ActiveMode]
	for _, option := range options {
		if option.FormatID == formatID {
			delete(m.sessions, sessionID)
			return option, nil
		}
	}

	return FormatPickerOption{}, ErrFormatNotFound
}

func (m *PickerSessionManager) ConsumeSelectedOptions(sessionID string, userID int64) ([]PickerOption, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	s, err := m.validateSessionLocked(sessionID, userID)
	if err != nil {
		return nil, err
	}
	if s.kind != SessionKindCobaltPicker || s.cobalt == nil {
		return nil, ErrWrongSessionKind
	}

	out := make([]PickerOption, 0, len(s.cobalt.Options))
	for i, opt := range s.cobalt.Options {
		if s.cobalt.Selected[i] {
			out = append(out, opt)
		}
	}

	if len(out) == 0 {
		return nil, ErrNoOptionsSelected
	}

	delete(m.sessions, sessionID)

	return out, nil
}

func (m *PickerSessionManager) DeleteSession(sessionID string, userID int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	_, err := m.validateSessionLocked(sessionID, userID)
	if err != nil {
		return err
	}

	delete(m.sessions, sessionID)
	return nil
}

func (m *PickerSessionManager) withSessionView(sessionID string, userID int64, fn func(*pickerSession) error) (PickerView, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	s, err := m.validateSessionLocked(sessionID, userID)
	if err != nil {
		return PickerView{}, err
	}
	if s.kind != SessionKindCobaltPicker || s.cobalt == nil {
		return PickerView{}, ErrWrongSessionKind
	}

	if err := fn(s); err != nil {
		return PickerView{}, err
	}

	return buildPickerView(s.cobalt), nil
}

func (m *PickerSessionManager) validateSessionLocked(sessionID string, userID int64) (*pickerSession, error) {
	session, ok := m.sessions[sessionID]
	if !ok {
		return nil, ErrSessionNotFound
	}

	if session.userID != userID {
		return nil, ErrSessionForbidden
	}

	if time.Now().After(session.expiresAt) {
		delete(m.sessions, sessionID)
		return nil, ErrSessionExpired
	}

	return session, nil
}

func (m *PickerSessionManager) startCleanup(ctx context.Context, cleanupInterval time.Duration) {
	ticker := time.NewTicker(cleanupInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			now := time.Now()
			m.mu.Lock()
			for id, session := range m.sessions {
				if now.After(session.expiresAt) {
					delete(m.sessions, id)
				}
			}
			m.mu.Unlock()
		}
	}
}

func buildPickerView(state *CobaltPickerState) PickerView {
	v := PickerView{
		Options: make([]PickerOptionView, len(state.Options)),
	}
	for i := range state.Options {
		v.Options[i] = PickerOptionView{
			PickerOption: state.Options[i],
			Selected:     state.Selected[i],
		}
	}

	return v
}

func buildFormatPickerView(state *FormatPickerState) FormatPickerView {
	view := FormatPickerView{
		ActiveMode: state.ActiveMode,
		Modes:      make([]FormatPickerModeView, 0, len(state.FormatsByMode)),
		Options:    make([]FormatPickerOptionView, 0, len(state.FormatsByMode[state.ActiveMode])),
	}

	for _, mode := range orderedPickerModes() {
		if !hasFormatPickerMode(state.FormatsByMode, mode) {
			continue
		}
		view.Modes = append(view.Modes, FormatPickerModeView{
			Mode:     mode,
			Selected: mode == state.ActiveMode,
		})
	}

	for _, option := range state.FormatsByMode[state.ActiveMode] {
		view.Options = append(view.Options, FormatPickerOptionView{
			FormatPickerOption: option,
			Selected:           false,
		})
	}

	return view
}

func ParsePickerObjects(cobaltResponse cobalt.MainResponse) []PickerOption {
	objects := cobaltResponse.Picker
	opts := make([]PickerOption, len(objects))
	for i, obj := range objects {
		opts[i] = PickerOption{
			Label:    fmt.Sprintf("%s #%d", strings.ToUpper(string(obj.Type)), i+1),
			URL:      obj.Url,
			Filename: cobalt.PickerFilenameByType(obj.Type, i+1),
		}
	}
	if cobaltResponse.PickerAudio != nil && cobaltResponse.AudioFilename != nil {
		opts = append(opts, PickerOption{
			Label:    "РђСѓРґРёРѕ",
			URL:      *cobaltResponse.PickerAudio,
			Filename: *cobaltResponse.AudioFilename,
		})
	}
	return opts
}

func cloneFormatPickerState(formatsByMode map[PickerMode][]FormatPickerOption, defaultMode PickerMode) FormatPickerState {
	cloned := make(map[PickerMode][]FormatPickerOption, len(formatsByMode))
	for mode, options := range formatsByMode {
		copied := make([]FormatPickerOption, len(options))
		copy(copied, options)
		cloned[mode] = copied
	}

	return FormatPickerState{
		ActiveMode:    defaultMode,
		FormatsByMode: cloned,
	}
}

func hasFormatPickerMode(formatsByMode map[PickerMode][]FormatPickerOption, mode PickerMode) bool {
	options, ok := formatsByMode[mode]
	return ok && len(options) > 0
}

func firstAvailableFormatPickerMode(formatsByMode map[PickerMode][]FormatPickerOption) PickerMode {
	for _, mode := range orderedPickerModes() {
		if hasFormatPickerMode(formatsByMode, mode) {
			return mode
		}
	}
	return ""
}

func orderedPickerModes() []PickerMode {
	return []PickerMode{
		PickerModeAudio,
		PickerModeVideoOnly,
		PickerModeVideoWithAudio,
	}
}
