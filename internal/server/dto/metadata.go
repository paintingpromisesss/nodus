package dto

type FetchMetadataStreamRequest struct {
	URLs         []string `json:"urls"`
	FetchOptions `json:"options"`
}

type FetchOptions struct {
	UseAllClients bool `json:"use_all_clients"`
}
