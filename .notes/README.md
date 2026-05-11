# Agent notes (s2s_open_spec)

Short-lived pointers for automation. Prefer updating when behavior or integration paths change.

## SDD + KarmaStudio / Feishu

- `sdd new` supports `--type feature-spec-pm` and `qa-from-spec` (plus `design-doc`, `adr`); PM/QA files use `pm-` / `qa-` filename prefixes under `specs/active/`.
- Delivery checklist for integrators: [docs/karmastudio-sdd-delivery.md](../docs/karmastudio-sdd-delivery.md).
- **AI 交付包**（安装/IDE Prompt、PM·Dev·QA 用例、分支约束）：[docs/ai-delivery/README.md](../docs/ai-delivery/README.md)。安装须用分支 **`feature/sdd-karmastudio-pack`**，勿当 `main` 已对齐。
- **离线 zip**：`npm run bundle` → `release/sdd-cli-offline-*.zip`（内含 `.tgz` + `INSTALL.md` + 完整源码 zip）；`release/` 已 gitignore。
- PM/QA agent rules live under `scaffold/SDD-PM.md` and `scaffold/SDD-QA.md`; `sdd init` copies the whole `scaffold/` tree into the target repo.
- Optional Open Spec YAML hints are commented in `scaffold/templates/feature-spec.md`. Custom frontmatter keys from Feishu sync are preserved: `src/core/spec.ts` merges non-core keys into `frontmatterExtra` and writes them back on `updateFrontmatter`.

## Git

- Code changes for this initiative: use branch `feature/sdd-karmastudio-pack` (or a new `feature/*` from current `main`), not direct commits to the shared default branch.
