package telegram

import "errors"

type handledError struct {
	err error
}

func (e handledError) Error() string {
	return e.err.Error()
}

func (e handledError) Unwrap() error {
	return e.err
}

func MarkHandled(err error) error {
	if err == nil {
		return nil
	}

	var handled handledError
	if errors.As(err, &handled) {
		return err
	}

	return handledError{err: err}
}

func IsHandledError(err error) bool {
	var handled handledError
	return errors.As(err, &handled)
}
