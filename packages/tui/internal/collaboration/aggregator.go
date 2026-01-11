package collaboration

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"sync"
)

type Aggregator struct {
	strategy AggregationStrategy
	results  []*ResultPayload
	mu       sync.RWMutex
}

type AggregationStrategy string

const (
	StrategyFirst     AggregationStrategy = "first"
	StrategyAll       AggregationStrategy = "all"
	StrategyMajority  AggregationStrategy = "majority"
	StrategyBest      AggregationStrategy = "best"
	StrategyMerge     AggregationStrategy = "merge"
	StrategyConsensus AggregationStrategy = "consensus"
)

func NewAggregator(strategy AggregationStrategy) *Aggregator {
	return &Aggregator{
		strategy: strategy,
		results:  make([]*ResultPayload, 0),
	}
}

func (a *Aggregator) Add(result *ResultPayload) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.results = append(a.results, result)
}

func (a *Aggregator) AddAll(results []*ResultPayload) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.results = append(a.results, results...)
}

func (a *Aggregator) Clear() {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.results = make([]*ResultPayload, 0)
}

func (a *Aggregator) Count() int {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return len(a.results)
}

func (a *Aggregator) Aggregate() (*AggregatedResult, error) {
	a.mu.RLock()
	defer a.mu.RUnlock()

	if len(a.results) == 0 {
		return nil, fmt.Errorf("no results to aggregate")
	}

	switch a.strategy {
	case StrategyFirst:
		return a.aggregateFirst()
	case StrategyAll:
		return a.aggregateAll()
	case StrategyMajority:
		return a.aggregateMajority()
	case StrategyBest:
		return a.aggregateBest()
	case StrategyMerge:
		return a.aggregateMerge()
	case StrategyConsensus:
		return a.aggregateConsensus()
	default:
		return a.aggregateFirst()
	}
}

