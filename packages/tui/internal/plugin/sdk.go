package plugin

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"sync"
	"time"
)

type BasePlugin struct {
	info      PluginInfo
	config    json.RawMessage
	started   bool
	mu        sync.RWMutex
	eventBus  *EventBus
	hooks     *HookManager
	sandbox   *Sandbox
	logger    Logger
	metrics   *PluginMetrics
	startTime time.Time
}

type PluginMetrics struct {
	mu            sync.RWMutex
	Calls         int64
	Errors        int64
	TotalDuration time.Duration
	LastCall      time.Time
	CustomMetrics map[string]float64
}

type Logger interface {
	Debug(msg string, args ...any)
	Info(msg string, args ...any)
	Warn(msg string, args ...any)
	Error(msg string, args ...any)
}

type noopLogger struct{}

func (noopLogger) Debug(_ string, _ ...any) {}
func (noopLogger) Info(_ string, _ ...any)  {}
func (noopLogger) Warn(_ string, _ ...any)  {}
func (noopLogger) Error(_ string, _ ...any) {}

func NewBasePlugin(info PluginInfo) *BasePlugin {
	return &BasePlugin{
		info:    info,
		hooks:   NewHookManager(),
		logger:  noopLogger{},
		metrics: &PluginMetrics{CustomMetrics: make(map[string]float64)},
	}
}

func (b *BasePlugin) Info() PluginInfo {
	return b.info
}

func (b *BasePlugin) Init(ctx context.Context, config json.RawMessage) error {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.config = config
	return nil
}

func (b *BasePlugin) Start(ctx context.Context) error {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.started = true
	b.startTime = time.Now()
	return nil
}

func (b *BasePlugin) Stop(ctx context.Context) error {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.started = false
	return nil
}

func (b *BasePlugin) Cleanup() error {
	return nil
}

func (b *BasePlugin) Config() json.RawMessage {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.config
}

func (b *BasePlugin) IsStarted() bool {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.started
}

func (b *BasePlugin) SetEventBus(bus *EventBus) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.eventBus = bus
}

func (b *BasePlugin) EventBus() *EventBus {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.eventBus
}

func (b *BasePlugin) Hooks() *HookManager {
	return b.hooks
}

func (b *BasePlugin) SetSandbox(sandbox *Sandbox) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.sandbox = sandbox
}

func (b *BasePlugin) Sandbox() *Sandbox {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.sandbox
}

func (b *BasePlugin) SetLogger(logger Logger) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.logger = logger
}

func (b *BasePlugin) Logger() Logger {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.logger
}

func (b *BasePlugin) RecordCall(duration time.Duration, err error) {
	b.metrics.mu.Lock()
	defer b.metrics.mu.Unlock()
	b.metrics.Calls++
	b.metrics.TotalDuration += duration
	b.metrics.LastCall = time.Now()
	if err != nil {
		b.metrics.Errors++
	}
}

func (b *BasePlugin) SetMetric(name string, value float64) {
	b.metrics.mu.Lock()
	defer b.metrics.mu.Unlock()
	b.metrics.CustomMetrics[name] = value
}

func (b *BasePlugin) IncrMetric(name string, delta float64) {
	b.metrics.mu.Lock()
	defer b.metrics.mu.Unlock()
	b.metrics.CustomMetrics[name] += delta
}

func (b *BasePlugin) GetMetrics() map[string]any {
	b.metrics.mu.RLock()
	defer b.metrics.mu.RUnlock()
	custom := make(map[string]float64)
	for k, v := range b.metrics.CustomMetrics {
		custom[k] = v
	}
	return map[string]any{
		"calls":          b.metrics.Calls,
		"errors":         b.metrics.Errors,
		"total_duration": b.metrics.TotalDuration.String(),
		"last_call":      b.metrics.LastCall,
		"custom":         custom,
	}
}

func (b *BasePlugin) Uptime() time.Duration {
	b.mu.RLock()
	defer b.mu.RUnlock()
	if b.startTime.IsZero() || !b.started {
		return 0
	}
	return time.Since(b.startTime)
}

