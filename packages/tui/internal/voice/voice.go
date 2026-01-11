package voice

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
)

type ProviderType string

const (
	ProviderWhisper    ProviderType = "whisper"
	ProviderWhisperAPI ProviderType = "whisper_api"
	ProviderGoogle     ProviderType = "google"
	ProviderAzure      ProviderType = "azure"
	ProviderLocal      ProviderType = "local"
)

type VoiceState string

const (
	StateIdle       VoiceState = "idle"
	StateListening  VoiceState = "listening"
	StateProcessing VoiceState = "processing"
	StateError      VoiceState = "error"
)

type TranscriptionResult struct {
	Text       string        `json:"text"`
	Language   string        `json:"language"`
	Duration   time.Duration `json:"duration"`
	Confidence float64       `json:"confidence"`
	Segments   []Segment     `json:"segments,omitempty"`
	Error      error         `json:"-"`
}

type Segment struct {
	Start float64 `json:"start"`
	End   float64 `json:"end"`
	Text  string  `json:"text"`
}

type VoiceConfig struct {
	Provider    ProviderType `json:"provider" yaml:"provider"`
	APIKey      string       `json:"api_key" yaml:"api_key"`
	APIKeyEnv   string       `json:"api_key_env" yaml:"api_key_env"`
	Model       string       `json:"model" yaml:"model"`
	Language    string       `json:"language" yaml:"language"`
	Endpoint    string       `json:"endpoint" yaml:"endpoint"`
	SampleRate  int          `json:"sample_rate" yaml:"sample_rate"`
	Channels    int          `json:"channels" yaml:"channels"`
	MaxDuration int          `json:"max_duration" yaml:"max_duration"`
}

type RecordingOptions struct {
	Duration   time.Duration
	SampleRate int
	Channels   int
	OutputPath string
}

type VoiceInput struct {
	config     *VoiceConfig
	state      VoiceState
	recording  bool
	audioData  []byte
	tempDir    string
	httpClient *http.Client
	mu         sync.RWMutex
	cancel     context.CancelFunc
	onText     func(text string)
	onError    func(err error)
	onState    func(state VoiceState)
}

