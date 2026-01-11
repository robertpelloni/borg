package web

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/aios/superai-cli/internal/agent"
	"github.com/aios/superai-cli/internal/config"
	"github.com/aios/superai-cli/internal/metrics"
	"github.com/aios/superai-cli/internal/orchestrator"
	"github.com/aios/superai-cli/internal/session"
)

//go:embed static/*
var staticFiles embed.FS

type ServerConfig struct {
	Host         string `json:"host" yaml:"host"`
	Port         int    `json:"port" yaml:"port"`
	EnableCORS   bool   `json:"enable_cors" yaml:"enable_cors"`
	ReadTimeout  int    `json:"read_timeout" yaml:"read_timeout"`
	WriteTimeout int    `json:"write_timeout" yaml:"write_timeout"`
}

func DefaultServerConfig() *ServerConfig {
	return &ServerConfig{
		Host:         "localhost",
		Port:         8080,
		EnableCORS:   true,
		ReadTimeout:  30,
		WriteTimeout: 30,
	}
}

type Server struct {
	config     *ServerConfig
	httpServer *http.Server
	router     *http.ServeMux

	runner           *agent.Runner
	registry         *orchestrator.Registry
	appConfig        *config.Config
	sessionMgr       *session.Manager
	metricsCollector *metrics.Collector

	wsHub *WebSocketHub

	mu        sync.RWMutex
	running   bool
	startedAt time.Time
	logs      []LogEntry
	maxLogs   int
}

type LogEntry struct {
	Timestamp time.Time `json:"timestamp"`
	Level     string    `json:"level"`
	Source    string    `json:"source"`
	Message   string    `json:"message"`
}

func NewServer(cfg *ServerConfig) *Server {
	if cfg == nil {
		cfg = DefaultServerConfig()
	}

	s := &Server{
		config:  cfg,
		router:  http.NewServeMux(),
		wsHub:   NewWebSocketHub(),
		logs:    make([]LogEntry, 0, 1000),
		maxLogs: 1000,
	}

	s.setupRoutes()
	return s
}

func (s *Server) SetRunner(r *agent.Runner) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.runner = r
}

func (s *Server) SetRegistry(r *orchestrator.Registry) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.registry = r
}

func (s *Server) SetConfig(c *config.Config) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.appConfig = c
}

func (s *Server) SetSessionManager(m *session.Manager) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sessionMgr = m
}

func (s *Server) SetMetricsCollector(c *metrics.Collector) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.metricsCollector = c
}

func (s *Server) setupRoutes() {
	s.router.HandleFunc("GET /api/health", s.handleHealth)
	s.router.HandleFunc("GET /api/status", s.handleStatus)

	s.router.HandleFunc("GET /api/agents", s.handleListAgents)
	s.router.HandleFunc("GET /api/agents/{name}", s.handleGetAgent)
	s.router.HandleFunc("POST /api/agents/{name}/start", s.handleStartAgent)
	s.router.HandleFunc("POST /api/agents/{name}/stop", s.handleStopAgent)

	s.router.HandleFunc("GET /api/tools", s.handleListTools)
	s.router.HandleFunc("POST /api/tools/{name}/execute", s.handleExecuteTool)

	s.router.HandleFunc("GET /api/sessions", s.handleListSessions)
	s.router.HandleFunc("GET /api/sessions/{id}", s.handleGetSession)
	s.router.HandleFunc("POST /api/sessions", s.handleCreateSession)
	s.router.HandleFunc("DELETE /api/sessions/{id}", s.handleDeleteSession)

	s.router.HandleFunc("GET /api/metrics", s.handleGetMetrics)
	s.router.HandleFunc("GET /api/metrics/summary", s.handleGetMetricsSummary)

	s.router.HandleFunc("GET /api/config", s.handleGetConfig)
	s.router.HandleFunc("PUT /api/config", s.handleUpdateConfig)

	s.router.HandleFunc("GET /api/logs", s.handleGetLogs)

	s.router.HandleFunc("POST /api/chat", s.handleChat)

	s.router.HandleFunc("GET /ws", s.handleWebSocket)

	staticFS, err := fs.Sub(staticFiles, "static")
	if err != nil {
		log.Printf("Warning: could not load embedded static files: %v", err)
	} else {
		s.router.Handle("GET /", http.FileServer(http.FS(staticFS)))
	}
}

