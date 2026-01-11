package rag

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"sync"
	"time"
)

type EmbeddingProvider interface {
	Embed(ctx context.Context, texts []string) ([]Vector, error)
	Dimensions() int
	Model() string
}

type OpenAIEmbedding struct {
	apiKey     string
	model      string
	dimensions int
	baseURL    string
	client     *http.Client
}

type OpenAIEmbeddingConfig struct {
	APIKey     string
	Model      string
	Dimensions int
	BaseURL    string
	Timeout    time.Duration
}

func NewOpenAIEmbedding(cfg *OpenAIEmbeddingConfig) *OpenAIEmbedding {
	if cfg == nil {
		cfg = &OpenAIEmbeddingConfig{}
	}

	apiKey := cfg.APIKey
	if apiKey == "" {
		apiKey = os.Getenv("OPENAI_API_KEY")
	}

	model := cfg.Model
	if model == "" {
		model = "text-embedding-3-small"
	}

	dimensions := cfg.Dimensions
	if dimensions == 0 {
		switch model {
		case "text-embedding-3-large":
			dimensions = 3072
		case "text-embedding-3-small":
			dimensions = 1536
		case "text-embedding-ada-002":
			dimensions = 1536
		default:
			dimensions = 1536
		}
	}

	baseURL := cfg.BaseURL
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}

	timeout := cfg.Timeout
	if timeout == 0 {
		timeout = 30 * time.Second
	}

	return &OpenAIEmbedding{
		apiKey:     apiKey,
		model:      model,
		dimensions: dimensions,
		baseURL:    baseURL,
		client:     &http.Client{Timeout: timeout},
	}
}

type openAIEmbeddingRequest struct {
	Input          []string `json:"input"`
	Model          string   `json:"model"`
	EncodingFormat string   `json:"encoding_format,omitempty"`
	Dimensions     int      `json:"dimensions,omitempty"`
}

type openAIEmbeddingResponse struct {
	Data  []openAIEmbeddingData `json:"data"`
	Usage openAIUsage           `json:"usage"`
	Error *openAIError          `json:"error,omitempty"`
}

type openAIEmbeddingData struct {
	Embedding []float32 `json:"embedding"`
	Index     int       `json:"index"`
}

type openAIUsage struct {
	PromptTokens int `json:"prompt_tokens"`
	TotalTokens  int `json:"total_tokens"`
}

type openAIError struct {
	Message string `json:"message"`
	Type    string `json:"type"`
	Code    string `json:"code"`
}

func (o *OpenAIEmbedding) Embed(ctx context.Context, texts []string) ([]Vector, error) {
	if len(texts) == 0 {
		return nil, nil
	}

	if o.apiKey == "" {
		return nil, fmt.Errorf("OpenAI API key not set")
	}

	req := &openAIEmbeddingRequest{
		Input:          texts,
		Model:          o.model,
		EncodingFormat: "float",
	}

	if o.model == "text-embedding-3-small" || o.model == "text-embedding-3-large" {
		req.Dimensions = o.dimensions
	}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", o.baseURL+"/embeddings", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+o.apiKey)

	resp, err := o.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	var embResp openAIEmbeddingResponse
	if err := json.Unmarshal(respBody, &embResp); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	if embResp.Error != nil {
		return nil, fmt.Errorf("OpenAI error: %s (type: %s, code: %s)",
			embResp.Error.Message, embResp.Error.Type, embResp.Error.Code)
	}

	vectors := make([]Vector, len(texts))
	for _, d := range embResp.Data {
		vectors[d.Index] = d.Embedding
	}

	return vectors, nil
}

func (o *OpenAIEmbedding) Dimensions() int { return o.dimensions }
func (o *OpenAIEmbedding) Model() string   { return o.model }

type OllamaEmbedding struct {
	baseURL    string
	model      string
	dimensions int
	client     *http.Client
}

type OllamaEmbeddingConfig struct {
	BaseURL    string
	Model      string
	Dimensions int
	Timeout    time.Duration
}