type AggregatedResult struct {
	Strategy     AggregationStrategy    `json:"strategy"`
	TotalResults int                    `json:"total_results"`
	Successful   int                    `json:"successful"`
	Failed       int                    `json:"failed"`
	Output       interface{}            `json:"output"`
	Confidence   float64                `json:"confidence"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

func (a *Aggregator) aggregateFirst() (*AggregatedResult, error) {
	for _, r := range a.results {
		if r.Success {
			return &AggregatedResult{
				Strategy:     StrategyFirst,
				TotalResults: len(a.results),
				Successful:   a.countSuccessful(),
				Failed:       a.countFailed(),
				Output:       r.Output,
				Confidence:   1.0,
			}, nil
		}
	}

	return &AggregatedResult{
		Strategy:     StrategyFirst,
		TotalResults: len(a.results),
		Successful:   0,
		Failed:       len(a.results),
		Output:       a.results[0].Error,
		Confidence:   0.0,
	}, nil
}

func (a *Aggregator) aggregateAll() (*AggregatedResult, error) {
	outputs := make([]interface{}, 0)
	for _, r := range a.results {
		if r.Success {
			outputs = append(outputs, r.Output)
		}
	}

	successful := a.countSuccessful()
	confidence := float64(successful) / float64(len(a.results))

	return &AggregatedResult{
		Strategy:     StrategyAll,
		TotalResults: len(a.results),
		Successful:   successful,
		Failed:       a.countFailed(),
		Output:       outputs,
		Confidence:   confidence,
	}, nil
}

func (a *Aggregator) aggregateMajority() (*AggregatedResult, error) {
	votes := make(map[string]int)
	outputMap := make(map[string]interface{})

	for _, r := range a.results {
		if !r.Success {
			continue
		}
		key := a.normalizeOutput(r.Output)
		votes[key]++
		outputMap[key] = r.Output
	}

	var maxVotes int
	var winningKey string
	for key, count := range votes {
		if count > maxVotes {
			maxVotes = count
			winningKey = key
		}
	}

	if winningKey == "" {
		return nil, fmt.Errorf("no successful results for majority vote")
	}

	confidence := float64(maxVotes) / float64(len(a.results))

	return &AggregatedResult{
		Strategy:     StrategyMajority,
		TotalResults: len(a.results),
		Successful:   a.countSuccessful(),
		Failed:       a.countFailed(),
		Output:       outputMap[winningKey],
		Confidence:   confidence,
		Metadata: map[string]interface{}{
			"votes":         votes,
			"winning_votes": maxVotes,
		},
	}, nil
}

func (a *Aggregator) aggregateBest() (*AggregatedResult, error) {
	var best *ResultPayload
	var bestScore float64 = -1

	for _, r := range a.results {
		if !r.Success {
			continue
		}
		score := a.scoreResult(r)
		if score > bestScore {
			bestScore = score
			best = r
		}
	}

	if best == nil {
		return nil, fmt.Errorf("no successful results to select best from")
	}

	return &AggregatedResult{
		Strategy:     StrategyBest,
		TotalResults: len(a.results),
		Successful:   a.countSuccessful(),
		Failed:       a.countFailed(),
		Output:       best.Output,
		Confidence:   bestScore,
		Metadata: map[string]interface{}{
			"best_task_id": best.TaskID,
			"duration_ms":  best.Metrics.Duration.Milliseconds(),
		},
	}, nil
}

func (a *Aggregator) aggregateMerge() (*AggregatedResult, error) {
	merged := make(map[string]interface{})

	for _, r := range a.results {
		if !r.Success {
			continue
		}

		switch v := r.Output.(type) {
		case map[string]interface{}:
			for key, val := range v {
				merged[key] = val
			}
		case string:
			if existing, ok := merged["text"].(string); ok {
				merged["text"] = existing + "\n---\n" + v
			} else {
				merged["text"] = v
			}
		default:
			merged[r.TaskID] = v
		}
	}

	successful := a.countSuccessful()
	confidence := float64(successful) / float64(len(a.results))

	return &AggregatedResult{
		Strategy:     StrategyMerge,
		TotalResults: len(a.results),
		Successful:   successful,
		Failed:       a.countFailed(),
		Output:       merged,
		Confidence:   confidence,
	}, nil
}

func (a *Aggregator) aggregateConsensus() (*AggregatedResult, error) {
	if len(a.results) < 3 {
		return a.aggregateMajority()
	}

	votes := make(map[string]int)
	outputMap := make(map[string]interface{})

	for _, r := range a.results {
		if !r.Success {
			continue
		}
		key := a.normalizeOutput(r.Output)
		votes[key]++
		outputMap[key] = r.Output
	}

	type votePair struct {
		key   string
		count int
	}
	var pairs []votePair
	for k, v := range votes {
		pairs = append(pairs, votePair{k, v})
	}
	sort.Slice(pairs, func(i, j int) bool {
		return pairs[i].count > pairs[j].count
	})

	threshold := float64(len(a.results)) * 0.5
	if len(pairs) > 0 && float64(pairs[0].count) >= threshold {
		confidence := float64(pairs[0].count) / float64(len(a.results))
		return &AggregatedResult{
			Strategy:     StrategyConsensus,
			TotalResults: len(a.results),
			Successful:   a.countSuccessful(),
			Failed:       a.countFailed(),
			Output:       outputMap[pairs[0].key],
			Confidence:   confidence,
			Metadata: map[string]interface{}{
				"consensus_reached": true,
				"vote_distribution": votes,
			},
		}, nil
	}

	return &AggregatedResult{
		Strategy:     StrategyConsensus,
		TotalResults: len(a.results),
		Successful:   a.countSuccessful(),
		Failed:       a.countFailed(),
		Output:       nil,
		Confidence:   0.0,
		Metadata: map[string]interface{}{
			"consensus_reached": false,
			"vote_distribution": votes,
		},
	}, nil
}

func (a *Aggregator) countSuccessful() int {
	count := 0
	for _, r := range a.results {
		if r.Success {
			count++
		}
	}
	return count
}

func (a *Aggregator) countFailed() int {
	count := 0
	for _, r := range a.results {
		if !r.Success {
			count++
		}
	}
	return count
}

func (a *Aggregator) normalizeOutput(output interface{}) string {
	switch v := output.(type) {
	case string:
		return strings.TrimSpace(strings.ToLower(v))
	default:
		b, _ := json.Marshal(v)
		return string(b)
	}
}

func (a *Aggregator) scoreResult(r *ResultPayload) float64 {
	score := 1.0

	if r.Metrics.Duration > 0 {
		durationScore := 1.0 / (1.0 + float64(r.Metrics.Duration.Seconds())/10.0)
		score *= (0.7 + 0.3*durationScore)
	}

	if r.Metrics.TokensUsed > 0 {
		tokenScore := 1.0 / (1.0 + float64(r.Metrics.TokensUsed)/1000.0)
		score *= (0.8 + 0.2*tokenScore)
	}

	if str, ok := r.Output.(string); ok {
		if len(str) > 50 && len(str) < 5000 {
			score *= 1.1
		}
	}

	return score
}

func AggregateResults(results []*ResultPayload, strategy AggregationStrategy) (*AggregatedResult, error) {
	agg := NewAggregator(strategy)
	agg.AddAll(results)
	return agg.Aggregate()
}
