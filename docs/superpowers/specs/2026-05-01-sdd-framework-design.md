# SDD Framework Design

**Status:** approved
**Author:** wade
**Created:** 2026-05-01

## Problem

Spec-Driven Development lacks a lightweight, language-agnostic framework that works for both solo
developers and teams. Existing solutions are either too heavy (full CLIs with mandatory workflows)
or too light (just templates, no enforcement). We need a framework that starts simple and scales up
as projects grow, with AI agent integration built in from day one.

## Constraints

- Language-agnostic: must work with any programming language
- Incremental adoption: usable with zero tooling, more features activate on demand
- AI-native: scaffold includes agent instructions (CLAUDE.md) so AI assistants follow SDD
- Git-based: leverages git for change tracking, no external database
- Low ceremony: a utility function spec is 5 lines; a risky feature spec is 20 lines

## Design

### Project Structure (scaffold)

What `sdd init` copies into a target project:

```
project/
├── specs/
│   ├── active/              # Specs currently being implemented
│   │   └── .gitkeep
│   ├── completed/           # Done
│   │   └── .gitkeep
│   └── archived/            # Rejected or superseded
│       └── .gitkeep
├── design/                  # ADRs, architecture decisions
│   └── .gitkeep
├── templates/               # Spec templates (language-agnostic)
│   ├── feature-spec.md
│   ├── design-doc.md
│   └── adr.md
├── .sdd/
│   └── config.yaml
├── CLAUDE.md                # AI agent instructions (auto-generated)
└── README.md
```

### Spec Template (feature-spec.md)

YAML frontmatter + markdown body. Parsable by every language. Status lifecycle enforced by CLI.

```markdown
---
status: draft              # draft → ready → approved → in-progress → complete | archived
author: <git user.name>
created: <date>
domain: null               # Optional in flat mode. Required in domain mode.
tags: []
links:
  parent: null
  related: []
pinned_commit: null        # Set by sdd review. Baseline for sdd diff.
linked_files: []           # Files this spec covers. Helps sdd diff.
---

# {Title}

## Problem
{2-4 sentences. What problem this solves. No implementation.}

## Constraints
- {Constraint}

## Design

### Interfaces
{Public API signatures, data shapes, routes. Language-agnostic pseudocode.}

### Components
{What pieces need to exist. One sentence each.}

### Trade-offs
- {Decision}: {Why this over the alternative}

## Edge Cases
- {Edge case}: {Expected behavior}

## Review Log
| Date | Reviewer | Decision | Notes |
|------|----------|----------|-------|

## Changelog
| Date | Change | Author |
|------|--------|--------|
```

**Template variants:**
- `minimal`: Problem + Interfaces only (for utilities, small changes)
- `default`: All sections above (for features)
- `full`: Adds Risks, Alternatives Considered, Rollout Plan (for high-risk changes)

**Status lifecycle:**

| Status | Meaning | Set by |
|--------|---------|--------|
| `draft` | Author is writing | `sdd new` |
| `ready` | Author completed; ready for review | `sdd review --self` |
| `approved` | Reviewer signed off; code can start | `sdd review` |
| `in-progress` | Implementation active | `sdd plan` (workflow plugin) |
| `complete` | Done, shipped | `sdd complete` (workflow plugin) |
| `archived` | Rejected or superseded | `sdd archive` (workflow plugin) |

**Review gate:** code cannot be written until `status: approved` and Review Log has at least one
`approved` entry. Solo work: `sdd review --self` auto-approves. Team work: another reviewer must sign off.

### Core CLI (4 commands)

**`sdd init`** — Scaffold project
```bash
sdd init                    # Flat mode, default template
sdd init --mode domain      # Domain mode
sdd init --template minimal # Minimal spec template
```
Copies scaffold into current directory. Detects non-empty dir and asks before overwriting.
Generates CLAUDE.md. Runs `git init` if no repo.

**`sdd new <name>`** — Create spec
```bash
sdd new "user-auth"                   # Creates specs/active/<date>-user-auth.md
sdd new "rate-limit" --domain api     # In domain mode: specs/active/api/<date>-rate-limit.md
sdd new "jwt-choice" --type design-doc # Uses design-doc template
```
Reads config for placement and template. Fills frontmatter from git config and date.
Opens file in $EDITOR.

**`sdd status`** — Show all specs
```bash
sdd status                  # Active specs
sdd status --domain api     # Filter by domain
sdd status --author wade    # Filter by author
sdd status --all            # Include completed/archived
```
Output: colored table with status, author, date, staleness. Flags specs awaiting review.
Colors: draft=gray, ready=yellow, approved=green, in-progress=blue, stale (>7d)=red.

**`sdd amend <spec>`** — Update spec after minor changes
```bash
sdd amend specs/active/auth/sso-login.md
```
Shows `git diff pinned_commit..HEAD -- linked_files` summary. Prompts for change description.
Appends to Changelog table. Updates pinned_commit to HEAD.

**Manual actions (no CLI required):** edit spec body directly, change frontmatter by hand,
move files between active/completed/archived. The CLI is convenience, not a cage.

### Plugin System

Activated via config. Six plugins, each adding 1-4 commands:

