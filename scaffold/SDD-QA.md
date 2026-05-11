# SDD — QA 工作指引

本文件与 `CLAUDE.md` 配套。规格是测试的**权威输入之一**。

## 何时介入

- **`approved` 之后**：开始写详细用例与测试数据；之前可参与评审意见（`sdd review --notes`），但不以「开发已完成」为前置。
- **`complete` 之前**：完成对本迭代的测试结论（通过 / 阻塞项），阻塞项应反映在 Review Threads 或缺陷系统。

## 从规格推导用例

1. **Interfaces / 对外行为**：每个公开接口或用户可见流程至少一条正向路径 + 一条关键异常路径。
2. **Edge Cases**：表格中每一行应对应或可映射到至少一条用例或探索式测试说明。
3. **Acceptance criteria**：逐条 AC 必须有可执行的验证步骤（手工或自动化引用）。

可在仓库根执行 `sdd new <用例集名称> --type qa-from-spec`，生成 `specs/active/日期-qa-<slug>.md`（模板同 `templates/qa-from-spec.md`）。也可复制模板到团队测试库，与功能 spec 的 `links.parent` 对齐。

## `sdd diff`（可选）

当 `plugins.diff: true` 时，在实现阶段后期或回归前运行：

```bash
sdd diff specs/active/<your-spec>.md
```

关注 **规格中声明的接口与代码签名漂移**；漂移结果应要么修代码，要么走 `sdd amend` / 新 spec 更新规格。

## 评审线程

若对规格有疑问，请评审人在 spec 上开 thread（`sdd review …`）；你作为 QA 可要求补充 **可测性** 信息（数据、环境、边界），再关闭 thread。
