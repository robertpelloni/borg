# borg

**Borg** is Robert Pelloni's agent-orchestration project — a choreography/coordination layer for fleets of AI coding agents (the project was renamed from "aios" in March 2026, and it is the orchestration effort that sits underneath the HyperNexus/TormentNexus control-plane work).

## Status

This repository is currently an **empty placeholder** — the name is reserved here, but no code has been pushed to it yet. Borg-related implementation work currently lives in:

- [`robertpelloni/workspace`](https://github.com/robertpelloni/workspace) — the federated monorepo, which contains the `borg` component (multi-agent choreography bus)
- [`robertpelloni/hyperharness`](https://github.com/robertpelloni/hyperharness) — the Go harness/control-plane work, which carries Borg session/queue state
- [`HyperNexusLLC/HyperNexus`](https://github.com/HyperNexusLLC/HyperNexus) — `apps/borg-extension`

When the Borg code is extracted into a standalone tree, this repo is where it will land. Until then, there is nothing to build or run here.
