package server

func (s *Server) registerRoutes() {
	s.app.Get("/health", s.handleHealth)
}
