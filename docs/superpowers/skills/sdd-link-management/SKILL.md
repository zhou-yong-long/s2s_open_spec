# SDD Spec Link Management

Guide AI agents through managing spec associations using sdd CLI link commands. Covers linking, unlinking, querying, visualizing, and syncing spec relationships to Hive Mind.

## When to Use

Trigger when:
- User asks to link, connect, or relate specs
- User mentions spec dependencies, blocking relationships, or parent-child hierarchies
- User wants to visualize spec relationships or generate a dependency graph
- User asks to sync spec links to Hive Mind for team sharing
- You discover related specs during development and want to document the relationship

## Commands

### `sdd link <source> <target> [--type <type>] [--note <msg>]`

Add a link between two specs.

**Link types:**
- `parent` / `child` — Parent-child hierarchy (auto-generates reverse)
- `blocks` / `blocked-by` — Source must be completed before target (auto-generates reverse)
- `relates` — Loose association (default)
- `duplicates` — Target supersedes source

**Examples:**
```bash
# Link by file path
sdd link specs/active/2026-05-14-user-login.md specs/active/2026-05-14-payment-flow.md --type blocks

# Link by URI
sdd link hivemind://local/specs/auth/user-login hivemind://local/specs/billing/payment-flow --type relates --note "Payment depends on auth"

# Parent-child relationship
sdd link specs/active/2026-05-14-epic.md specs/active/2026-05-14-feature.md --type parent
```

**Validation:**
- Source and target must exist
- Type must be valid
- No self-loops allowed
- No duplicate links
- Cycle detection for directed links (parent, child, blocks, blocked-by)

### `sdd unlink <source> <target> [--type <type>]`

Remove a link between two specs.

**Examples:**
```bash
# Remove specific type
sdd unlink specs/active/a.md specs/active/b.md --type blocks

# Remove all links between two specs
sdd unlink specs/active/a.md specs/active/b.md
```

### `sdd links [spec] [--type <type>] [--direction in|out|all]`

List links between specs.

**Examples:**
```bash
# List all links
sdd links

# List links for a specific spec
sdd links specs/active/2026-05-14-user-login.md

# Filter by direction
sdd links specs/active/2026-05-14-user-login.md --direction out
sdd links specs/active/2026-05-14-user-login.md --direction in

# Filter by type
sdd links --type blocks
```

### `sdd graph [--format ascii|dot] [--type <type>] [--team <team>] [--domain <domain>]`

Visualize spec links as a graph.

**Examples:**
```bash
# Terminal ASCII graph
sdd graph

# Graphviz DOT format (pipe to dot -Tpng > graph.png)
sdd graph --format dot

# Filter by type
sdd graph --type blocks

# Filter by domain
sdd graph --domain auth
```

### `sdd sync-links [--submit] [--include-implicit] [--check] [--repair]`

Sync spec links to/from Hive Mind.

**Examples:**
```bash
# Check consistency between links.yaml and frontmatter
sdd sync-links --check

# Repair frontmatter inconsistencies
sdd sync-links --repair

# Output links JSON for Hive Mind submission
sdd sync-links

# Include implicit links (same team/domain)
sdd sync-links --include-implicit

# Submit to Hive Mind (outputs JSON for hivemind_submit_resource)
sdd sync-links --submit
```

## URI Format

Specs are identified by Hive Mind URIs:
- `hivemind://team/specs/domain/slug` — Domain mode
- `hivemind://team/specs/slug` — Flat mode

The CLI also accepts local file paths and resolves them to URIs automatically.

## Data Storage

- `.sdd/links.yaml` — Central storage for all link relationships
- Spec frontmatter `links` field — Synced for Hive Mind Admin UI Graph view
  - `links.parent` — Parent spec URI
  - `links.related` — Array of related spec URIs

## Workflow

1. **Create specs** with `sdd new`
2. **Link specs** with `sdd link`
3. **Verify links** with `sdd links` or `sdd graph`
4. **Sync to Hive Mind** with `sdd sync-links --submit`
5. **Check consistency** with `sdd sync-links --check`

## Best Practices

- Use `blocks` for dependencies that must be completed in order
- Use `parent`/`child` for hierarchical spec relationships
- Use `relates` for loose associations
- Add `--note` to explain why specs are linked
- Run `sdd sync-links --check` periodically to ensure consistency
- Use `sdd sync-links --repair` to fix frontmatter mismatches