type BaseAgentPlugin struct {
	*BasePlugin
	ExecuteFunc  func(ctx context.Context, input string) (string, error)
	StreamFunc   func(ctx context.Context, input string, output chan<- string) error
	capabilities []string
	maxTokens    int
	temperature  float64
}

func NewBaseAgentPlugin(info PluginInfo) *BaseAgentPlugin {
	info.Type = PluginTypeAgent
	return &BaseAgentPlugin{
		BasePlugin:   NewBasePlugin(info),
		capabilities: make([]string, 0),
		maxTokens:    4096,
		temperature:  0.7,
	}
}

func (a *BaseAgentPlugin) Execute(ctx context.Context, input string) (string, error) {
	start := time.Now()
	var result string
	var err error
	if a.ExecuteFunc != nil {
		result, err = a.ExecuteFunc(ctx, input)
	} else {
		err = fmt.Errorf("Execute not implemented")
	}
	a.RecordCall(time.Since(start), err)
	return result, err
}

func (a *BaseAgentPlugin) Stream(ctx context.Context, input string, output chan<- string) error {
	if a.StreamFunc != nil {
		return a.StreamFunc(ctx, input, output)
	}
	result, err := a.Execute(ctx, input)
	if err != nil {
		return err
	}
	output <- result
	return nil
}

func (a *BaseAgentPlugin) AddCapability(cap string) {
	a.capabilities = append(a.capabilities, cap)
}

func (a *BaseAgentPlugin) Capabilities() []string {
	result := make([]string, len(a.capabilities))
	copy(result, a.capabilities)
	return result
}

func (a *BaseAgentPlugin) SetMaxTokens(max int) {
	a.maxTokens = max
}

func (a *BaseAgentPlugin) MaxTokens() int {
	return a.maxTokens
}

func (a *BaseAgentPlugin) SetTemperature(temp float64) {
	a.temperature = temp
}

func (a *BaseAgentPlugin) Temperature() float64 {
	return a.temperature
}

type ToolHandler func(ctx context.Context, args json.RawMessage) (any, error)

type BaseToolPlugin struct {
	*BasePlugin
	tools      []ToolDefinition
	handlers   map[string]ToolHandler
	middleware []ToolMiddleware
	mu         sync.RWMutex
}

type ToolMiddleware func(ctx context.Context, name string, args json.RawMessage, next ToolHandler) (any, error)

func NewBaseToolPlugin(info PluginInfo) *BaseToolPlugin {
	info.Type = PluginTypeTool
	return &BaseToolPlugin{
		BasePlugin: NewBasePlugin(info),
		tools:      make([]ToolDefinition, 0),
		handlers:   make(map[string]ToolHandler),
		middleware: make([]ToolMiddleware, 0),
	}
}

func (t *BaseToolPlugin) RegisterTool(def ToolDefinition, handler ToolHandler) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.tools = append(t.tools, def)
	t.handlers[def.Name] = handler
}

func (t *BaseToolPlugin) UnregisterTool(name string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	delete(t.handlers, name)
	filtered := make([]ToolDefinition, 0, len(t.tools))
	for _, tool := range t.tools {
		if tool.Name != name {
			filtered = append(filtered, tool)
		}
	}
	t.tools = filtered
}

func (t *BaseToolPlugin) AddMiddleware(mw ToolMiddleware) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.middleware = append(t.middleware, mw)
}

func (t *BaseToolPlugin) Tools() []ToolDefinition {
	t.mu.RLock()
	defer t.mu.RUnlock()
	result := make([]ToolDefinition, len(t.tools))
	copy(result, t.tools)
	return result
}

