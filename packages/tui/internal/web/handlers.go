package web

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/aios/superai-cli/internal/session"
)

func (s *Server) handleListAgents(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	cfg := s.appConfig
	s.mu.RUnlock()

	type AgentInfo struct {
		Name        string `json:"name"`
		Command     string `json:"command"`
		Description string `json:"description"`
		Enabled     bool   `json:"enabled"`
	}

	agents := make([]AgentInfo, 0)

	if cfg != nil {
		for _, a := range cfg.Agents {
			agents = append(agents, AgentInfo{
				Name:        a.Name,
				Command:     a.Command,
				Description: a.Description,
				Enabled:     a.Enabled,
			})
		}
	}

	s.jsonResponse(w, agents, http.StatusOK)
}

func (s *Server) handleGetAgent(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	if name == "" {
		s.errorResponse(w, "agent name required", http.StatusBadRequest)
		return
	}

	s.mu.RLock()
	cfg := s.appConfig
	s.mu.RUnlock()

	if cfg == nil {
		s.errorResponse(w, "config not loaded", http.StatusServiceUnavailable)
		return
	}

	for _, a := range cfg.Agents {
		if a.Name == name {
			s.jsonResponse(w, map[string]interface{}{
				"name":        a.Name,
				"command":     a.Command,
				"args":        a.Args,
				"description": a.Description,
				"enabled":     a.Enabled,
			}, http.StatusOK)
			return
		}
	}

	s.errorResponse(w, "agent not found", http.StatusNotFound)
}

func (s *Server) handleStartAgent(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	if name == "" {
		s.errorResponse(w, "agent name required", http.StatusBadRequest)
		return
	}

	s.mu.RLock()
	runner := s.runner
	s.mu.RUnlock()

	if runner == nil {
		s.errorResponse(w, "runner not configured", http.StatusServiceUnavailable)
		return
	}

	ctx := context.Background()
	logChan := make(chan string, 100)

	go func() {
		for line := range logChan {
			s.AddLog("info", name, line)
			s.Broadcast("agent_output", map[string]string{"agent": name, "line": line})
		}
	}()

	if err := runner.StreamOutput(ctx, name, logChan); err != nil {
		s.errorResponse(w, err.Error(), http.StatusInternalServerError)
		return
	}

	s.AddLog("info", "agent", fmt.Sprintf("Started agent: %s", name))
	s.Broadcast("agent_started", map[string]string{"name": name})

	s.jsonResponse(w, map[string]string{"status": "started", "name": name}, http.StatusOK)
}

func (s *Server) handleStopAgent(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	if name == "" {
		s.errorResponse(w, "agent name required", http.StatusBadRequest)
		return
	}

	s.AddLog("info", "agent", fmt.Sprintf("Stop requested for agent: %s (not implemented)", name))
	s.jsonResponse(w, map[string]string{"status": "stop_requested", "name": name}, http.StatusOK)
}

func (s *Server) handleListTools(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	registry := s.registry
	s.mu.RUnlock()

	if registry == nil {
		s.errorResponse(w, "registry not configured", http.StatusServiceUnavailable)
		return
	}

	tools := registry.ListDefinitions()
	result := make([]map[string]interface{}, 0, len(tools))

	for _, t := range tools {
		result = append(result, map[string]interface{}{
			"name":        t.Name,
			"description": t.Description,
			"schema":      t.InputSchema,
		})
	}

	s.jsonResponse(w, result, http.StatusOK)
}

func (s *Server) handleExecuteTool(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	if name == "" {
		s.errorResponse(w, "tool name required", http.StatusBadRequest)
		return
	}

	s.mu.RLock()
	registry := s.registry
	s.mu.RUnlock()

	if registry == nil {
		s.errorResponse(w, "registry not configured", http.StatusServiceUnavailable)
		return
	}

	var args json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&args); err != nil {
		s.errorResponse(w, "invalid JSON body", http.StatusBadRequest)
		return
	}

	tool, ok := registry.GetTool(name)
	if !ok {
		s.errorResponse(w, "tool not found", http.StatusNotFound)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	result, err := tool.Handler(ctx, args)
	if err != nil {
		s.AddLog("error", "tool", fmt.Sprintf("Tool %s failed: %v", name, err))
		s.errorResponse(w, err.Error(), http.StatusInternalServerError)
		return
	}

	s.AddLog("info", "tool", fmt.Sprintf("Executed tool: %s", name))
	s.jsonResponse(w, map[string]interface{}{"result": result}, http.StatusOK)
}

