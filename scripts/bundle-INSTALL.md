# sdd-cli 离线安装包使用说明

若你拿到的是外层的 **`sdd-cli-offline-*.zip`**：先解压，再使用其中的 **`sdd-cli-0.1.0.tgz`** 与 **`INSTALL.md`**（本文件解压后可能名为 `INSTALL.md`）。

其中的 **`sdd-cli-0.1.0.tgz`** 在打包时已执行过 `npm run build`，内含 **`dist/`** 编译结果，安装后 **无需** `tsx` 即可运行 `sdd`。

## 方式 A：全局安装（推荐）

```bash
npm install -g ./sdd-cli-0.1.0.tgz
sdd --version
# 或
sdd init --help
```

若遇权限问题，可配置 npm 全局前缀到用户目录（`npm config set prefix ~/.local` 等）后再试。

## 方式 B：仅解压源码 zip（需要 Node + 自己构建）

若你拿到的是带完整 Git 历史的 **source zip**（见打包容器内的 `*-full-source.zip`）：

```bash
unzip sdd-cli-*-full-source.zip -d sdd-cli
cd sdd-cli
npm install
npm run build
npm link
```

## 在业务仓库里使用

```bash
cd /path/to/your-app
sdd init
```

## 交付线分支说明

本包由分支 **`feature/sdd-karmastudio-pack`** 构建；与 `main` 可能不一致。AI 安装 Prompt 见包内 **`docs/ai-delivery/01-prompt-install-sdd-cli.md`**（解压 tgz 或 source zip 后路径相同）。

## 版本

- 包名：`sdd-cli`
- 版本：见 `package.json` 的 `version` 字段（当前 tarball 文件名中的 `0.1.0`）
