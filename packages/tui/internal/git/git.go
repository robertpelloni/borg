package git

import (
	"bufio"
	"bytes"
	"fmt"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type FileStatus struct {
	Path       string
	Status     string
	Staged     bool
	StatusCode string
}

type CommitInfo struct {
	Hash      string
	ShortHash string
	Author    string
	Email     string
	Date      time.Time
	Message   string
}

type BranchInfo struct {
	Name     string
	Current  bool
	Remote   string
	Upstream string
	Ahead    int
	Behind   int
}

type RepoStatus struct {
	IsRepo       bool
	Root         string
	Branch       string
	Upstream     string
	Ahead        int
	Behind       int
	Staged       []FileStatus
	Unstaged     []FileStatus
	Untracked    []FileStatus
	HasConflicts bool
	LastCommit   *CommitInfo
}

type Client struct {
	workDir string
	mu      sync.RWMutex
}

func NewClient(workDir string) *Client {
	return &Client{workDir: workDir}
}

func (c *Client) SetWorkDir(workDir string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.workDir = workDir
}

func (c *Client) WorkDir() string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.workDir
}

func (c *Client) run(args ...string) (string, error) {
	c.mu.RLock()
	workDir := c.workDir
	c.mu.RUnlock()

	cmd := exec.Command("git", args...)
	cmd.Dir = workDir

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	if err != nil {
		return "", fmt.Errorf("%s: %s", err, stderr.String())
	}
	return strings.TrimSpace(stdout.String()), nil
}

func (c *Client) IsRepo() bool {
	_, err := c.run("rev-parse", "--is-inside-work-tree")
	return err == nil
}

func (c *Client) Root() (string, error) {
	return c.run("rev-parse", "--show-toplevel")
}

func (c *Client) CurrentBranch() (string, error) {
	return c.run("rev-parse", "--abbrev-ref", "HEAD")
}

func (c *Client) Status() (*RepoStatus, error) {
	if !c.IsRepo() {
		return &RepoStatus{IsRepo: false}, nil
	}

	status := &RepoStatus{IsRepo: true}

	if root, err := c.Root(); err == nil {
		status.Root = root
	}

	if branch, err := c.CurrentBranch(); err == nil {
		status.Branch = branch
	}

	if upstream, err := c.run("rev-parse", "--abbrev-ref", "@{upstream}"); err == nil {
		status.Upstream = upstream
		if ahead, err := c.run("rev-list", "--count", "@{upstream}..HEAD"); err == nil {
			fmt.Sscanf(ahead, "%d", &status.Ahead)
		}
		if behind, err := c.run("rev-list", "--count", "HEAD..@{upstream}"); err == nil {
			fmt.Sscanf(behind, "%d", &status.Behind)
		}
	}

	porcelain, err := c.run("status", "--porcelain=v1")
	if err == nil && porcelain != "" {
		scanner := bufio.NewScanner(strings.NewReader(porcelain))
		for scanner.Scan() {
			line := scanner.Text()
			if len(line) < 4 {
				continue
			}

			indexStatus := line[0]
			workTreeStatus := line[1]
			path := strings.TrimSpace(line[3:])

			if strings.Contains(path, " -> ") {
				parts := strings.Split(path, " -> ")
				path = parts[len(parts)-1]
			}

			fs := FileStatus{
				Path:       path,
				StatusCode: string([]byte{indexStatus, workTreeStatus}),
			}

			switch indexStatus {
			case 'A':
				fs.Status = "added"
				fs.Staged = true
			case 'M':
				fs.Status = "modified"
				fs.Staged = true
			case 'D':
				fs.Status = "deleted"
				fs.Staged = true
			case 'R':
				fs.Status = "renamed"
				fs.Staged = true
			case 'C':
				fs.Status = "copied"
				fs.Staged = true
			case 'U':
				fs.Status = "unmerged"
				status.HasConflicts = true
			}

			if fs.Staged {
				status.Staged = append(status.Staged, fs)
			}

			switch workTreeStatus {
			case 'M':
				if !fs.Staged {
					fs.Status = "modified"
				}
				status.Unstaged = append(status.Unstaged, FileStatus{
					Path:       path,
					Status:     "modified",
					StatusCode: fs.StatusCode,
				})
			case 'D':
				if !fs.Staged {
					fs.Status = "deleted"
				}
				status.Unstaged = append(status.Unstaged, FileStatus{
					Path:       path,
					Status:     "deleted",
					StatusCode: fs.StatusCode,
				})
			case '?':
				status.Untracked = append(status.Untracked, FileStatus{
					Path:       path,
					Status:     "untracked",
					StatusCode: "??",
				})
			case 'U':
				status.HasConflicts = true
			}
		}
	}

	if commit, err := c.LastCommit(); err == nil {
		status.LastCommit = commit
	}

	return status, nil
}