func (s *Server) handleListSessions(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	mgr := s.sessionMgr
	s.mu.RUnlock()

	if mgr == nil {
		s.errorResponse(w, "session manager not configured", http.StatusServiceUnavailable)
		return
	}

	sessions, err := mgr.List()
	if err != nil {
		s.errorResponse(w, err.Error(), http.StatusInternalServerError)
		return
	}

	s.jsonResponse(w, sessions, http.StatusOK)
}

func (s *Server) handleGetSession(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		s.errorResponse(w, "session id required", http.StatusBadRequest)
		return
	}

	s.mu.RLock()
	mgr := s.sessionMgr
	s.mu.RUnlock()

	if mgr == nil {
		s.errorResponse(w, "session manager not configured", http.StatusServiceUnavailable)
		return
	}

	sess, err := mgr.Load(id)
	if err != nil {
		s.errorResponse(w, err.Error(), http.StatusNotFound)
		return
	}

	s.jsonResponse(w, sess, http.StatusOK)
}

func (s *Server) handleCreateSession(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	mgr := s.sessionMgr
	s.mu.RUnlock()

	if mgr == nil {
		s.errorResponse(w, "session manager not configured", http.StatusServiceUnavailable)
		return
	}

	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		req.Name = fmt.Sprintf("web-session-%d", time.Now().Unix())
	}
	if req.Name == "" {
		req.Name = fmt.Sprintf("web-session-%d", time.Now().Unix())
	}

	sess := session.NewSession(req.Name)
	if err := mgr.Save(sess); err != nil {
		s.errorResponse(w, err.Error(), http.StatusInternalServerError)
		return
	}

	s.jsonResponse(w, map[string]string{"id": sess.Metadata.ID, "name": sess.Metadata.Name}, http.StatusCreated)
}

func (s *Server) handleDeleteSession(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		s.errorResponse(w, "session id required", http.StatusBadRequest)
		return
	}

	s.mu.RLock()
	mgr := s.sessionMgr
	s.mu.RUnlock()

	if mgr == nil {
		s.errorResponse(w, "session manager not configured", http.StatusServiceUnavailable)
		return
	}

	if err := mgr.Delete(id); err != nil {
		s.errorResponse(w, err.Error(), http.StatusNotFound)
		return
	}

	s.jsonResponse(w, map[string]string{"status": "deleted"}, http.StatusOK)
}

func (s *Server) handleGetMetrics(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	collector := s.metricsCollector
	s.mu.RUnlock()

	if collector == nil {
		s.errorResponse(w, "metrics not configured", http.StatusServiceUnavailable)
		return
	}

	stats := collector.Stats()
	s.jsonResponse(w, stats, http.StatusOK)
}

func (s *Server) handleGetMetricsSummary(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	collector := s.metricsCollector
	s.mu.RUnlock()

	if collector == nil {
		s.errorResponse(w, "metrics not configured", http.StatusServiceUnavailable)
		return
	}

	summary := map[string]interface{}{
		"total_requests": collector.RequestCount(),
		"total_cost":     collector.TotalCost(),
		"total_tokens":   collector.TotalTokens(),
		"success_rate":   collector.SuccessRate(),
	}
	s.jsonResponse(w, summary, http.StatusOK)
}

func (s *Server) handleGetConfig(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	cfg := s.appConfig
	s.mu.RUnlock()

	if cfg == nil {
		s.errorResponse(w, "config not loaded", http.StatusServiceUnavailable)
		return
	}

	s.jsonResponse(w, cfg, http.StatusOK)
}

func (s *Server) handleUpdateConfig(w http.ResponseWriter, r *http.Request) {
	s.errorResponse(w, "config update via API not implemented", http.StatusNotImplemented)
}

func (s *Server) handleGetLogs(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	logs := make([]LogEntry, len(s.logs))
	copy(logs, s.logs)
	s.mu.RUnlock()

	s.jsonResponse(w, logs, http.StatusOK)
}

func (s *Server) handleChat(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Message string `json:"message"`
		Agent   string `json:"agent,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.errorResponse(w, "invalid JSON body", http.StatusBadRequest)
		return
	}

	if req.Message == "" {
		s.errorResponse(w, "message required", http.StatusBadRequest)
		return
	}

	s.AddLog("info", "chat", fmt.Sprintf("User: %s", req.Message))
	s.Broadcast("chat_message", map[string]string{
		"role":    "user",
		"content": req.Message,
	})

	s.jsonResponse(w, map[string]string{
		"status":  "received",
		"message": "Chat processing pending orchestrator integration",
	}, http.StatusOK)
}
