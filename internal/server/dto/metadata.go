package dto

type FetchMetadataStreamRequest struct {
	URLs          []string `json:"urls"`
	UseAllClients bool     `json:"use_all_clients"`
}