func NewOllamaEmbedding(cfg *OllamaEmbeddingConfig) *OllamaEmbedding {
	if cfg == nil {
		cfg = &OllamaEmbeddingConfig{}
	}

	baseURL := cfg.BaseURL
	if baseURL == "" {
		baseURL = "http://localhost:11434"
	}

	model := cfg.Model
	if model == "" {
		model = "nomic-embed-text"
	}

	dimensions := cfg.Dimensions
	if dimensions == 0 {
		switch model {
		case "nomic-embed-text":
			dimensions = 768
		case "mxbai-embed-large":
			dimensions = 1024
		case "all-minilm":
			dimensions = 384
		default:
			dimensions = 768
		}
	}

	timeout := cfg.Timeout
	if timeout == 0 {
		timeout = 60 * time.Second
	}

	return &OllamaEmbedding{
		baseURL:    baseURL,
		model:      model,
		dimensions: dimensions,
		client:     &http.Client{Timeout: timeout},
	}
}

type ollamaEmbeddingRequest struct {
	Model  string `json:"model"`
	Prompt string `json:"prompt"`
}

type ollamaEmbeddingResponse struct {
	Embedding []float32 `json:"embedding"`
	Error     string    `json:"error,omitempty"`
}

func (o *OllamaEmbedding) Embed(ctx context.Context, texts []string) ([]Vector, error) {
	if len(texts) == 0 {
		return nil, nil
	}

	vectors := make([]Vector, len(texts))
	var wg sync.WaitGroup
	var mu sync.Mutex
	var firstErr error

	semaphore := make(chan struct{}, 4)

	for i, text := range texts {
		wg.Add(1)
		go func(idx int, t string) {
			defer wg.Done()
			semaphore <- struct{}{}
			defer func() { <-semaphore }()

			vec, err := o.embedSingle(ctx, t)
			mu.Lock()
			if err != nil && firstErr == nil {
				firstErr = err
			} else if err == nil {
				vectors[idx] = vec
			}
			mu.Unlock()
		}(i, text)
	}

	wg.Wait()

	if firstErr != nil {
		return nil, firstErr
	}

	return vectors, nil
}

func (o *OllamaEmbedding) embedSingle(ctx context.Context, text string) (Vector, error) {
	req := &ollamaEmbeddingRequest{
		Model:  o.model,
		Prompt: text,
	}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", o.baseURL+"/api/embeddings", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := o.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	var embResp ollamaEmbeddingResponse
	if err := json.NewDecoder(resp.Body).Decode(&embResp); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	if embResp.Error != "" {
		return nil, fmt.Errorf("Ollama error: %s", embResp.Error)
	}

	return embResp.Embedding, nil
}

func (o *OllamaEmbedding) Dimensions() int { return o.dimensions }
func (o *OllamaEmbedding) Model() string   { return o.model }

type CachedEmbedding struct {
	provider EmbeddingProvider
	cache    map[string]Vector
	mu       sync.RWMutex
	hits     int
	misses   int
}

func NewCachedEmbedding(provider EmbeddingProvider) *CachedEmbedding {
	return &CachedEmbedding{
		provider: provider,
		cache:    make(map[string]Vector),
	}
}

func (c *CachedEmbedding) Embed(ctx context.Context, texts []string) ([]Vector, error) {
	results := make([]Vector, len(texts))
	var toEmbed []string
	var toEmbedIdx []int

	c.mu.RLock()
	for i, text := range texts {
		if vec, ok := c.cache[text]; ok {
			results[i] = vec
			c.hits++
		} else {
			toEmbed = append(toEmbed, text)
			toEmbedIdx = append(toEmbedIdx, i)
			c.misses++
		}
	}
	c.mu.RUnlock()

	if len(toEmbed) == 0 {
		return results, nil
	}

	newVecs, err := c.provider.Embed(ctx, toEmbed)
	if err != nil {
		return nil, err
	}

	c.mu.Lock()
	for i, idx := range toEmbedIdx {
		results[idx] = newVecs[i]
		c.cache[toEmbed[i]] = newVecs[i]
	}
	c.mu.Unlock()

	return results, nil
}

func (c *CachedEmbedding) Dimensions() int { return c.provider.Dimensions() }
func (c *CachedEmbedding) Model() string   { return c.provider.Model() }

func (c *CachedEmbedding) Stats() (hits, misses int) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.hits, c.misses
}

func (c *CachedEmbedding) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.cache = make(map[string]Vector)
	c.hits = 0
	c.misses = 0
}