| Plugin | Commands | When to activate |
|--------|----------|-----------------|
| `doctor` | `sdd doctor` | ~10+ active specs |
| `diff` | `sdd diff <spec>` | First spec-vs-code mismatch |
| `workflow` | `review`, `plan`, `complete`, `archive` | Team grows past 2 |
| `board` | `sdd board` | Need kanban overview |
| `git-hooks` | Installs pre-push hook | Want automated enforcement |
| `ai` | `sdd fill <spec>` | Want AI-assisted spec drafting |

Plugin shape:
```typescript
export default {
  name: "diff",
  description: "Detect spec vs code mismatches",
  commands: {
    diff: {
      run: async (args: string[], config: Config) => { /* ... */ },
      help: "sdd diff <spec>   Check spec against code",
    },
  },
};
```

### Config File (.sdd/config.yaml)

```yaml
version: "1"
mode: flat                   # flat | domain | team
template: default            # minimal | default | full
doctor:
  flat_max: 12               # Max active specs before suggesting domain mode
  similarity_threshold: 0.6
paths:
  specs: specs/
  active: specs/active/
  completed: specs/completed/
  archived: specs/archived/
plugins:
  doctor: false
  diff: false
  workflow: false
  board: false
  git_hooks: false
  ai: false
extractors:                  # For sdd diff
  ".ts": typescript
  ".py": python
  ".go": null
```

### Rule Implementation

**sdd doctor (spec level detection):** No AI. Heuristics: count active specs vs threshold,
group by domain tag, check author overlap, compute word similarity on Problem sections
for duplicate detection. Advisory only; human decides.

**sdd diff (spec-vs-code drift):** Reads spec frontmatter for linked_files. Runs
language-aware extractor on each file. Extracts interface shapes (function signatures,
route definitions, exported constants). Compares spec Interfaces section against
code shapes. Reports mismatches. Extractors are small pattern matchers, not full type
checkers — enough to catch interface drift.

**sdd amend (update decision):** The human decides whether to update. CLI presents
git diff since pinned_commit. Bug fixes and refactors don't need spec updates.
API/behavior changes do. The rule is encoded in CLAUDE.md documentation, not enforced
by code.

### AI Integration

`sdd init` generates `CLAUDE.md` with SDD workflow rules:

```markdown
# SDD Workflow

## Rules
1. Before writing code for a new feature: check `ls specs/active/`
2. If no spec exists, create one using `templates/feature-spec.md`
3. Spec must be approved before implementation code is written
4. Run `sdd status` to see all in-flight work

## When to update a spec
- Bug fix: no update needed
- Refactor: no update needed
- API/behavior change: use `sdd amend <spec>`

## When to create a new spec
- New feature, breaking behavior change, architecture decision
```

### Spec Level Scaling

| Mode | Structure | Trigger |
|------|-----------|---------|
| `flat` | All specs in `specs/active/` | Default, up to ~12 active specs |
| `domain` | `specs/active/<domain>/` | 3+ domains, specs per domain >= 2 |
| `team` | `specs/active/<team>/<epic>/` | Authors cluster into non-overlapping groups |

Upgrading modes doesn't break anything. `sdd init --mode domain` starts at domain level.
`config set mode domain` upgrades. Specs stay in place; new specs get domain subdirectories.

### Workflow Summary

```
sdd new "feature"       → Spec created (draft)
Author fills spec       → status: draft
sdd review --self       → status: ready
sdd review              → status: approved (teammate signs off)
sdd plan                → Implementation plan generated
Write code              → status: in-progress
sdd amend (if drift)    → Changelog updated
sdd complete            → Spec moved to completed/
```

## Edge Cases

- **Duplicate specs:** `sdd doctor` detects and flags. Author decides which to keep.
- **Spec abandoned mid-work:** Author can `mv` to archived/ or update status to archived.
  No CLI enforcement, manual action.
- **Spec covers multiple domains:** Author picks primary domain tag. Cross-references via
  `links.related` in frontmatter.
- **No git repo:** `sdd init` runs `git init`. If user declines, amend/diff features degrade
  gracefully (no pinned_commit tracking).
- **Large spec needing decomposition:** Doctor flags specs with >8 sub-headings or >200 lines.
  Suggests `sdd new` for sub-features.
- **Non-standard project layout:** All paths configurable in `.sdd/config.yaml`. Defaults
  work for 95% of projects.

## Trade-offs

- **Markdown + YAML frontmatter over JSON/YAML spec files:** Markdown is human-readable,
  renders in any editor, diffable in git. YAML frontmatter is machine-parseable. Loses
  some schema enforcement but gains universal readability.
- **CLI core + plugins over monolith:** More initial design work for plugin interface,
  but prevents bloat. Users only pay for features they activate.
- **Git commit pinning over timestamp tracking:** Commit hash is unambiguous. Timestamp
  requires clock sync. Commit works offline and across timezones. Degrades gracefully
  when no git available.
- **Heuristics over AI for doctor/diff:** Cheaper (no API cost), faster (instant),
  deterministic. AI is reserved for `sdd fill` plugin where judgment is genuinely needed.
