# sdd-cli 使用说明

## 常用命令一览

### 核心（无需插件）

| 命令 | 说明 |
|------|------|
| `sdd init` | 在当前项目生成 `specs/`、`templates/`、`.sdd/config.yaml`、`CLAUDE.md` 等 |
| `sdd new <name>` | 从模板新建文档（见下表 `--type`） |
| `sdd status` | 列出规格状态 |
| `sdd amend <spec>` | 小改规格并记 changelog |

### `sdd new` 的 `--type`

| `--type` | 说明 | 生成文件名示例 |
|----------|------|----------------|
| `feature-spec`（默认） | 工程向功能规格 | `YYYY-MM-DD-<slug>.md` |
| `feature-spec-pm` | PM 向（范围、AC、发布等） | `YYYY-MM-DD-pm-<slug>.md` |
| `qa-from-spec` | QA 检查表 | `YYYY-MM-DD-qa-<slug>.md` |
| `design-doc` | 设计文档 | `YYYY-MM-DD-<slug>.md` |
| `adr` | 架构决策记录 | `YYYY-MM-DD-<slug>.md` |

标题含空格时请加引号：`sdd new "My Feature" --type feature-spec-pm`。

### 插件（在 `.sdd/config.yaml` 中 `plugins.*: true`，默认全部开启）

| 命令 | 插件 | 说明 |
|------|------|------|
| `sdd review <spec>` | workflow | 评审、自检、通过/打回 |
| `sdd threads <spec>` | workflow | 列出评审线程 |
| `sdd resolve <spec> <index> -m "msg"` | workflow | 解决线程 |
| `sdd complete <spec>` | workflow | 完成并归档 |
| `sdd archive <spec>` | workflow | 归档未完成规格 |
| `sdd diff <spec>` | diff | 规格接口与代码漂移（支持 `.ts`/`.py`/`.go`/`.java`） |
| `sdd doctor` | doctor | 项目健康检查 |
| `sdd board` | board | 看板视图（终端表格 + 浏览器 UI） |
| `sdd board --ui` | board | 在浏览器中打开可搜索的看板 |
| `sdd board --domain <name>` | board | 按 domain 过滤 |
| `sdd board --author <name>` | board | 按 author 过滤 |
| `sdd board --wide` | board | 显示作者信息 |

## 规格生命周期（摘要）

```
draft → ready → approved → in-progress → complete
  ↓                                        ↓
archived                                 archived
```

- 未 **`approved`** 前，开发侧不应开始写实现代码（见业务仓库中的 `CLAUDE.md`）。
- 本 CLI **暂无** `sdd plan`；将 `status` 设为 `in-progress` 可手改 frontmatter。

## 配置示例（`.sdd/config.yaml`）

```yaml
version: "1"
mode: flat
template: default
plugins:
  workflow: true
  diff: true
  doctor: true
  board: true
extractors:
  ".ts": typescript
  ".py": python
  ".go": go
  ".java": java
```

## 更多文档

- **IDE / KarmaStudio / 飞书**： [karmastudio-sdd-delivery.md](./karmastudio-sdd-delivery.md)
- **AI Prompt 与 PM·Dev·QA 全链路示例**：[ai-delivery/README.md](./ai-delivery/README.md)