func (t *BaseToolPlugin) ExecuteTool(ctx context.Context, name string, args json.RawMessage) (any, error) {
	t.mu.RLock()
	handler, ok := t.handlers[name]
	middleware := make([]ToolMiddleware, len(t.middleware))
	copy(middleware, t.middleware)
	t.mu.RUnlock()

	if !ok {
		return nil, fmt.Errorf("tool not found: %s", name)
	}

	start := time.Now()
	var result any
	var err error

	if len(middleware) > 0 {
		chain := handler
		for i := len(middleware) - 1; i >= 0; i-- {
			mw := middleware[i]
			next := chain
			chain = func(ctx context.Context, args json.RawMessage) (any, error) {
				return mw(ctx, name, args, next)
			}
		}
		result, err = chain(ctx, args)
	} else {
		result, err = handler(ctx, args)
	}

	t.RecordCall(time.Since(start), err)
	return result, err
}

func (t *BaseToolPlugin) HasTool(name string) bool {
	t.mu.RLock()
	defer t.mu.RUnlock()
	_, ok := t.handlers[name]
	return ok
}

type BaseThemePlugin struct {
	*BasePlugin
	colors     ThemeColors
	darkMode   bool
	fontFamily string
	fontSize   int
	spacing    int
}

func NewBaseThemePlugin(info PluginInfo, colors ThemeColors) *BaseThemePlugin {
	info.Type = PluginTypeTheme
	return &BaseThemePlugin{
		BasePlugin: NewBasePlugin(info),
		colors:     colors,
		fontFamily: "monospace",
		fontSize:   14,
		spacing:    4,
	}
}

func (t *BaseThemePlugin) Colors() ThemeColors {
	return t.colors
}

func (t *BaseThemePlugin) SetColors(colors ThemeColors) {
	t.colors = colors
}

func (t *BaseThemePlugin) Apply() error {
	return nil
}

func (t *BaseThemePlugin) IsDarkMode() bool {
	return t.darkMode
}

func (t *BaseThemePlugin) SetDarkMode(dark bool) {
	t.darkMode = dark
}

func (t *BaseThemePlugin) FontFamily() string {
	return t.fontFamily
}

func (t *BaseThemePlugin) SetFontFamily(family string) {
	t.fontFamily = family
}

func (t *BaseThemePlugin) FontSize() int {
	return t.fontSize
}

func (t *BaseThemePlugin) SetFontSize(size int) {
	t.fontSize = size
}

func (t *BaseThemePlugin) Spacing() int {
	return t.spacing
}

func (t *BaseThemePlugin) SetSpacing(spacing int) {
	t.spacing = spacing
}

type BaseProviderPlugin struct {
	*BasePlugin
	providerType string
	models       []string
	apiKey       string
	baseURL      string
	timeout      time.Duration
}

func NewBaseProviderPlugin(info PluginInfo, providerType string) *BaseProviderPlugin {
	info.Type = PluginTypeProvider
	return &BaseProviderPlugin{
		BasePlugin:   NewBasePlugin(info),
		providerType: providerType,
		models:       make([]string, 0),
		timeout:      30 * time.Second,
	}
}

func (p *BaseProviderPlugin) ProviderType() string {
	return p.providerType
}

func (p *BaseProviderPlugin) AddModel(model string) {
	p.models = append(p.models, model)
}

func (p *BaseProviderPlugin) Models() []string {
	result := make([]string, len(p.models))
	copy(result, p.models)
	return result
}

func (p *BaseProviderPlugin) SetAPIKey(key string) {
	p.apiKey = key
}

func (p *BaseProviderPlugin) SetBaseURL(url string) {
	p.baseURL = url
}

func (p *BaseProviderPlugin) BaseURL() string {
	return p.baseURL
}

func (p *BaseProviderPlugin) SetTimeout(timeout time.Duration) {
	p.timeout = timeout
}

func (p *BaseProviderPlugin) Timeout() time.Duration {
	return p.timeout
}

type BaseStoragePlugin struct {
	*BasePlugin
	storageType string
	basePath    string
	maxSize     int64
}

func NewBaseStoragePlugin(info PluginInfo, storageType string) *BaseStoragePlugin {
	info.Type = PluginTypeStorage
	return &BaseStoragePlugin{
		BasePlugin:  NewBasePlugin(info),
		storageType: storageType,
		maxSize:     100 * 1024 * 1024,
	}
}

func (s *BaseStoragePlugin) StorageType() string {
	return s.storageType
}

