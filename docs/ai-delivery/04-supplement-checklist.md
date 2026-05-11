# 补充：交付检查清单与常见问题

## 1. 交付物清单（给集成方 / AI）

| 文件 | 用途 |
|------|------|
| [01-prompt-install-sdd-cli.md](./01-prompt-install-sdd-cli.md) | 安装 `sdd`，**强制** `feature/sdd-karmastudio-pack` |
| [02-prompt-integrate-into-ide.md](./02-prompt-integrate-into-ide.md) | IDE 规则、RAG、tasks |
| [03-examples-pm-dev-qa-full-chain.md](./03-examples-pm-dev-qa-full-chain.md) | PM / Dev / QA 各一条全链路示例 |
| [../karmastudio-sdd-delivery.md](../karmastudio-sdd-delivery.md) | KarmaStudio / 飞书 / Open Spec 对齐说明 |
| 本仓库 `scaffold/` | `sdd init` 拷贝到业务仓库的源模板 |

## 2. 分支策略（重要）

- **sdd-cli 交付线**：`feature/sdd-karmastudio-pack`。  
- **不要**在未与团队确认的情况下把本线合并进 `main`；安装与文档 Prompt 中已写明。  
- 若需二次开发：从 `feature/sdd-karmastudio-pack` 再拉 `feature/...` 子分支，MR 目标选该分支而非 `main`。

## 3. 环境变量

| 变量 | 作用 |
|------|------|
| `EDITOR` / `VISUAL` | `sdd new` 后是否自动打开编辑器 |
| `FORCE_COLOR=0` | 自动化脚本中减少 ANSI（部分测试已用） |

## 4. 常见问题

- **`sdd review` 不存在**：检查 `.sdd/config.yaml` 是否 `workflow: true`。  
- **多词标题变成错误文件**：`sdd new` 的 `<name>` 在 shell 里需加引号，例如 `new "My Feature"`。  
- **PM/QA 文件名找不到**：PM 为 `...-pm-<slug>.md`，QA 为 `...-qa-<slug>.md`。  
- **飞书同步的 YAML 键丢失**：本分支已支持 `frontmatterExtra` 合并写回；若仍用旧构建，先升级 CLI。

## 5. 版本自证（可选）

在文档或 MR 描述中附上：

```bash
git -C /path/to/s2s_open_spec rev-parse --short HEAD
git -C /path/to/s2s_open_spec branch --show-current
```

应显示在 `feature/sdd-karmastudio-pack` 且 commit 与交付说明一致。