func NewVoiceInput(cfg *VoiceConfig) *VoiceInput {
	if cfg == nil {
		cfg = DefaultConfig()
	}

	if cfg.APIKey == "" && cfg.APIKeyEnv != "" {
		cfg.APIKey = os.Getenv(cfg.APIKeyEnv)
	}

	homeDir, _ := os.UserHomeDir()
	tempDir := filepath.Join(homeDir, ".superai", "voice", "temp")
	os.MkdirAll(tempDir, 0755)

	return &VoiceInput{
		config:  cfg,
		state:   StateIdle,
		tempDir: tempDir,
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

func DefaultConfig() *VoiceConfig {
	return &VoiceConfig{
		Provider:    ProviderWhisperAPI,
		Model:       "whisper-1",
		Language:    "en",
		SampleRate:  16000,
		Channels:    1,
		MaxDuration: 30,
	}
}

func (v *VoiceInput) SetCallbacks(onText func(string), onError func(error), onState func(VoiceState)) {
	v.mu.Lock()
	defer v.mu.Unlock()
	v.onText = onText
	v.onError = onError
	v.onState = onState
}

func (v *VoiceInput) setState(state VoiceState) {
	v.mu.Lock()
	v.state = state
	callback := v.onState
	v.mu.Unlock()

	if callback != nil {
		callback(state)
	}
}

func (v *VoiceInput) GetState() VoiceState {
	v.mu.RLock()
	defer v.mu.RUnlock()
	return v.state
}

func (v *VoiceInput) IsListening() bool {
	return v.GetState() == StateListening
}

func (v *VoiceInput) StartListening(ctx context.Context) error {
	v.mu.Lock()
	if v.recording {
		v.mu.Unlock()
		return fmt.Errorf("already recording")
	}
	v.recording = true
	v.audioData = nil

	listenCtx, cancel := context.WithCancel(ctx)
	v.cancel = cancel
	v.mu.Unlock()

	v.setState(StateListening)

	go v.recordAudio(listenCtx)
	return nil
}

func (v *VoiceInput) StopListening() (*TranscriptionResult, error) {
	v.mu.Lock()
	if !v.recording {
		v.mu.Unlock()
		return nil, fmt.Errorf("not recording")
	}

	if v.cancel != nil {
		v.cancel()
	}
	v.recording = false
	audioData := v.audioData
	v.mu.Unlock()

	v.setState(StateProcessing)

	if len(audioData) == 0 {
		v.setState(StateIdle)
		return &TranscriptionResult{Text: ""}, nil
	}

	result, err := v.transcribe(audioData)
	v.setState(StateIdle)

	if err != nil {
		if v.onError != nil {
			v.onError(err)
		}
		return nil, err
	}

	if v.onText != nil && result.Text != "" {
		v.onText(result.Text)
	}

	return result, nil
}

func (v *VoiceInput) Cancel() {
	v.mu.Lock()
	if v.cancel != nil {
		v.cancel()
	}
	v.recording = false
	v.audioData = nil
	v.mu.Unlock()

	v.setState(StateIdle)
}

func (v *VoiceInput) recordAudio(ctx context.Context) {
	outputPath := filepath.Join(v.tempDir, fmt.Sprintf("recording_%d.wav", time.Now().UnixNano()))

	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.CommandContext(ctx, "rec",
			"-q",
			"-r", fmt.Sprintf("%d", v.config.SampleRate),
			"-c", fmt.Sprintf("%d", v.config.Channels),
			"-b", "16",
			outputPath,
			"trim", "0", fmt.Sprintf("%d", v.config.MaxDuration))
	case "linux":
		cmd = exec.CommandContext(ctx, "arecord",
			"-q",
			"-f", "S16_LE",
			"-r", fmt.Sprintf("%d", v.config.SampleRate),
			"-c", fmt.Sprintf("%d", v.config.Channels),
			"-d", fmt.Sprintf("%d", v.config.MaxDuration),
			outputPath)
	case "windows":
		cmd = exec.CommandContext(ctx, "powershell", "-Command",
			fmt.Sprintf(`Add-Type -AssemblyName System.Speech; $r = New-Object System.Speech.Recognition.SpeechRecognitionEngine; $r.SetInputToDefaultAudioDevice(); $r.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar)); $result = $r.Recognize((New-Object TimeSpan(0,0,%d))); if($result){$result.Text}`, v.config.MaxDuration))
	default:
		v.mu.Lock()
		v.audioData = nil
		v.mu.Unlock()
		return
	}

	if runtime.GOOS == "windows" {
		output, _ := cmd.Output()
		if len(output) > 0 {
			v.mu.Lock()
			v.audioData = output
			v.mu.Unlock()
		}
		return
	}

	if err := cmd.Run(); err != nil && ctx.Err() == nil {
		return
	}

	data, err := os.ReadFile(outputPath)
	if err == nil {
		v.mu.Lock()
		v.audioData = data
		v.mu.Unlock()
	}

	os.Remove(outputPath)
}

func (v *VoiceInput) transcribe(audioData []byte) (*TranscriptionResult, error) {
	switch v.config.Provider {
	case ProviderWhisperAPI:
		return v.transcribeWhisperAPI(audioData)
	case ProviderWhisper:
		return v.transcribeWhisperLocal(audioData)
	case ProviderGoogle:
		return v.transcribeGoogle(audioData)
	case ProviderAzure:
		return v.transcribeAzure(audioData)
	case ProviderLocal:
		return v.transcribeLocal(audioData)
	default:
		return nil, fmt.Errorf("unsupported provider: %s", v.config.Provider)
	}
}

func (v *VoiceInput) transcribeWhisperAPI(audioData []byte) (*TranscriptionResult, error) {
	if v.config.APIKey == "" {
		return nil, fmt.Errorf("OpenAI API key not configured")
	}

	tempFile := filepath.Join(v.tempDir, fmt.Sprintf("audio_%d.wav", time.Now().UnixNano()))
	if err := os.WriteFile(tempFile, audioData, 0644); err != nil {
		return nil, err
	}
	defer os.Remove(tempFile)

	file, err := os.Open(tempFile)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var buf bytes.Buffer
	writer := NewMultipartWriter(&buf)

	part, _ := writer.CreateFormFile("file", "audio.wav")
	io.Copy(part, file)

	writer.WriteField("model", v.config.Model)
	if v.config.Language != "" {
		writer.WriteField("language", v.config.Language)
	}
	writer.WriteField("response_format", "verbose_json")

	writer.Close()

	endpoint := "https://api.openai.com/v1/audio/transcriptions"
	if v.config.Endpoint != "" {
		endpoint = v.config.Endpoint
	}

	req, err := http.NewRequest("POST", endpoint, &buf)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+v.config.APIKey)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := v.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API error: %s - %s", resp.Status, string(body))
	}

	var response struct {
		Text     string  `json:"text"`
		Language string  `json:"language"`
		Duration float64 `json:"duration"`
		Segments []struct {
			Start float64 `json:"start"`
			End   float64 `json:"end"`
			Text  string  `json:"text"`
		} `json:"segments"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, err
	}

	result := &TranscriptionResult{
		Text:     strings.TrimSpace(response.Text),
		Language: response.Language,
		Duration: time.Duration(response.Duration * float64(time.Second)),
	}

	for _, seg := range response.Segments {
		result.Segments = append(result.Segments, Segment{
			Start: seg.Start,
			End:   seg.End,
			Text:  seg.Text,
		})
	}

	return result, nil
}

func (v *VoiceInput) transcribeWhisperLocal(audioData []byte) (*TranscriptionResult, error) {
	whisperPath := "whisper"
	if p := os.Getenv("WHISPER_PATH"); p != "" {
		whisperPath = p
	}

	tempFile := filepath.Join(v.tempDir, fmt.Sprintf("audio_%d.wav", time.Now().UnixNano()))
	if err := os.WriteFile(tempFile, audioData, 0644); err != nil {
		return nil, err
	}
	defer os.Remove(tempFile)

	args := []string{
		tempFile,
		"--model", v.config.Model,
		"--output_format", "json",
		"--output_dir", v.tempDir,
	}
	if v.config.Language != "" {
		args = append(args, "--language", v.config.Language)
	}

	cmd := exec.Command(whisperPath, args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("whisper error: %v - %s", err, string(output))
	}

	jsonFile := strings.TrimSuffix(tempFile, ".wav") + ".json"
	defer os.Remove(jsonFile)

	jsonData, err := os.ReadFile(jsonFile)
	if err != nil {
		return &TranscriptionResult{Text: strings.TrimSpace(string(output))}, nil
	}

	var response struct {
		Text     string `json:"text"`
		Segments []struct {
			Start float64 `json:"start"`
			End   float64 `json:"end"`
			Text  string  `json:"text"`
		} `json:"segments"`
	}

	if err := json.Unmarshal(jsonData, &response); err != nil {
		return nil, err
	}

	result := &TranscriptionResult{
		Text:     strings.TrimSpace(response.Text),
		Language: v.config.Language,
	}

	for _, seg := range response.Segments {
		result.Segments = append(result.Segments, Segment{
			Start: seg.Start,
			End:   seg.End,
			Text:  seg.Text,
		})
	}

	return result, nil
}

func (v *VoiceInput) transcribeGoogle(audioData []byte) (*TranscriptionResult, error) {
	if v.config.APIKey == "" {
		return nil, fmt.Errorf("Google API key not configured")
	}

	encoded := base64.StdEncoding.EncodeToString(audioData)

	requestBody := map[string]interface{}{
		"config": map[string]interface{}{
			"encoding":        "LINEAR16",
			"sampleRateHertz": v.config.SampleRate,
			"languageCode":    v.config.Language,
		},
		"audio": map[string]string{
			"content": encoded,
		},
	}

	body, _ := json.Marshal(requestBody)

	endpoint := fmt.Sprintf("https://speech.googleapis.com/v1/speech:recognize?key=%s", v.config.APIKey)

	resp, err := v.httpClient.Post(endpoint, "application/json", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Google API error: %s - %s", resp.Status, string(body))
	}

	var response struct {
		Results []struct {
			Alternatives []struct {
				Transcript string  `json:"transcript"`
				Confidence float64 `json:"confidence"`
			} `json:"alternatives"`
		} `json:"results"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, err
	}

	var text string
	var confidence float64
	for _, result := range response.Results {
		if len(result.Alternatives) > 0 {
			text += result.Alternatives[0].Transcript + " "
			confidence = result.Alternatives[0].Confidence
		}
	}

	return &TranscriptionResult{
		Text:       strings.TrimSpace(text),
		Language:   v.config.Language,
		Confidence: confidence,
	}, nil
}