func (s *Server) Start() error {
	s.mu.Lock()
	if s.running {
		s.mu.Unlock()
		return fmt.Errorf("server already running")
	}

	addr := fmt.Sprintf("%s:%d", s.config.Host, s.config.Port)

	ln, err := net.Listen("tcp", addr)
	if err != nil {
		s.mu.Unlock()
		return fmt.Errorf("port %d unavailable: %w", s.config.Port, err)
	}
	ln.Close()

	handler := s.corsMiddleware(s.loggingMiddleware(s.router))

	s.httpServer = &http.Server{
		Addr:         addr,
		Handler:      handler,
		ReadTimeout:  time.Duration(s.config.ReadTimeout) * time.Second,
		WriteTimeout: time.Duration(s.config.WriteTimeout) * time.Second,
	}

	s.running = true
	s.startedAt = time.Now()
	s.mu.Unlock()

	go s.wsHub.Run()

	go func() {
		s.AddLog("info", "server", fmt.Sprintf("Web UI available at http://%s", addr))
		if err := s.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			s.AddLog("error", "server", fmt.Sprintf("Server error: %v", err))
		}
	}()

	return nil
}

func (s *Server) Stop() error {
	s.mu.Lock()
	if !s.running {
		s.mu.Unlock()
		return nil
	}
	s.running = false
	s.mu.Unlock()

	s.wsHub.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := s.httpServer.Shutdown(ctx); err != nil {
		return fmt.Errorf("shutdown error: %w", err)
	}

	s.AddLog("info", "server", "Web server stopped")
	return nil
}

func (s *Server) IsRunning() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.running
}

func (s *Server) Address() string {
	return fmt.Sprintf("http://%s:%d", s.config.Host, s.config.Port)
}

func (s *Server) AddLog(level, source, message string) {
	entry := LogEntry{
		Timestamp: time.Now(),
		Level:     level,
		Source:    source,
		Message:   message,
	}

	s.mu.Lock()
	s.logs = append(s.logs, entry)
	if len(s.logs) > s.maxLogs {
		s.logs = s.logs[len(s.logs)-s.maxLogs:]
	}
	s.mu.Unlock()

	s.wsHub.Broadcast(WebSocketMessage{
		Type:    "log",
		Payload: entry,
	})
}

func (s *Server) Broadcast(msgType string, payload interface{}) {
	s.wsHub.Broadcast(WebSocketMessage{
		Type:    msgType,
		Payload: payload,
	})
}

func (s *Server) corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if s.config.EnableCORS {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		duration := time.Since(start)

		if r.URL.Path != "/ws" && r.URL.Path != "/" && r.URL.Path != "/favicon.ico" {
			s.AddLog("debug", "http", fmt.Sprintf("%s %s %v", r.Method, r.URL.Path, duration))
		}
	})
}

func (s *Server) jsonResponse(w http.ResponseWriter, data interface{}, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(data); err != nil {
		log.Printf("JSON encode error: %v", err)
	}
}

func (s *Server) errorResponse(w http.ResponseWriter, message string, status int) {
	s.jsonResponse(w, map[string]string{"error": message}, status)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, map[string]string{"status": "ok"}, http.StatusOK)
}

func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	uptime := time.Since(s.startedAt)
	cfg := s.appConfig
	registry := s.registry
	s.mu.RUnlock()

	status := map[string]interface{}{
		"version":     "1.5.0",
		"uptime":      uptime.String(),
		"uptime_secs": uptime.Seconds(),
		"ws_clients":  s.wsHub.ClientCount(),
	}

	if cfg != nil {
		status["agents"] = len(cfg.Agents)
	}

	if registry != nil {
		status["tools"] = len(registry.ListDefinitions())
	}

	s.jsonResponse(w, status, http.StatusOK)
}
