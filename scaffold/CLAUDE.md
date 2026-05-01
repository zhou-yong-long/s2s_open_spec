# SDD Workflow

This project uses Spec-Driven Development. Specs live in `specs/`.

## Rules

Before writing ANY code for a new feature or behavior change:
1. Check if a spec exists: `ls specs/active/` or use `sdd status`
2. If no spec exists, create one using the template in `templates/feature-spec.md`
3. The spec must reach `status: approved` before implementation code is written

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