func (v *VoiceInput) transcribeAzure(audioData []byte) (*TranscriptionResult, error) {
	if v.config.APIKey == "" {
		return nil, fmt.Errorf("Azure API key not configured")
	}

	endpoint := v.config.Endpoint
	if endpoint == "" {
		return nil, fmt.Errorf("Azure endpoint not configured")
	}

	url := fmt.Sprintf("%s/speech/recognition/conversation/cognitiveservices/v1?language=%s",
		endpoint, v.config.Language)

	req, err := http.NewRequest("POST", url, bytes.NewReader(audioData))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Ocp-Apim-Subscription-Key", v.config.APIKey)
	req.Header.Set("Content-Type", "audio/wav")

	resp, err := v.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Azure API error: %s - %s", resp.Status, string(body))
	}

	var response struct {
		DisplayText string `json:"DisplayText"`
		Duration    int64  `json:"Duration"`
		Offset      int64  `json:"Offset"`
		NBest       []struct {
			Confidence float64 `json:"Confidence"`
			Display    string  `json:"Display"`
		} `json:"NBest"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, err
	}

	result := &TranscriptionResult{
		Text:     response.DisplayText,
		Language: v.config.Language,
		Duration: time.Duration(response.Duration) * 100 * time.Nanosecond,
	}

	if len(response.NBest) > 0 {
		result.Confidence = response.NBest[0].Confidence
	}

	return result, nil
}

func (v *VoiceInput) transcribeLocal(audioData []byte) (*TranscriptionResult, error) {
	if runtime.GOOS == "windows" {
		return &TranscriptionResult{
			Text:     string(audioData),
			Language: v.config.Language,
		}, nil
	}

	return nil, fmt.Errorf("local transcription not supported on %s", runtime.GOOS)
}

func (v *VoiceInput) TranscribeFile(filePath string) (*TranscriptionResult, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	v.setState(StateProcessing)
	defer v.setState(StateIdle)

	return v.transcribe(data)
}

func (v *VoiceInput) IsAvailable() bool {
	switch runtime.GOOS {
	case "darwin":
		_, err := exec.LookPath("rec")
		return err == nil
	case "linux":
		_, err := exec.LookPath("arecord")
		return err == nil
	case "windows":
		return true
	default:
		return false
	}
}

func (v *VoiceInput) GetSupportedLanguages() []string {
	return []string{
		"en", "es", "fr", "de", "it", "pt", "ru", "ja", "ko", "zh",
		"ar", "hi", "nl", "pl", "tr", "vi", "th", "id", "ms", "fil",
	}
}

func (v *VoiceInput) Cleanup() error {
	entries, err := os.ReadDir(v.tempDir)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		os.Remove(filepath.Join(v.tempDir, entry.Name()))
	}

	return nil
}

type MultipartWriter struct {
	*bytes.Buffer
	boundary string
}

func NewMultipartWriter(buf *bytes.Buffer) *MultipartWriter {
	return &MultipartWriter{
		Buffer:   buf,
		boundary: fmt.Sprintf("----SuperAI%d", time.Now().UnixNano()),
	}
}

func (w *MultipartWriter) CreateFormFile(fieldname, filename string) (io.Writer, error) {
	w.WriteString(fmt.Sprintf("--%s\r\n", w.boundary))
	w.WriteString(fmt.Sprintf(`Content-Disposition: form-data; name="%s"; filename="%s"`, fieldname, filename))
	w.WriteString("\r\n")
	w.WriteString("Content-Type: application/octet-stream\r\n\r\n")
	return w, nil
}

func (w *MultipartWriter) WriteField(fieldname, value string) error {
	w.WriteString(fmt.Sprintf("--%s\r\n", w.boundary))
	w.WriteString(fmt.Sprintf(`Content-Disposition: form-data; name="%s"`, fieldname))
	w.WriteString("\r\n\r\n")
	w.WriteString(value)
	w.WriteString("\r\n")
	return nil
}

func (w *MultipartWriter) Close() error {
	w.WriteString(fmt.Sprintf("--%s--\r\n", w.boundary))
	return nil
}

func (w *MultipartWriter) FormDataContentType() string {
	return "multipart/form-data; boundary=" + w.boundary
}
