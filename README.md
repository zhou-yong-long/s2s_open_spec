# SDD CLI

Spec-Driven Development CLI — a lightweight, language-agnostic framework for managing the full spec lifecycle with git-native tracking and optional AI integration.

## What is SDD?

SDD (Spec-Driven Development) adds a lightweight specification gate before coding:

- **Write a spec** — define the problem, constraints, and interfaces before writing code
- **Get approval** — specs pass a review gate before implementation begins
- **Code to spec** — implementation follows the approved interfaces
- **Stay in sync** — diff tool detects drift between spec and code

## Quick Start

```bash
npm install -g sdd-cli

# Initialize SDD in your project
sdd init

# Create your first spec (engineering template)
sdd new my-feature

# PM-heavy spec (file: specs/active/YYYY-MM-DD-pm-<slug>.md)
sdd new "Billing rollout" --type feature-spec-pm

# QA checklist from spec (file: ...-qa-<slug>.md)
sdd new login-flow --type qa-from-spec

# Write the spec (opens $EDITOR), then review it
sdd review specs/active/2026-01-01-my-feature.md --self

# Get approval from a reviewer, then implement
# ... write code, link files in spec's linked_files ...

# Detect spec-vs-code drift
sdd diff specs/active/2026-01-01-my-feature.md

# Mark complete when done
sdd complete specs/active/2026-01-01-my-feature.md
```

## Commands

### Core (always available)

| Command | Description |
|---------|-------------|
| `sdd init` | Scaffold SDD directory structure in current project |
| `sdd new <name>` | Create from template (`--type`: `feature-spec` (default), `feature-spec-pm`, `qa-from-spec`, `design-doc`, `adr`) |
| `sdd status` | List all specs with status and staleness indicators |
| `sdd amend <spec>` | Record a minor change to an existing spec |

### Plugins (opt-in via `.sdd/config.yaml`)

| Command | Plugin | Description |
|---------|--------|-------------|
| `sdd review <spec>` | workflow | Review a spec (self or peer) |
| `sdd complete <spec>` | workflow | Mark spec as complete and archive |
| `sdd archive <spec>` | workflow | Archive a spec (not completed) |
| `sdd doctor` | doctor | Health checks: stale specs, duplicates, mode suggestions |
| `sdd diff <spec>` | diff | Detect drift between spec interfaces and code |

When **`workflow: true`**, these commands are also available:

| Command | Description |
|---------|-------------|
| `sdd threads <spec>` | List review threads on a spec |
| `sdd resolve <spec> <index> -m "msg"` | Resolve a thread by index |

## Spec Lifecycle

```
draft  →  ready  →  approved  →  in-progress  →  complete
  ↓                                                  ↓
archived                                         archived
```

| Status | Meaning |
|--------|---------|
| `draft` | Author is writing the spec |
| `ready` | Self-review done, awaiting peer approval |
| `approved` | Reviewed and cleared for implementation |
| `in-progress` | Implementation has started (code frozen spec) |
| `complete` | Done — spec matches delivered code |
| `archived` | Abandoned without being completed |

## Project Modes

| Mode | Best for | Spec location |
|------|----------|---------------|
| `flat` | Solo dev, <12 active specs | `specs/active/` |
| `domain` | Multiple domains in one repo | `specs/active/<domain>/` |
| `team` | Multiple teams | `specs/active/<team>/<domain>/` |

## Configuration

All settings in `.sdd/config.yaml`:

```yaml
version: "1"
mode: flat              # flat | domain | team
template: default       # minimal | default | full
plugins:
  workflow: false       # sdd review, complete, archive, threads, resolve
  diff: false           # sdd diff (spec-vs-code drift detection)
  doctor: false         # sdd doctor (project health checks)
extractors:
  ".ts": typescript     # diff plugin extracts TS function/route signatures
  ".py": python         # diff plugin extracts Python function/route signatures
```

Enable plugins by setting them to `true`.

## Spec Templates

Three templates included:

| Template | Contents |
|----------|----------|
| **minimal** | Problem, Constraints, Interfaces |
| **default** | + Design (Components, Trade-offs), Edge Cases, Review Log, Changelog |
| **full** | + Architecture, Risks, Alternatives, Rollout Plan |

Also includes templates for **Design Docs** and **ADR** (Architecture Decision Records).

Additional templates in `scaffold/templates/` (also selectable via `sdd new --type`):

| File | `sdd new --type` | Output filename pattern |
|------|------------------|-------------------------|
| `feature-spec-pm.md` | `feature-spec-pm` | `YYYY-MM-DD-pm-<slug>.md` |
| `qa-from-spec.md` | `qa-from-spec` | `YYYY-MM-DD-qa-<slug>.md` |

Use quotes around `<name>` when the title contains spaces (shell passes a single argument). Slug always lowercases alphanumeric segments separated by `-`.

## AI Integration

`sdd init` generates a `CLAUDE.md` that teaches AI agents the SDD workflow — checking specs before coding, respecting the status lifecycle, and knowing when to amend vs. create new specs.

Compatible with Claude Code, Codex, and other AI coding assistants.

See **[docs/karmastudio-sdd-delivery.md](docs/karmastudio-sdd-delivery.md)** for packaging SDD into an internal IDE (for example KarmaStudio), Feishu → Open Spec alignment, and the suggested file bundle for integration partners.

**AI copy-paste prompts + PM/Dev/QA full-chain examples** (install from branch `feature/sdd-karmastudio-pack`, not `main`): **[docs/ai-delivery/README.md](docs/ai-delivery/README.md)**.

### CLI vs design docs

- The long-form design under `docs/superpowers/` may mention **`sdd plan`**; that command is **not implemented** in this repo yet. Use `status: in-progress` in frontmatter manually when implementation starts.
- Optional YAML keys for tooling (for example `summary`, `detail_tier`, `source` from a Feishu sync) are **merged through** `parseSpec` / `updateFrontmatter`: they live in `frontmatterExtra` and are written back with the core fields so `sdd review` and similar commands do not drop them.

## Development

```bash
git clone https://github.com/zhou-yong-long/s2s_open_spec.git
cd s2s_open_spec
npm install

# Run locally
npm run dev -- init
npm run dev -- new my-feature

# Run tests
npm test
```

### Offline install bundle (no `git push` needed)

From a clean checkout of branch `feature/sdd-karmastudio-pack`:

```bash
npm run bundle
```

This runs `build`, `test`, `npm pack`, `git archive` (full source with tests), and writes **`release/sdd-cli-offline-<timestamp>.zip`** (contains `sdd-cli-0.1.0.tgz`, `INSTALL.md`, and the full-source zip). Share that zip over Lark / USB / internal drive. Recipients follow `INSTALL.md` inside the zip (global install via `npm install -g ./sdd-cli-0.1.0.tgz`).

## License

MIT
