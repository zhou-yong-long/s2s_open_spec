# SDD — PM 工作指引

本文件与 `CLAUDE.md`（开发门禁）配套使用。Specs 位于 `specs/`。

## 你的产出

1. **问题与价值**：在 `## Problem` 写清用户/业务问题，避免写实现细节。
2. **范围**：在 `## Scope`（或模板中的范围表）写明 **做 / 不做**，减少后期扯皮。
3. **验收标准（AC）**：可度量的 Given / When / Then 或 checklist；开发以此为完成定义，QA 以此为测试依据。
4. **依赖与风险**：外部团队、合规、数据、灰度策略；高风险的写到 `## Risks` 或单独 ADR。

## 模板选择

- 偏交互与业务规则：优先使用 `templates/feature-spec-pm.md`（可复制为 `sdd new` 生成的文件基础，或手工复制改名）。
- 与后端接口强绑定：在 `feature-spec.md` 上补充 AC 与范围章节即可。

## 状态协作

| 目标 | 动作 |
|------|------|
| 写完初稿 | `status: draft` |
| 自检通过、可给别人评 | `sdd review <spec> --self` → `ready` |
| 评审通过、可开发 | 评审人在 `sdd review` 中 `approved`（见 `CLAUDE.md`） |

不要在未 `approved` 的规格上承诺排期给「已开发完成」。

## 飞书 / PRD 同步

若 PRD 在飞书：由团队约定的 **Hclaw skill** 或人工同步到本仓库 spec；在 frontmatter 可保留 `summary`、`source` 等元数据（见 `templates/feature-spec.md` 顶部注释）。首轮让 Agent 只读摘要与 Problem，可显著省 Token。

## 与 Jira / 其他系统

用 frontmatter 的 `tags`、`links.related` 存工单链接或 Epic ID（纯文本约定即可）。
