# SDD / sdd-cli 交付文件夹

本目录为**对外交付的一站式副本**：安装方式、常用命令、AI Prompt、KarmaStudio 集成说明、以及离线 `.tgz` 专用说明。

| 文件 / 目录 | 说明 |
|-------------|------|
| [INSTALL.md](./INSTALL.md) | **安装总览**（离线 zip、单独 tgz、Git 分支三种方式 + 分支约束） |
| [USAGE.md](./USAGE.md) | **使用说明**（常用命令、`sdd new --type`、插件与生命周期） |
| [INSTALL-OFFLINE-TGZ.md](./INSTALL-OFFLINE-TGZ.md) | 仅针对 `sdd-cli-*.tgz` / 外层离线 zip 内安装步骤（由脚本同步自 `scripts/bundle-INSTALL.md`） |
| [karmastudio-sdd-delivery.md](./karmastudio-sdd-delivery.md) | KarmaStudio / 飞书 / Open Spec 对齐（与 `docs/` 同步） |
| [ai-delivery/](./ai-delivery/) | 给 AI 的安装 Prompt、IDE 集成 Prompt、PM/Dev/QA 全链路示例、补充清单（与 `docs/ai-delivery/` 同步） |

## 维护方式

在仓库根执行（会覆盖 `ai-delivery/`、`karmastudio-sdd-delivery.md`、`INSTALL-OFFLINE-TGZ.md`，**不会**覆盖本 `README.md`、`INSTALL.md`、`USAGE.md`）：

```bash
npm run delivery:sync
```

改完 `docs/ai-delivery/` 或 `docs/karmastudio-sdd-delivery.md` 后请记得执行上述命令，再提交 `delivery/`。

## 与离线 zip / npm 包的关系

- 执行 `npm run bundle` 打出的 **`release/sdd-cli-offline-*.zip`** 内会附带本 **`delivery/`** 目录副本。
- 发布用 **`npm pack` 生成的 `.tgz`** 内含 **`delivery/`**（不再重复打包 `docs/`，避免与 `delivery/` 镜像重复）；安装后路径示例：`node_modules/sdd-cli/delivery/README.md`。