func (s *BaseStoragePlugin) SetBasePath(path string) {
	s.basePath = path
}

func (s *BaseStoragePlugin) BasePath() string {
	return s.basePath
}

func (s *BaseStoragePlugin) SetMaxSize(size int64) {
	s.maxSize = size
}

func (s *BaseStoragePlugin) MaxSize() int64 {
	return s.maxSize
}

func (s *BaseStoragePlugin) Read(ctx context.Context, key string) ([]byte, error) {
	return nil, fmt.Errorf("Read not implemented")
}

func (s *BaseStoragePlugin) Write(ctx context.Context, key string, data []byte) error {
	return fmt.Errorf("Write not implemented")
}

func (s *BaseStoragePlugin) Delete(ctx context.Context, key string) error {
	return fmt.Errorf("Delete not implemented")
}

func (s *BaseStoragePlugin) List(ctx context.Context, prefix string) ([]string, error) {
	return nil, fmt.Errorf("List not implemented")
}

type BaseTransportPlugin struct {
	*BasePlugin
	transportType string
	address       string
	connected     bool
	mu            sync.RWMutex
}

func NewBaseTransportPlugin(info PluginInfo, transportType string) *BaseTransportPlugin {
	info.Type = PluginTypeTransport
	return &BaseTransportPlugin{
		BasePlugin:    NewBasePlugin(info),
		transportType: transportType,
	}
}

func (t *BaseTransportPlugin) TransportType() string {
	return t.transportType
}

func (t *BaseTransportPlugin) SetAddress(addr string) {
	t.address = addr
}

func (t *BaseTransportPlugin) Address() string {
	return t.address
}

func (t *BaseTransportPlugin) Connect(ctx context.Context) error {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.connected = true
	return nil
}

func (t *BaseTransportPlugin) Disconnect(ctx context.Context) error {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.connected = false
	return nil
}

func (t *BaseTransportPlugin) IsConnected() bool {
	t.mu.RLock()
	defer t.mu.RUnlock()
	return t.connected
}

func (t *BaseTransportPlugin) Send(ctx context.Context, data []byte) error {
	return fmt.Errorf("Send not implemented")
}

func (t *BaseTransportPlugin) Receive(ctx context.Context) ([]byte, error) {
	return nil, fmt.Errorf("Receive not implemented")
}

func (t *BaseTransportPlugin) Stream(ctx context.Context) (io.ReadWriteCloser, error) {
	return nil, fmt.Errorf("Stream not implemented")
}

func ParseArgs[T any](args json.RawMessage) (T, error) {
	var result T
	if len(args) == 0 {
		return result, nil
	}
	if err := json.Unmarshal(args, &result); err != nil {
		return result, fmt.Errorf("failed to parse arguments: %w", err)
	}
	return result, nil
}

func MustParseArgs[T any](args json.RawMessage) T {
	result, err := ParseArgs[T](args)
	if err != nil {
		panic(err)
	}
	return result
}

func ParseConfig[T any](config json.RawMessage) (T, error) {
	return ParseArgs[T](config)
}

func NewToolDef(name, description string, properties map[string]any, required []string) ToolDefinition {
	schema := map[string]any{
		"type":       "object",
		"properties": properties,
	}
	if len(required) > 0 {
		schema["required"] = required
	}
	return ToolDefinition{
		Name:        name,
		Description: description,
		InputSchema: schema,
	}
}

func StringProperty(description string) map[string]any {
	return map[string]any{
		"type":        "string",
		"description": description,
	}
}

func StringPropertyWithEnum(description string, enum []string) map[string]any {
	return map[string]any{
		"type":        "string",
		"description": description,
		"enum":        enum,
	}
}

func StringPropertyWithDefault(description, defaultVal string) map[string]any {
	return map[string]any{
		"type":        "string",
		"description": description,
		"default":     defaultVal,
	}
}

func IntProperty(description string) map[string]any {
	return map[string]any{
		"type":        "integer",
		"description": description,
	}
}

