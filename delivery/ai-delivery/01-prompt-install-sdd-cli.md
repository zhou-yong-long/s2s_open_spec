# 给 AI 的安装 Prompt（sdd-cli，**不要**用 `main`）

把下面整段复制给 IDE / Agent 作为 **用户消息** 或 **项目 onboarding 规则** 之一。目标是：在**本机**装好可执行的 `sdd`，且代码**始终**来自分支 `feature/sdd-karmastudio-pack`（该分支为交付线，**不要**合并到 `main` 也不要默认跟踪 `main` 上的发布包）。

---

## Prompt 正文（复制区开始）

你是一个负责环境准备的开发助手。请在本机安装 **SDD CLI（sdd）** 源码工作区，并满足以下**硬性约束**：

1. **仓库与分支**  
   - 若尚未克隆：克隆 `https://github.com/zhou-yong-long/s2s_open_spec.git`（或团队提供的等价 URL）到用户指定目录。  
   - 进入仓库根目录后，**必须**执行：`git fetch origin` 然后 `git checkout feature/sdd-karmastudio-pack`。  
   - **禁止**假设使用 `origin/main` 或默认分支上的代码作为安装来源；若当前在 `main`，必须切换到 `feature/sdd-karmastudio-pack` 再继续。  
   - 安装完成后用 `git branch --show-current` 确认输出为 `feature/sdd-karmastudio-pack`。

2. **依赖与构建**  
   - 需要 **Node.js**（建议 LTS）。在仓库根执行 `npm install`，再执行 `npm run build`（生成 `dist/`）。  
   - 任选一种让 `sdd` 进入 PATH 的方式（向用户说明选了哪种）：  
     - `npm link`（在仓库根）；或  
     - `npm pack` 后 `npm install -g ./sdd-cli-*.tgz`；或  
     - 在业务项目中用 `npx` 指向本仓库 `bin/sdd.js`（不推荐长期使用，仅临时）。

3. **验收**  
   - 运行 `sdd --version` 或 `sdd init --help`（或等价子命令）应成功退出。  
   - 若失败：根据错误信息修复（权限、Node 版本、路径），不要要求用户手工猜命令。

4. **说明**  
   - 向用户简短说明：交付功能在 **`feature/sdd-karmastudio-pack`**；**不要**把该线当作已发布到 `main` 的稳定版，也不要在未沟通的情况下把本地改动合并进 `main`。

请逐步执行并汇报每一步结果与最终 `sdd` 的调用方式（示例一行命令）。

## Prompt 正文（复制区结束）

---

### 给人看的备注

- 若用 **SSH**：把 clone URL 换成 `git@github.com:zhou-yong-long/s2s_open_spec.git`。  
- 若 **fork** 到自己的远端：把 URL 换成 fork，但分支名仍应为 `feature/sdd-karmastudio-pack`（或你们约定同步后的同名分支）。  
- CI / 镜像若只打 `main` 的包：**不要**用该包代表本交付线；务必从上述分支构建。
