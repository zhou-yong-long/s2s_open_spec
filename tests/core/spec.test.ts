import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { parseSpec, updateFrontmatter, appendChangelog, appendReviewLog, appendReviewThread, resolveThread, getOpenThreads, parseReviewThreads } from "../../src/core/spec.js";
import { writeFileSync, mkdirSync, rmSync, readFileSync } from "fs";
import { join } from "path";

const testDir = join(process.cwd(), "tests/fixtures/spec-test");

function makeSpec(content: string) {
  const dir = join(testDir, "specs/active");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "2026-05-01-test.md");
  writeFileSync(path, content);
  return path;
}

beforeEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("parseSpec", () => {
  it("parses YAML frontmatter and body", () => {
    const path = makeSpec(`---
status: draft
author: wade
created: 2026-05-01
domain: auth
tags: [api, login]
links:
  parent: null
  related: []
pinned_commit: null
linked_files: []
---

# Test Spec

## Problem
Something needs fixing.
`);

    const spec = parseSpec(path);
    expect(spec.frontmatter.status).toBe("draft");
    expect(spec.frontmatter.author).toBe("wade");
    expect(spec.frontmatter.domain).toBe("auth");
    expect(spec.frontmatter.tags).toEqual(["api", "login"]);
    expect(spec.body).toContain("Something needs fixing");
  });

  it("uses defaults for missing frontmatter fields", () => {
    const path = makeSpec(`---
status: draft
---

# Minimal
`);
    const spec = parseSpec(path);
    expect(spec.frontmatter.author).toBe("");
    expect(spec.frontmatter.domain).toBeNull();
    expect(spec.frontmatter.tags).toEqual([]);
  });
});

describe("appendReviewLog", () => {
  it("appends a row to the Review Log table", () => {
    const path = makeSpec(`---
status: ready
author: wade
created: 2026-05-01
domain: null
tags: []
links:
  parent: null
  related: []
pinned_commit: null
linked_files: []
---

# Test

## Review Log
| Date | Reviewer | Decision | Notes |
|------|----------|----------|-------|

## Changelog
| Date | Change | Author |
|------|--------|--------|
`);

    appendReviewLog(path, {
      date: "2026-05-06",
      reviewer: "zhangsan",
      decision: "changes-requested",
      notes: "补充错误处理",
    });

    const content = readFileSync(path, "utf-8");
    expect(content).toContain("| 2026-05-06 | zhangsan | changes-requested | 补充错误处理 |");
  });

  it("creates Review Log section if missing", () => {
    const path = makeSpec(`---
status: ready
author: wade
created: 2026-05-01
domain: null
tags: []
links:
  parent: null
  related: []
pinned_commit: null
linked_files: []
---

# Test
`);

    appendReviewLog(path, {
      date: "2026-05-06",
      reviewer: "lisi",
      decision: "approved",
      notes: "LGTM",
    });

    const content = readFileSync(path, "utf-8");
    expect(content).toContain("## Review Log");
    expect(content).toContain("| 2026-05-06 | lisi | approved | LGTM |");
  });
});

describe("appendReviewThread", () => {
  it("creates a review thread with [ ] (open) marker", () => {
    const path = makeSpec(`---
status: ready
author: wade
created: 2026-05-01
domain: null
tags: []
links:
  parent: null
  related: []
pinned_commit: null
linked_files: []
---

# Test

## Review Threads

## Changelog
| Date | Change | Author |
|------|--------|--------|
`);

    appendReviewThread(path, {
      title: "补充并发场景",
      reviewer: "zhangsan",
      created: "2026-05-06",
      section: "Edge Cases",
      comment: "没有考虑并发写入的竞态条件",
    });

    const content = readFileSync(path, "utf-8");
    expect(content).toContain("### [ ] 补充并发场景");
    expect(content).toContain("**Reviewer:** zhangsan");
    expect(content).toContain("> 没有考虑并发写入的竞态条件");
  });

  it("appends thread after existing threads", () => {
    const path = makeSpec(`---
status: ready
author: wade
created: 2026-05-01
domain: null
tags: []
links:
  parent: null
  related: []
pinned_commit: null
linked_files: []
---

# Test

## Review Threads

### [x] 已解决的评论
**Reviewer:** zhangsan | **Created:** 2026-05-05 | **Section:** General
> 已处理

## Changelog
| Date | Change | Author |
|------|--------|--------|
`);

    appendReviewThread(path, {
      title: "新评论",
      reviewer: "lisi",
      created: "2026-05-06",
      section: "Interfaces",
      comment: "接口缺少认证参数",
    });

    const content = readFileSync(path, "utf-8");
    const threads = parseReviewThreads(content);
    expect(threads).toHaveLength(2);
    expect(threads[0].resolved).toBe(true);
    expect(threads[1].resolved).toBe(false);
    expect(threads[1].title).toBe("新评论");
  });
});