func IntPropertyWithRange(description string, min, max int) map[string]any {
	return map[string]any{
		"type":        "integer",
		"description": description,
		"minimum":     min,
		"maximum":     max,
	}
}

func NumberProperty(description string) map[string]any {
	return map[string]any{
		"type":        "number",
		"description": description,
	}
}

func NumberPropertyWithRange(description string, min, max float64) map[string]any {
	return map[string]any{
		"type":        "number",
		"description": description,
		"minimum":     min,
		"maximum":     max,
	}
}

func BoolProperty(description string) map[string]any {
	return map[string]any{
		"type":        "boolean",
		"description": description,
	}
}

func BoolPropertyWithDefault(description string, defaultVal bool) map[string]any {
	return map[string]any{
		"type":        "boolean",
		"description": description,
		"default":     defaultVal,
	}
}

func ArrayProperty(description string, itemType string) map[string]any {
	return map[string]any{
		"type":        "array",
		"description": description,
		"items":       map[string]any{"type": itemType},
	}
}

func ArrayPropertyWithItems(description string, items map[string]any) map[string]any {
	return map[string]any{
		"type":        "array",
		"description": description,
		"items":       items,
	}
}

func ObjectProperty(description string, properties map[string]any) map[string]any {
	return map[string]any{
		"type":        "object",
		"description": description,
		"properties":  properties,
	}
}

func RefProperty(ref string) map[string]any {
	return map[string]any{
		"$ref": ref,
	}
}

func OneOfProperty(options ...map[string]any) map[string]any {
	return map[string]any{
		"oneOf": options,
	}
}

func AnyOfProperty(options ...map[string]any) map[string]any {
	return map[string]any{
		"anyOf": options,
	}
}

func DefaultThemeColors() ThemeColors {
	return ThemeColors{
		Primary:    "#7C3AED",
		Secondary:  "#06B6D4",
		Background: "#1E1E2E",
		Foreground: "#CDD6F4",
		Accent:     "#F5C2E7",
		Error:      "#F38BA8",
		Warning:    "#FAB387",
		Success:    "#A6E3A1",
	}
}

func LightThemeColors() ThemeColors {
	return ThemeColors{
		Primary:    "#7C3AED",
		Secondary:  "#0891B2",
		Background: "#FFFFFF",
		Foreground: "#1F2937",
		Accent:     "#EC4899",
		Error:      "#DC2626",
		Warning:    "#F59E0B",
		Success:    "#10B981",
	}
}

func MonokaiThemeColors() ThemeColors {
	return ThemeColors{
		Primary:    "#F92672",
		Secondary:  "#66D9EF",
		Background: "#272822",
		Foreground: "#F8F8F2",
		Accent:     "#A6E22E",
		Error:      "#F92672",
		Warning:    "#E6DB74",
		Success:    "#A6E22E",
	}
}

func NordThemeColors() ThemeColors {
	return ThemeColors{
		Primary:    "#88C0D0",
		Secondary:  "#81A1C1",
		Background: "#2E3440",
		Foreground: "#ECEFF4",
		Accent:     "#B48EAD",
		Error:      "#BF616A",
		Warning:    "#EBCB8B",
		Success:    "#A3BE8C",
	}
}

type PluginBuilder struct {
	info        PluginInfo
	initFunc    func(ctx context.Context, config json.RawMessage) error
	startFunc   func(ctx context.Context) error
	stopFunc    func(ctx context.Context) error
	cleanupFunc func() error
	tools       []struct {
		def     ToolDefinition
		handler ToolHandler
	}
	executeFunc func(ctx context.Context, input string) (string, error)
	streamFunc  func(ctx context.Context, input string, output chan<- string) error
}

func NewPluginBuilder(name, version string) *PluginBuilder {
	return &PluginBuilder{
		info: PluginInfo{
			Name:    name,
			Version: version,
		},
	}
}

func (b *PluginBuilder) WithDescription(desc string) *PluginBuilder {
	b.info.Description = desc
	return b
}

func (b *PluginBuilder) WithAuthor(author string) *PluginBuilder {
	b.info.Author = author
	return b
}