func (c *Client) LastCommit() (*CommitInfo, error) {
	format := "%H%n%h%n%an%n%ae%n%at%n%s"
	out, err := c.run("log", "-1", fmt.Sprintf("--format=%s", format))
	if err != nil {
		return nil, err
	}

	lines := strings.Split(out, "\n")
	if len(lines) < 6 {
		return nil, fmt.Errorf("unexpected git log output")
	}

	var timestamp int64
	fmt.Sscanf(lines[4], "%d", &timestamp)

	return &CommitInfo{
		Hash:      lines[0],
		ShortHash: lines[1],
		Author:    lines[2],
		Email:     lines[3],
		Date:      time.Unix(timestamp, 0),
		Message:   lines[5],
	}, nil
}

func (c *Client) Diff(staged bool) (string, error) {
	if staged {
		return c.run("diff", "--cached", "--stat")
	}
	return c.run("diff", "--stat")
}

func (c *Client) DiffFull(staged bool, path string) (string, error) {
	args := []string{"diff"}
	if staged {
		args = append(args, "--cached")
	}
	if path != "" {
		args = append(args, "--", path)
	}
	return c.run(args...)
}

func (c *Client) Add(paths ...string) error {
	if len(paths) == 0 {
		paths = []string{"."}
	}
	args := append([]string{"add"}, paths...)
	_, err := c.run(args...)
	return err
}

func (c *Client) AddAll() error {
	_, err := c.run("add", "-A")
	return err
}

func (c *Client) Commit(message string) (*CommitInfo, error) {
	_, err := c.run("commit", "-m", message)
	if err != nil {
		return nil, err
	}
	return c.LastCommit()
}

func (c *Client) CommitAmend(message string) (*CommitInfo, error) {
	args := []string{"commit", "--amend"}
	if message != "" {
		args = append(args, "-m", message)
	} else {
		args = append(args, "--no-edit")
	}
	_, err := c.run(args...)
	if err != nil {
		return nil, err
	}
	return c.LastCommit()
}

func (c *Client) Push() error {
	_, err := c.run("push")
	return err
}

func (c *Client) PushSetUpstream(remote, branch string) error {
	_, err := c.run("push", "-u", remote, branch)
	return err
}

func (c *Client) Pull() error {
	_, err := c.run("pull")
	return err
}

func (c *Client) Fetch() error {
	_, err := c.run("fetch")
	return err
}

func (c *Client) Checkout(branch string) error {
	_, err := c.run("checkout", branch)
	return err
}

func (c *Client) CheckoutNew(branch string) error {
	_, err := c.run("checkout", "-b", branch)
	return err
}

