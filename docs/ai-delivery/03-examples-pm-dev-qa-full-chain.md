# PM / Dev / QA 全链路用例（各一份）

以下用**同一虚构需求**串起来：`login-rate-limit`（登录接口限流）。假设业务仓库已 `sdd init`，且 `plugins.workflow: true`。日期以你机器当天为准；示例里用 `2026-05-11` 占位。

---

## 一、PM 用例（需求进仓 → 可评审）

**目标**：产出 PM 向规格，进入 `draft`，自检为 `ready`，等待评审。

```bash
# 业务仓库根
sdd new "Login rate limit" --type feature-spec-pm
# 生成类似：specs/active/2026-05-11-pm-login-rate-limit.md

# 编辑该文件：补全 Goals、AC、Rollout 等；将 status 保持 draft 直到写完

# 自检通过，进入 ready（需 workflow 插件）
sdd review specs/active/2026-05-11-pm-login-rate-limit.md --self
```

**验收**：`sdd status` 显示该文件为 `ready`；`## Acceptance criteria` 有可测条目。

---

## 二、Dev 用例（工程规格 → 实现 → 对齐）

**目标**：在 PM 规格评审通过后，写**工程向**功能 spec（接口与组件），`approved` 后实现代码，并用 `linked_files` + 可选 `sdd diff`。

```bash
# 新建工程规格（默认 feature-spec）
sdd new login-rate-limit

# 编辑 specs/active/2026-05-11-login-rate-limit.md：
# - 从 PM 规格复制/链接结论到 Problem/Constraints
# - 写 Interfaces、Components、linked_files
# - 如需飞书元数据，可在 YAML 增加 summary/source 等（会被 CLI 保留）

# 评审链：PM/TL approved（示例：他人机器上）
sdd review specs/active/2026-05-11-login-rate-limit.md --decision approved

# 将 frontmatter status 改为 in-progress（本 CLI 无 sdd plan 命令时用手改或编辑器）

# 实现代码后更新 linked_files，接近发布前：
sdd amend specs/active/2026-05-11-login-rate-limit.md   # 若插件与 amend 流程已启用

# 若开启 diff 插件
sdd diff specs/active/2026-05-11-login-rate-limit.md
```

**验收**：存在 `approved` 的 Review Log；实现文件出现在 `linked_files`；`sdd diff` 无意外漂移（或漂移已用 amend 消化）。

---

## 三、QA 用例（检查表 → 追溯 → 签核）

**目标**：从功能 spec 派生 QA 检查表，填追溯矩阵，联调后签 off。

```bash
sdd new login-rate-limit --type qa-from-spec
# 生成：specs/active/2026-05-11-qa-login-rate-limit.md

# 编辑该文件：
# - 将 links.parent 设为功能 spec 路径（如 specs/active/2026-05-11-login-rate-limit.md）
# - 按 Traceability 表把 AC / Edge Cases 映射到用例
# - 执行测试后更新 Sign-off 表
```

**验收**：QA 文档中 `links.parent` 可点开对应功能 spec；Sign-off 有结果；必要时对功能 spec 开 `sdd review --notes` 要求补充可测性。

---

## 四、串起来的最小时间线（叙事）

1. **PM**：`feature-spec-pm` → `ready`。  
2. **评审**：对 PM 与/或工程 spec `approved`（可用 `sdd threads` 解决讨论）。  
3. **Dev**：`feature-spec` → 实现 → `sdd diff` / `amend`。  
4. **QA**：`qa-from-spec` → 追溯 → Sign-off。  
5. **收尾**：`sdd complete`（workflow）将规格归档到完成态（按团队流程执行）。

---

## 五、与分支策略的关系

- 上述命令依赖的 **`sdd` 可执行文件** 应来自 **`feature/sdd-karmastudio-pack`** 构建的 sdd-cli（见安装 Prompt），**不要**假设 `main` 已包含相同行为。  
- 业务仓库自己的分支策略与 sdd-cli 分支无关；此处仅约束 **CLI 来源分支**。
