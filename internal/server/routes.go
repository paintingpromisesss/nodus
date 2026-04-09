package server

func (s *Server) registerRoutes() {
	s.app.Get("/health", s.handleHealth)
	s.app.Post("/fetch/metadata/stream", s.handleFetchMetadataStream)
	s.app.Post("/download", s.handleDownload)
}