func (c *Client) Branches() ([]BranchInfo, error) {
	out, err := c.run("branch", "-vv", "--format=%(refname:short)|%(upstream:short)|%(upstream:track)")
	if err != nil {
		return nil, err
	}

	currentBranch, _ := c.CurrentBranch()

	var branches []BranchInfo
	scanner := bufio.NewScanner(strings.NewReader(out))
	for scanner.Scan() {
		line := scanner.Text()
		parts := strings.Split(line, "|")
		if len(parts) < 1 {
			continue
		}

		bi := BranchInfo{
			Name:    parts[0],
			Current: parts[0] == currentBranch,
		}

		if len(parts) > 1 && parts[1] != "" {
			bi.Upstream = parts[1]
			if idx := strings.Index(parts[1], "/"); idx > 0 {
				bi.Remote = parts[1][:idx]
			}
		}

		if len(parts) > 2 && parts[2] != "" {
			track := parts[2]
			if strings.Contains(track, "ahead") {
				fmt.Sscanf(track, "[ahead %d", &bi.Ahead)
			}
			if strings.Contains(track, "behind") {
				fmt.Sscanf(track, "[behind %d", &bi.Behind)
				if bi.Ahead > 0 {
					var behind int
					fmt.Sscanf(track, "[ahead %d, behind %d", &bi.Ahead, &behind)
					bi.Behind = behind
				}
			}
		}

		branches = append(branches, bi)
	}

	return branches, nil
}

func (c *Client) Stash(message string) error {
	args := []string{"stash", "push"}
	if message != "" {
		args = append(args, "-m", message)
	}
	_, err := c.run(args...)
	return err
}

func (c *Client) StashPop() error {
	_, err := c.run("stash", "pop")
	return err
}

func (c *Client) Log(count int) ([]CommitInfo, error) {
	format := "%H|%h|%an|%ae|%at|%s"
	out, err := c.run("log", fmt.Sprintf("-%d", count), fmt.Sprintf("--format=%s", format))
	if err != nil {
		return nil, err
	}

	var commits []CommitInfo
	scanner := bufio.NewScanner(strings.NewReader(out))
	for scanner.Scan() {
		parts := strings.SplitN(scanner.Text(), "|", 6)
		if len(parts) < 6 {
			continue
		}

		var timestamp int64
		fmt.Sscanf(parts[4], "%d", &timestamp)

		commits = append(commits, CommitInfo{
			Hash:      parts[0],
			ShortHash: parts[1],
			Author:    parts[2],
			Email:     parts[3],
			Date:      time.Unix(timestamp, 0),
			Message:   parts[5],
		})
	}

	return commits, nil
}

func (c *Client) Reset(mode string, ref string) error {
	if mode == "" {
		mode = "mixed"
	}
	if ref == "" {
		ref = "HEAD"
	}
	_, err := c.run("reset", "--"+mode, ref)
	return err
}

func (c *Client) ResetFile(path string) error {
	_, err := c.run("checkout", "--", path)
	return err
}

func (c *Client) Clean(dryRun bool) ([]string, error) {
	args := []string{"clean", "-fd"}
	if dryRun {
		args = append(args, "-n")
	}
	out, err := c.run(args...)
	if err != nil {
		return nil, err
	}

	var files []string
	scanner := bufio.NewScanner(strings.NewReader(out))
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "Would remove ") {
			files = append(files, strings.TrimPrefix(line, "Would remove "))
		} else if strings.HasPrefix(line, "Removing ") {
			files = append(files, strings.TrimPrefix(line, "Removing "))
		}
	}
	return files, nil
}

func (c *Client) Remote() (string, error) {
	return c.run("remote", "get-url", "origin")
}

func (c *Client) Remotes() (map[string]string, error) {
	out, err := c.run("remote", "-v")
	if err != nil {
		return nil, err
	}

	remotes := make(map[string]string)
	scanner := bufio.NewScanner(strings.NewReader(out))
	for scanner.Scan() {
		parts := strings.Fields(scanner.Text())
		if len(parts) >= 2 && strings.HasSuffix(parts[2], "(fetch)") {
			remotes[parts[0]] = parts[1]
		}
	}
	return remotes, nil
}

func (c *Client) ShortPath(fullPath string) string {
	root, err := c.Root()
	if err != nil {
		return fullPath
	}
	rel, err := filepath.Rel(root, fullPath)
	if err != nil {
		return fullPath
	}
	return rel
}

func DetectRepo(path string) *Client {
	client := NewClient(path)
	if client.IsRepo() {
		return client
	}
	return nil
}
