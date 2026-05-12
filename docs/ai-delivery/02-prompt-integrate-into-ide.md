# 给 AI 的「集成到 IDE」Prompt（KarmaStudio / Cursor / VS Code 系）

把下面整段复制给负责 IDE 规则或内部 IDE 集成的 Agent。**前提**：业务仓库里已用 `sdd init` 落过 SDD 目录（或等价拷贝 `scaffold/` 产物），且本机 `sdd` 已按 `01-prompt-install-sdd-cli.md` 从 **`feature/sdd-karmastudio-pack`** 安装。

---

## Prompt 正文（复制区开始）

你是 IDE 集成助手。目标是把 **SDD（Spec-Driven Development）** 工作流接入当前工作区（KarmaStudio、Cursor、VS Code 等），使 AI 与开发者遵守同一套规格门禁。

### 1. 工作区文件

- 确认业务仓库根存在：`specs/`、`.sdd/config.yaml`、`CLAUDE.md`（或团队重命名的等价规则文件）。若无：在业务仓库根执行 `sdd init`（需已安装 `sdd`）。  
- 建议团队启用：`.sdd/config.yaml` 中 `plugins.workflow: true`（评审、`threads`/`resolve`）；按需 `diff`、`doctor`。

### 2. 给 AI 的规则（择一或组合）

- 将 **项目级规则** 指向（或内嵌）以下文件内容（路径相对于 **sdd-cli 源码仓库** 的 `scaffold/`，也可在业务仓库中放副本）：  
  - `scaffold/CLAUDE.md` — 开发门禁与命令  
  - `scaffold/SDD-PM.md` — PM 写规格与 AC  
  - `scaffold/SDD-QA.md` — QA 追溯与 `sdd diff`  
- 规则要点（必须写进 Agent 系统提示或用户规则）：  
  - 改行为前先列 `specs/active/`，未 `approved` 的规格不得开始写实现代码。  
  - 多角色时：PM 用 `sdd new "<标题>" --type feature-spec-pm`；工程用默认 `sdd new <slug>`；QA 用 `sdd new <slug> --type qa-from-spec`，并在 QA 文档 `links.parent` 指向功能 spec。  
  - 评审用 `sdd review`、`sdd threads`、`sdd resolve`；合并前建议 `sdd status`。

### 3. IDE 侧可选增强

- **RAG / 索引路径**：包含 `specs/`、`templates/`、以及上述规则 Markdown。  
- **Tasks**：在 `.vscode/tasks.json` 中封装 `sdd status`、`sdd review …`（若 IDE 支持任务面板）。  
- **终端**：保证 `PATH` 上的 `sdd` 来自约定安装（见安装 Prompt），避免混用旧全局包。

### 4. 验收

- 列出你为当前仓库配置的规则文件路径与 RAG 路径（如有）。  
- 给出一条「从新建 PM 规格到 dev 看到 approved 再实现」的检查清单（3～6 条 bullet）。

## Prompt 正文（复制区结束）

---

### 与人协作的补充

- 若 **KarmaStudio** 由他人内置：把 `docs/karmastudio-sdd-delivery.md` 与 `docs/ai-delivery/` 一并打包发给集成方。  
- **不要**把本交付线误当 `main`：规则里可再写一句「sdd-cli 从分支 `feature/sdd-karmastudio-pack` 构建」。
