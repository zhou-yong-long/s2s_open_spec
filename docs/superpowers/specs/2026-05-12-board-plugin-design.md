# Board Plugin Design

**Status:** draft
**Author:** wade
**Created:** 2026-05-12

## Problem

SDD 用户需要快速查看所有活跃 spec 的全局视图。当前 `sdd status` 只提供列表，缺少按状态分列的看板视图。设计文档中规划了 `board` 插件但未实现。

## Constraints

- 零外部依赖（不引入新 npm 包）
- 终端模式默认，浏览器模式通过 `--ui` 触发
- 浏览器模式只读，无需交互
- 与现有 `readConfig`、`parseSpec` 等 core 模块复用
- 支持 `--domain`、`--author` 过滤
- 终端宽度适配（80 列可用）

## Design

### Architecture

```
src/plugins/board.ts
├── scanSpecs(cwd, config) → BoardSpec[]
├── renderTerminal(specs, options) → void
└── renderUI(specs, options) → void
```

- `scanSpecs`: 从 `config.paths.active` 递归扫描所有 `.md` 文件，解析 frontmatter，返回 `BoardSpec[]`
- `renderTerminal`: 终端表格渲染，按 status 分列输出
- `renderUI`: 启动本地 HTTP 服务，生成 HTML 看板，自动打开浏览器

### Data Model

```typescript
interface BoardSpec {
  fileName: string;
  title: string;
  status: SpecStatus;
  author: string;
  domain: string | null;
  created: string;
  tags: string[];
}

type BoardColumn = {
  status: SpecStatus;
  label: string;
  colorFn: (text: string) => string;
  specs: BoardSpec[];
};
```

### Terminal Mode

**命令：** `sdd board`

**输出格式：** 5 列固定布局

```
┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐
│   draft     │   ready     │  approved   │ in-progress │  complete   │
├─────────────┼─────────────┼─────────────┼─────────────┼─────────────┤
│ spec-a      │ spec-b      │ spec-c      │ spec-d      │ spec-e      │
│ @author     │ @author     │ @author     │ @author     │ @author     │
│             │             │             │             │             │
│ spec-f      │             │             │             │             │
│ @author     │             │             │             │             │
└─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘

Total: 6 specs | draft: 2 | ready: 1 | approved: 1 | in-progress: 1 | complete: 1
```

**列宽策略：** 终端宽度 / 5，最小 14 字符。超出截断 + `…`。

**着色：**
- draft: gray
- ready: cyan
- approved: green
- in-progress: yellow
- complete: dim gray

**过滤选项：**
- `--domain <name>` — 只显示指定 domain
- `--author <name>` — 只显示指定作者
- `--wide` — 显示 created date 和 tags
- `--status <status>` — 只显示指定状态

### Browser Mode

**命令：** `sdd board --ui`

**实现：**
- 使用 Node.js 内置 `http.createServer` 启动本地服务（随机端口 0，获取实际端口）
- 生成纯 HTML 页面，内嵌 CSS，无外部资源依赖
- 使用 `open` 模块或 `child_process.exec('open <url>')` 自动打开浏览器
- 服务在收到 `/` 请求后保持运行，Ctrl+C 关闭

**页面布局：**
- 顶部：标题 + 搜索框（JS 实时过滤）
- 主体：5 列 flex 布局，每列一个 status
- 卡片：圆角矩形，显示 title、author、domain badge、created date、tags
- 空列显示 "No specs" 占位

**HTML 生成策略：** 模板字符串拼接，不依赖模板引擎。CSS 内嵌 `<style>` 标签。

**自关闭机制：** 页面加载后 5 分钟无请求自动关闭服务，或用户 Ctrl+C。

### Integration

**插件注册：** 在 `src/plugins/loader.ts` 中添加：

```typescript
if (plugins.board) {
  const p = await import("./board.js");
  commands.push(...Object.values(p.default.commands));
}
```

**配置：** `scaffold/.sdd/config.yaml` 和 `defaultConfig` 中 `board: true`。

### Error Handling

- 无活跃 spec：显示 "No active specs found" 并退出
- active 目录不存在：同无活跃 spec 处理
- 浏览器模式端口冲突：重试最多 5 次，每次端口 +1
- HTML 生成失败：降级到终端模式并提示

### Testing

- `scanSpecs`: 模拟 active 目录，验证解析正确
- `renderTerminal`: 验证列宽截断、着色、过滤
- `renderUI`: 验证 HTML 包含所有 spec 数据
- 空目录边界情况
