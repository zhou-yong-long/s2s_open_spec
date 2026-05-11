# SDD / KarmaStudio 集成交付说明

面向 **在无仓库写权限下**，把本仓库的 **SDD CLI + 规格约定** 交给 IDE 集成方（例如 KarmaStudio 维护者）内置测试。你已选择：**交付提示词与模板 + CLI 使用说明**，由对方粘贴进系统提示词或 RAG 索引。

## 1. 版本与分支

- 以固定 **git tag 或 commit** 交付（避免「最新 main」漂移）。
- 本仓库开发约定：代码改动在 **`feature/*` 分支** 完成，再合并到主分支；不要在共享默认分支上直接堆改。

## 2. CLI 安装（集成方环境）

任选其一：

1. **npm 全局**：`npm install -g sdd-cli@<version>`（发布后）。
2. **本地克隆**：`git clone … && cd s2s_open_spec && npm install && npm run build`，再把 `node_modules/.bin` 或 `bin/sdd.js` 暴露到 `PATH`。
3. ** tarball**：在本仓库执行 `npm pack`，将生成的 `.tgz` 交给对方 `npm install -g ./sdd-cli-0.x.x.tgz`。

依赖：**Node.js**（与具体 IDE 无关，终端可用即可）。

## 3. 业务仓库里要有什么

在目标业务仓库根目录：

```bash
sdd init
```

会得到 `specs/`、`templates/`、`.sdd/config.yaml`、`CLAUDE.md` 等（见仓库根 [README.md](../README.md)）。

**新建规格类型**（`sdd new <name> [--type …]`）：

| `--type` | 说明 | 默认文件名 |
|----------|------|------------|
| `feature-spec`（默认） | 工程向功能规格 | `YYYY-MM-DD-<slug>.md` |
| `feature-spec-pm` | PM 向（范围、AC、发布等） | `YYYY-MM-DD-pm-<slug>.md` |
| `qa-from-spec` | QA 检查表 / 追溯 | `YYYY-MM-DD-qa-<slug>.md` |
| `design-doc` / `adr` | 设计文档 / ADR | `YYYY-MM-DD-<slug>.md` |

`<name>` 含空格时在 shell 中加引号。仅字母数字与连字符会进入 slug；若规范化后为空，命令会失败。

**团队评审与线程**：在 `.sdd/config.yaml` 中设置 `plugins.workflow: true`，以便使用 `sdd review`、`sdd threads`、`sdd resolve`、`sdd complete`、`sdd archive`。

**漂移检测**：按需 `plugins.diff: true`、`plugins.doctor: true`。

### 3.1 `scaffold/.sdd/config.yaml` 与已实现插件

模板里的 `plugins` 只应列出 **当前 CLI 已实现** 的项：`workflow`、`diff`、`doctor`。若你本地 `config.yaml` 仍含历史占位键（如 `board` / `git_hooks` / `ai`），可删掉；`readConfig` 会用默认值补全缺失键。

## 4. 交给 KarmaStudio（或同类 IDE）的文件包

建议打包或列清单给集成方：

| 路径（本仓库） | 用途 |
|------------------|------|
| `scaffold/CLAUDE.md` | 开发侧 SDD 门禁与命令 |
| `scaffold/SDD-PM.md` | PM：规格章节、AC、与 `draft→ready` 协作 |
| `scaffold/SDD-QA.md` | QA：用例映射、`sdd diff`、完成前检查 |
| `scaffold/templates/feature-spec.md` | 默认功能规格模板（含 Open Spec 可选元数据注释） |
| `scaffold/templates/feature-spec-pm.md` | PM 偏重模板（需求/范围/AC/发布） |
| `scaffold/templates/qa-from-spec.md` | 从规格推导测试的检查表 |
| `README.md` | 命令与生命周期总览 |

集成方将上述 Markdown **导入项目规则 / 系统提示词**，或列入 **本地 RAG 索引路径**（例如索引 `specs/`、`templates/` 与这些规则文件）。

可选：在业务仓库添加 `.vscode/tasks.json`，封装 `sdd status`、`sdd review …` 等（任意 VS Code 系 IDE 通常可用）。

## 5. Feishu（飞书）+ Hclaw Skill → Open Spec

与 **PRD / Tech doc** 源在飞书、由 **Hclaw skill** 转成仓库内 Markdown 的方案对齐时，建议约定：

1. **Git 仍为交付真相源**：Skill 将飞书文档转成 `specs/active/*.md`（或团队约定子目录），再进 MR。
2. **Open Spec 元数据**（控 Token、渐进式披露）：在 YAML 中使用短 `summary`、`detail_tier`（`minimal` / `default` / `full`）、`source`（如 `feishu` + doc 标识）、`exposed_sections`（默认先读的二级标题列表）。默认模板里已有 **注释示例**（`feature-spec.md`）。
3. **CLI 与自定义键**：当前 `sdd` 在更新 frontmatter 时会 **保留未知 YAML 键**（与核心 SDD 字段一起写回）。若你使用更旧的发包版本，请先升级或把元数据放在正文固定区块。

单向还是双向同步由团队决定；本 CLI 不绑定飞书 API。

## 6. 命令与设计文档对照

- 设计长文 `docs/superpowers/specs/2026-05-01-sdd-framework-design.md` 顶部的 **Implementation note**：其中 **`sdd plan` 等可能尚未在本 CLI 实现**；`in-progress` 可先手写于 frontmatter。
- 已实现 workflow 子命令见根 [README.md](../README.md) 插件表。

## 7. 联调建议

1. 在一个示例业务仓库 `sdd init`，开 `workflow`，走通 `draft → ready → approved → complete`。
2. 故意留一条 `sdd threads` 未解决线程，验证 `approve` 被拦截。
3. 若启用 Feishu 元数据：在 frontmatter 加自定义键后执行 `sdd review --self`，确认键仍保留（取决于 `sdd` 版本）。

---

MIT 许可证以仓库根目录 `LICENSE` 或 `package.json` 为准。
