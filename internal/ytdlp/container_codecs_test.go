package ytdlp

import "testing"

func TestValidateContainerCodecsRejectsOpusInM4A(t *testing.T) {
	container := "m4a"
	audio := "opus"

	if err := validateContainerCodecs(&container, nil, &audio); err == nil {
		t.Fatal("expected opus in m4a to be rejected")
	}
}

func TestValidateContainerCodecsNormalizesRawCodecNames(t *testing.T) {
	container := "mp4"
	video := "av01.0.08M.08"
	audio := "mp4a.40.2"

	if err := validateContainerCodecs(&container, &video, &audio); err != nil {
		t.Fatalf("expected raw codec names to normalize successfully, got error: %v", err)
	}
}
