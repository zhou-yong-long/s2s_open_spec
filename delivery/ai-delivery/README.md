# AI 交付包（sdd-cli / SDD）

本目录提供**可复制粘贴的 Prompt** 与 **PM / Dev / QA 全链路示例**，用于：

- 让 AI 助手正确安装 **sdd-cli**（**必须从分支 `feature/sdd-karmastudio-pack` 构建，不要用 `main` 当默认来源**）；
- 将 SDD 集成进 IDE（规则、RAG、任务）；
- 按角色演练一条完整链路。

| 文档 | 说明 |
|------|------|
| [01-prompt-install-sdd-cli.md](./01-prompt-install-sdd-cli.md) | 安装 Prompt（含分支约束） |
| [02-prompt-integrate-into-ide.md](./02-prompt-integrate-into-ide.md) | IDE 集成 Prompt |
| [03-examples-pm-dev-qa-full-chain.md](./03-examples-pm-dev-qa-full-chain.md) | PM、Dev、QA 各一份用例 + 串联时间线 |
| [04-supplement-checklist.md](./04-supplement-checklist.md) | 清单、分支策略、FAQ、自证命令 |

更多背景见 [KarmaStudio / SDD 集成交付说明](../karmastudio-sdd-delivery.md) 与仓库根 [README.md](../../README.md)。

**对外交付副本**：仓库根目录 [`delivery/`](../delivery/)（与 `docs/ai-delivery/` 等同步，执行 `npm run delivery:sync` 更新后提交）。
