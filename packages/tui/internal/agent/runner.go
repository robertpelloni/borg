package agent

import (
	"bufio"
	"context"
	"io"
	"os/exec"
	"sync"
)

type Agent struct {
	Name    string
	Command string
	Args    []string
	Dir     string
}

type Runner struct {
	agents map[string]*Agent
	mu     sync.RWMutex
}

func NewRunner() *Runner {
	return &Runner{
		agents: make(map[string]*Agent),
	}
}

func (r *Runner) AddAgent(a *Agent) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.agents[a.Name] = a
}

// StreamOutput starts an agent and sends its output line by line to the provided channel.
func (r *Runner) StreamOutput(ctx context.Context, agentName string, outputChan chan<- string) error {
	r.mu.RLock()
	agent, ok := r.agents[agentName]
	r.mu.RUnlock()

	if !ok {
		return io.EOF
	}

	cmd := exec.CommandContext(ctx, agent.Command, agent.Args...)
	cmd.Dir = agent.Dir

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return err
	}

	if err := cmd.Start(); err != nil {
		return err
	}

	var wg sync.WaitGroup
	wg.Add(2)

	scannerFunc := func(r io.Reader) {
		defer wg.Done()
		scanner := bufio.NewScanner(r)
		for scanner.Scan() {
			select {
			case <-ctx.Done():
				return
			case outputChan <- scanner.Text():
			}
		}
	}

	go scannerFunc(stdout)
	go scannerFunc(stderr)

	go func() {
		wg.Wait()
		cmd.Wait()
	}()

	return nil
}
