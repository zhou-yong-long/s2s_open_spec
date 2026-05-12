# sdd-cli 安装说明

## 交付线与分支（必读）

本交付线的功能与文档以 Git 分支 **`main`** 为准。

---

## 方式一：离线 zip（推荐，无需 GitHub 写权限）

1. 取得 **`sdd-cli-offline-*.zip`**（由维护者在仓库根执行 `npm run bundle` 生成，位于 `release/`）。
2. 解压后可见：
   - **`sdd-cli-0.1.0.tgz`** — 已含编译产物 `dist/`，**无需**全局安装 `tsx`。
   - **`INSTALL-OFFLINE-TGZ.md`** — 与下述「方式二」相同，针对 tgz 的一步安装。
   - **`delivery/`** — 本交付文件夹副本（安装说明、AI Prompt、USAGE 等）。
   - **`*-full-source.zip`**（可选）— 含 `src/`、`tests/`，便于二次开发。

全局安装：

```bash
cd <解压目录>
npm install -g ./sdd-cli-0.1.0.tgz
sdd --version
```

权限问题可配置 npm 前缀到用户目录（例如 `npm config set prefix ~/.local` 并将 `bin` 加入 `PATH`）。

---

## 方式二：仅持有 `.tgz` 文件

若只有 **`sdd-cli-0.1.0.tgz`**（无外层 zip），步骤与 [INSTALL-OFFLINE-TGZ.md](./INSTALL-OFFLINE-TGZ.md) 中「方式 A」一致：

```bash
npm install -g ./sdd-cli-0.1.0.tgz
```

---

## 方式三：从 Git 源码安装（有读权限时）

```bash
git clone <仓库 URL> s2s_open_spec
cd s2s_open_spec
npm install
npm run build
npm link
```

开发调试可用 `npm run dev -- <子命令>`（不经 `dist`）。

---

## 安装后：在业务仓库启用 SDD

```bash
cd /path/to/your-app
sdd init
```

默认已开启所有插件（`workflow`、`diff`、`doctor`、`board`）。如需关闭，编辑 `.sdd/config.yaml`。详见 [USAGE.md](./USAGE.md)。

---

## AI 辅助安装

将 [ai-delivery/01-prompt-install-sdd-cli.md](./ai-delivery/01-prompt-install-sdd-cli.md) 整段复制给 IDE Agent，可让其按步骤完成克隆、切分支、构建与校验。
