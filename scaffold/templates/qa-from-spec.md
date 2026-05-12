---
status: draft
author: {{AUTHOR}}
created: {{DATE}}
domain: {{DOMAIN}}
tags: [qa-checklist]
links:
  parent: null
  related: []
pinned_commit: null
linked_files: []
---

# QA checklist — {{TITLE}}

> 将 `links.parent` 设为对应功能 spec 的路径或 URL，便于追溯。

## Traceability

| Spec section | Cases / notes |
|--------------|----------------|
| Problem | |
| Acceptance criteria | |
| Edge Cases | |
| Interfaces | |

## Functional

- [ ] Happy path（主流程）
- [ ] 权限 / 未登录
- [ ] 输入校验与错误提示
- [ ] 幂等与重试（若适用）

## Non-functional（按需）

- [ ] 性能 / 超时
- [ ] 本地化
- [ ] 日志与可观测性

## Regression

- [ ] 与 `linked_files` 变更相关的回归范围已列出

## Sign-off

| Role | Name | Date | Result |
|------|------|------|--------|
| QA | | | pass / fail |

## Changelog

| Date | Change | Author |
|------|--------|--------|