describe("parseReviewThreads", () => {
  it("parses resolved and open threads", () => {
    const body = `
## Review Threads

### [x] 已解决
**Reviewer:** zhangsan | **Created:** 2026-05-05 | **Section:** General
> 修改完成

**Response (2026-05-06):** 已处理

### [ ] 待处理
**Reviewer:** lisi | **Created:** 2026-05-06 | **Section:** Interfaces
> 缺少参数定义

## Changelog
`;

    const threads = parseReviewThreads(body);
    expect(threads).toHaveLength(2);
    expect(threads[0].resolved).toBe(true);
    expect(threads[0].title).toBe("已解决");
    expect(threads[0].response).toBe("已处理");
    expect(threads[1].resolved).toBe(false);
    expect(threads[1].title).toBe("待处理");
    expect(threads[1].section).toBe("Interfaces");
  });

  it("returns empty array for no Review Threads section", () => {
    const threads = parseReviewThreads("# Test\n\nNo threads here.");
    expect(threads).toEqual([]);
  });
});

describe("getOpenThreads", () => {
  it("returns only unresolved threads", () => {
    const path = makeSpec(`---
status: ready
author: wade
created: 2026-05-01
domain: null
tags: []
links:
  parent: null
  related: []
pinned_commit: null
linked_files: []
---

# Test

## Review Threads

### [x] Done
**Reviewer:** a | **Created:** 2026-05-05 | **Section:** A
> done

### [ ] Open1
**Reviewer:** b | **Created:** 2026-05-06 | **Section:** B
> open issue

### [ ] Open2
**Reviewer:** c | **Created:** 2026-05-06 | **Section:** C
> another issue

## Changelog
`);

    const open = getOpenThreads(path);
    expect(open).toHaveLength(2);
    expect(open[0].title).toBe("Open1");
    expect(open[1].title).toBe("Open2");
  });

  it("returns empty when all resolved", () => {
    const path = makeSpec(`---
status: ready
author: wade
created: 2026-05-01
domain: null
tags: []
links:
  parent: null
  related: []
pinned_commit: null
linked_files: []
---

# Test

## Review Threads

### [x] All done
**Reviewer:** a | **Created:** 2026-05-05 | **Section:** A
> done

## Changelog
`);

    expect(getOpenThreads(path)).toEqual([]);
  });
});

describe("resolveThread", () => {
  it("marks a thread as resolved with response", () => {
    const path = makeSpec(`---
status: ready
author: wade
created: 2026-05-01
domain: null
tags: []
links:
  parent: null
  related: []
pinned_commit: null
linked_files: []
---

# Test

## Review Threads

### [ ] 补充测试
**Reviewer:** zhangsan | **Created:** 2026-05-06 | **Section:** Edge Cases
> 需要补充并发测试

## Changelog
`);

    const result = resolveThread(path, 0, "已补充并发测试");
    expect(result).toBe(true);

    const content = readFileSync(path, "utf-8");
    expect(content).toContain("### [x] 补充测试");
    expect(content).toContain("**Response (2026");
    expect(getOpenThreads(path)).toEqual([]);
  });

  it("returns false for invalid index", () => {
    const path = makeSpec(`---
status: ready
author: wade
created: 2026-05-01
domain: null
tags: []
links:
  parent: null
  related: []
pinned_commit: null
linked_files: []
---

# Test
`);

    expect(resolveThread(path, 99, "no")).toBe(false);
  });
});

describe("parseSpec with review threads", () => {
  it("parses review threads from spec file", () => {
    const path = makeSpec(`---
status: approved
author: wade
created: 2026-05-01
domain: null
tags: []
links:
  parent: null
  related: []
pinned_commit: null
linked_files: []
---

# Test

## Review Threads

### [x] Done
**Reviewer:** zhangsan | **Created:** 2026-05-05 | **Section:** General
> good

### [ ] Open issue
**Reviewer:** lisi | **Created:** 2026-05-06 | **Section:** Interfaces
> needs work
`);

    const spec = parseSpec(path);
    expect(spec.reviewThreads).toHaveLength(2);
    expect(spec.reviewThreads[0].resolved).toBe(true);
    expect(spec.reviewThreads[1].resolved).toBe(false);
  });
});

describe("updateFrontmatter", () => {
  it("updates a frontmatter field and writes back", () => {
    const path = makeSpec(`---
status: draft
author: wade
created: 2026-05-01
domain: null
tags: []
links:
  parent: null
  related: []
pinned_commit: null
linked_files: []
---

# Test
`);
    updateFrontmatter(path, { status: "approved", pinned_commit: "def456" });
    const reread = parseSpec(path);
    expect(reread.frontmatter.status).toBe("approved");
    expect(reread.frontmatter.pinned_commit).toBe("def456");
    expect(reread.frontmatter.author).toBe("wade");
  });
});
