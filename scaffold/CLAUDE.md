# SDD Workflow

This project uses Spec-Driven Development. Specs live in `specs/`.

## Rules

Before writing ANY code for a new feature or behavior change:
1. Check if a spec exists: `ls specs/active/` or use `sdd status`
2. If no spec exists, create one using the template in `templates/feature-spec.md`
3. The spec must reach `status: approved` before implementation code is written

## Review Collaboration

### Requesting review
1. Write spec → `status: draft`
2. Self-review: `sdd review <spec> --self` → `status: ready`
3. Commit and push; open a PR or notify reviewer

### Reviewing a spec
1. Pull the branch, read the spec
2. Leave comments: `sdd review <spec> --notes "补充错误处理" --section "Edge Cases"`
3. Request changes: `sdd review <spec> --decision changes-requested`
4. After all threads resolved: `sdd review <spec> --decision approved`

### Addressing review feedback
1. Pull the branch to see new Review Threads
2. View threads: `sdd threads <spec>`
3. Edit the spec to address each thread
4. Resolve each: `sdd resolve <spec> <thread-index> -m "已补充"`

### Gate checks
- `sdd review <spec> --decision approved` blocks if unresolved threads exist
- `sdd complete <spec>` warns about unresolved threads

## When to Update a Spec

| Situation | Action |
|-----------|--------|
| Bug fix (code was wrong, spec was right) | No update needed |
| Refactor (same behavior, different internals) | No update needed |
| API/behavior change | Run `sdd amend <spec>` |
| Breaking change | Create a new spec, link old one as superseded |
| Architecture pivot | Write a new ADR + update spec |

## When to Create a New Spec

- New feature or capability
- Behavior change that is not backwards compatible
- Architecture decision (use `templates/adr.md`)

## Spec Format

Specs use YAML frontmatter + markdown body. Status lifecycle:
draft -> ready -> approved -> in-progress -> complete (or archived)

## Commands

- `sdd status` -- See all active specs and their status
- `sdd new "<name>"` -- Create a new spec
- `sdd amend <spec-file>` -- Update a spec with a minor change
- `sdd review <spec>` -- Review a spec (self, approve, changes-requested, or comment)
- `sdd threads <spec>` -- View review threads
- `sdd resolve <spec> <index> -m "msg"` -- Resolve a review thread
- `sdd complete <spec>` -- Mark complete and archive