func (b *PluginBuilder) WithHomepage(homepage string) *PluginBuilder {
	b.info.Homepage = homepage
	return b
}

func (b *PluginBuilder) WithType(pluginType PluginType) *PluginBuilder {
	b.info.Type = pluginType
	return b
}

func (b *PluginBuilder) WithInit(fn func(ctx context.Context, config json.RawMessage) error) *PluginBuilder {
	b.initFunc = fn
	return b
}

func (b *PluginBuilder) WithStart(fn func(ctx context.Context) error) *PluginBuilder {
	b.startFunc = fn
	return b
}

func (b *PluginBuilder) WithStop(fn func(ctx context.Context) error) *PluginBuilder {
	b.stopFunc = fn
	return b
}

func (b *PluginBuilder) WithCleanup(fn func() error) *PluginBuilder {
	b.cleanupFunc = fn
	return b
}

func (b *PluginBuilder) WithTool(def ToolDefinition, handler ToolHandler) *PluginBuilder {
	b.tools = append(b.tools, struct {
		def     ToolDefinition
		handler ToolHandler
	}{def, handler})
	return b
}

func (b *PluginBuilder) WithExecute(fn func(ctx context.Context, input string) (string, error)) *PluginBuilder {
	b.executeFunc = fn
	return b
}

func (b *PluginBuilder) WithStream(fn func(ctx context.Context, input string, output chan<- string) error) *PluginBuilder {
	b.streamFunc = fn
	return b
}

func (b *PluginBuilder) BuildTool() *BaseToolPlugin {
	b.info.Type = PluginTypeTool
	plugin := NewBaseToolPlugin(b.info)
	for _, t := range b.tools {
		plugin.RegisterTool(t.def, t.handler)
	}
	return plugin
}

func (b *PluginBuilder) BuildAgent() *BaseAgentPlugin {
	b.info.Type = PluginTypeAgent
	plugin := NewBaseAgentPlugin(b.info)
	plugin.ExecuteFunc = b.executeFunc
	plugin.StreamFunc = b.streamFunc
	return plugin
}

func (b *PluginBuilder) BuildTheme(colors ThemeColors) *BaseThemePlugin {
	b.info.Type = PluginTypeTheme
	return NewBaseThemePlugin(b.info, colors)
}

func LoggingMiddleware(logger Logger) ToolMiddleware {
	return func(ctx context.Context, name string, args json.RawMessage, next ToolHandler) (any, error) {
		start := time.Now()
		logger.Debug("executing tool", "name", name)
		result, err := next(ctx, args)
		duration := time.Since(start)
		if err != nil {
			logger.Error("tool failed", "name", name, "error", err, "duration", duration)
		} else {
			logger.Debug("tool completed", "name", name, "duration", duration)
		}
		return result, err
	}
}

func TimeoutMiddleware(timeout time.Duration) ToolMiddleware {
	return func(ctx context.Context, name string, args json.RawMessage, next ToolHandler) (any, error) {
		ctx, cancel := context.WithTimeout(ctx, timeout)
		defer cancel()
		return next(ctx, args)
	}
}

func RetryMiddleware(maxRetries int, delay time.Duration) ToolMiddleware {
	return func(ctx context.Context, name string, args json.RawMessage, next ToolHandler) (any, error) {
		var lastErr error
		for i := 0; i <= maxRetries; i++ {
			result, err := next(ctx, args)
			if err == nil {
				return result, nil
			}
			lastErr = err
			if i < maxRetries {
				select {
				case <-ctx.Done():
					return nil, ctx.Err()
				case <-time.After(delay):
				}
			}
		}
		return nil, fmt.Errorf("max retries exceeded: %w", lastErr)
	}
}

func ValidationMiddleware(validator func(name string, args json.RawMessage) error) ToolMiddleware {
	return func(ctx context.Context, name string, args json.RawMessage, next ToolHandler) (any, error) {
		if err := validator(name, args); err != nil {
			return nil, fmt.Errorf("validation failed: %w", err)
		}
		return next(ctx, args)
	}
}
