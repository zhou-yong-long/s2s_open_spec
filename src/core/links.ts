import { readFileSync, writeFileSync, existsSync, readdirSync, realpathSync } from "fs";
import { join } from "path";
import yaml from "js-yaml";
import { parseSpec, updateFrontmatter, type Spec } from "./spec.js";
import { readConfig } from "./config.js";

// --- Data Model ---

export interface LinkType {
  name: string;
  directed: boolean;
  description: string;
}

export interface Link {
  source: string;
  target: string;
  type: string;
  note?: string;
  created: string;
}

export interface LinksData {
  version: number;
  linkTypes: LinkType[];
  links: Link[];
}

export interface SpecInfo {
  uri: string;
  filePath: string;
  domain: string | null;
  team: string | null;
  status: string;
}

const DEFAULT_LINK_TYPES: LinkType[] = [
  { name: "parent", directed: true, description: "Parent-child hierarchy" },
  { name: "child", directed: true, description: "Auto-generated reverse of parent" },
  { name: "blocks", directed: true, description: "Source must be completed before target" },
  { name: "blocked-by", directed: true, description: "Auto-generated reverse of blocks" },
  { name: "relates", directed: false, description: "Loose association between specs" },
  { name: "duplicates", directed: false, description: "Target supersedes source" },
];

const REVERSE_TYPE_MAP: Record<string, string> = {
  parent: "child",
  child: "parent",
  blocks: "blocked-by",
  "blocked-by": "blocks",
};

const LINKS_FILE = ".sdd/links.yaml";

/**
 * Normalize a file path to resolve symlinks (e.g., /tmp → /private/tmp on macOS).
 */
function normalizePath(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}

// --- URI ↔ File Path Mapping ---

/**
 * Parse a spec URI into components.
 * Format: hivemind://team/specs/domain/slug or hivemind://team/specs/slug
 */
export function parseSpecUri(uri: string): { team: string; domain: string | null; slug: string } | null {
  const match = uri.match(/^hivemind:\/\/([^/]+)\/specs(?:\/([^/]+))?\/([^/]+)$/);
  if (!match) return null;
  return {
    team: match[1],
    domain: match[2] || null,
    slug: match[3],
  };
}

/**
 * Build a spec URI from components.
 */
export function buildSpecUri(team: string, domain: string | null, slug: string): string {
  return domain ? `hivemind://${team}/specs/${domain}/${slug}` : `hivemind://${team}/specs/${slug}`;
}

/**
 * Extract slug from a spec filename (e.g., "2026-05-14-user-login.md" → "user-login").
 */
export function filenameToSlug(filename: string): string {
  return filename.replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/\.md$/, "");
}

/**
 * Extract domain from a spec file path relative to specs/active/.
 */
export function filepathToDomain(filePath: string, activeDir: string): string | null {
  const relative = filePath.replace(activeDir + "/", "");
  const parts = relative.split("/");
  if (parts.length > 1 && !parts[0].match(/^\d{4}-\d{2}-\d{2}-/)) {
    return parts[0];
  }
  return null;
}

/**
 * Scan specs/active/ and build a map of URI → file path and collect spec info.
 */
export function buildUriMap(projectRoot: string): { uriMap: Map<string, string>; specInfos: SpecInfo[] } {
  const config = readConfig(projectRoot);
  const activeDir = normalizePath(join(projectRoot, config.paths.active));
  const uriMap = new Map<string, string>();
  const specInfos: SpecInfo[] = [];

  if (!existsSync(activeDir)) return { uriMap, specInfos };

  // Try to read team from .hivemind/specs.json first
  let defaultTeam: string | null = null;
  const hiveIndexPath = join(projectRoot, ".hivemind", "specs.json");
  if (existsSync(hiveIndexPath)) {
    try {
      const hiveIndex = JSON.parse(readFileSync(hiveIndexPath, "utf-8"));
      if (hiveIndex.team) defaultTeam = hiveIndex.team;
    } catch { /* ignore */ }
  }

  const entries = readdirSync(activeDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const domain = entry.name;
      const domainDir = join(activeDir, domain);
      for (const sub of readdirSync(domainDir, { withFileTypes: true })) {
        if (sub.isFile() && sub.name.endsWith(".md")) {
          const filePath = normalizePath(join(domainDir, sub.name));
          const slug = filenameToSlug(sub.name);
          const uri = buildSpecUri("local", domain, slug);
          uriMap.set(uri, filePath);

          try {
            const spec = parseSpec(filePath);
            // Team from frontmatterExtra.team or defaultTeam
            const team = (spec.frontmatterExtra.team as string) || defaultTeam || null;
            specInfos.push({
              uri,
              filePath,
              domain,
              team,
              status: spec.frontmatter.status,
            });
          } catch {
            // Skip unparseable specs
          }
        }
      }
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      const filePath = normalizePath(join(activeDir, entry.name));
      const slug = filenameToSlug(entry.name);
      const uri = buildSpecUri("local", null, slug);
      uriMap.set(uri, filePath);

      try {
        const spec = parseSpec(filePath);
        const team = (spec.frontmatterExtra.team as string) || defaultTeam || null;
        specInfos.push({
          uri,
          filePath,
          domain: null,
          team,
          status: spec.frontmatter.status,
        });
      } catch {
        // Skip unparseable specs
      }
    }
  }

  return { uriMap, specInfos };
}

/**
 * Resolve a URI to a local file path.
 */
export function resolveUriToPath(uri: string, uriMap: Map<string, string>): string | null {
  return uriMap.get(uri) || null;
}

/**
 * Resolve a file path to a URI.
 */
export function resolvePathToUri(filePath: string, uriMap: Map<string, string>): string | null {
  const normalizedPath = normalizePath(filePath);
  for (const [uri, path] of uriMap) {
    if (path === normalizedPath) return uri;
  }
  return null;
}

// --- Links Data I/O ---

function defaultLinksData(): LinksData {
  return {
    version: 1,
    linkTypes: DEFAULT_LINK_TYPES,
    links: [],
  };
}

export function readLinks(projectRoot: string): LinksData {
  const linksPath = join(projectRoot, LINKS_FILE);
  if (!existsSync(linksPath)) return defaultLinksData();

  try {
    const raw = readFileSync(linksPath, "utf-8");
    const parsed = yaml.load(raw) as Partial<LinksData>;
    return {
      version: parsed.version ?? 1,
      linkTypes: parsed.linkTypes ?? DEFAULT_LINK_TYPES,
      links: parsed.links ?? [],
    };
  } catch {
    return defaultLinksData();
  }
}

export function writeLinks(projectRoot: string, data: LinksData): void {
  const linksPath = join(projectRoot, LINKS_FILE);
  const yamlStr = yaml.dump(data, { indent: 2, lineWidth: 120 });
  writeFileSync(linksPath, yamlStr);
}

// --- Validation ---

export function validateLinkType(data: LinksData, type: string): string | null {
  const valid = data.linkTypes.some((lt) => lt.name === type);
  return valid ? null : `Invalid link type: "${type}". Valid types: ${data.linkTypes.map((lt) => lt.name).join(", ")}`;
}

export function validateSelfLoop(source: string, target: string): string | null {
  return source === target ? "Source and target cannot be the same spec" : null;
}

export function validateDuplicate(data: LinksData, source: string, target: string, type: string): string | null {
  const exists = data.links.some(
    (l) => l.source === source && l.target === target && l.type === type
  );
  return exists ? `Link already exists: ${source} --[${type}]--> ${target}` : null;
}

export function validateSpecExists(uri: string, uriMap: Map<string, string>): string | null {
  return resolveUriToPath(uri, uriMap) ? null : `Spec not found: ${uri}`;
}

/**
 * Detect cycles in directed links using DFS.
 * Only checks explicit (forward) links, not auto-generated reverse links.
 * Returns the cycle path if found, null otherwise.
 */
export function detectCycle(links: Link[], newLink?: Link): string[] | null {
  // Only check forward link types (parent, blocks) for cycles
  // Reverse types (child, blocked-by) are auto-generated and don't create cycles
  const forwardTypes = new Set(["parent", "blocks"]);
  const allLinks = newLink ? [...links, newLink] : links;

  const filteredLinks = allLinks.filter((l) => forwardTypes.has(l.type));

  // Build adjacency list
  const adj = new Map<string, string[]>();
  for (const link of filteredLinks) {
    if (!adj.has(link.source)) adj.set(link.source, []);
    adj.get(link.source)!.push(link.target);
  }

  // DFS cycle detection
  const visited = new Set<string>();
  const recStack = new Set<string>();
  const parent = new Map<string, string>();

  function dfs(node: string): string[] | null {
    visited.add(node);
    recStack.add(node);

    for (const neighbor of adj.get(node) || []) {
      if (!visited.has(neighbor)) {
        parent.set(neighbor, node);
        const cycle = dfs(neighbor);
        if (cycle) return cycle;
      } else if (recStack.has(neighbor)) {
        // Found cycle: reconstruct path
        const cycle: string[] = [neighbor];
        let current = node;
        while (current !== neighbor) {
          cycle.push(current);
          current = parent.get(current) || current;
        }
        cycle.push(neighbor);
        return cycle.reverse();
      }
    }

    recStack.delete(node);
    return null;
  }

  for (const node of adj.keys()) {
    if (!visited.has(node)) {
      const cycle = dfs(node);
      if (cycle) return cycle;
    }
  }

  return null;
}

// --- Link Operations ---

export function getReverseType(type: string): string | null {
  return REVERSE_TYPE_MAP[type] || null;
}

/**
 * Update spec frontmatter to reflect link changes.
 *
 * Frontmatter rules:
 * - links.parent: URI of the parent spec (only one allowed)
 * - links.related: Array of URIs this spec is related to
 *
 * For parent/child relationships:
 *   parent link: source(parent) → target(child)
 *   → target.frontmatter.links.parent = source
 *   → source.frontmatter.links.related += target
 *
 * For child link (reverse of parent):
 *   child link: source(child) → target(parent)
 *   → source.frontmatter.links.parent = target
 *   → target.frontmatter.links.related += source
 *
 * For other types (relates, blocks, etc.):
 *   → Both specs add each other to links.related
 */
function updateSpecFrontmatter(
  projectRoot: string,
  uriMap: Map<string, string>,
  source: string,
  target: string,
  type: string,
  action: "add" | "remove"
): void {
  const targetPath = resolveUriToPath(target, uriMap);
  const sourcePath = resolveUriToPath(source, uriMap);

  if (type === "parent") {
    // source is parent, target is child
    if (targetPath) {
      try {
        const spec = parseSpec(targetPath);
        if (action === "add") {
          spec.frontmatter.links.parent = source;
        } else {
          // Only clear if this is the current parent
          if (spec.frontmatter.links.parent === source) {
            spec.frontmatter.links.parent = null;
          }
        }
        updateFrontmatter(targetPath, spec.frontmatter);
      } catch { /* skip */ }
    }
    if (sourcePath) {
      try {
        const spec = parseSpec(sourcePath);
        if (action === "add") {
          if (!spec.frontmatter.links.related.includes(target)) {
            spec.frontmatter.links.related.push(target);
          }
        } else {
          spec.frontmatter.links.related = spec.frontmatter.links.related.filter((r) => r !== target);
        }
        updateFrontmatter(sourcePath, spec.frontmatter);
      } catch { /* skip */ }
    }
  } else if (type === "child") {
    // source is child, target is parent (reverse of parent)
    if (sourcePath) {
      try {
        const spec = parseSpec(sourcePath);
        if (action === "add") {
          spec.frontmatter.links.parent = target;
        } else {
          if (spec.frontmatter.links.parent === target) {
            spec.frontmatter.links.parent = null;
          }
        }
        updateFrontmatter(sourcePath, spec.frontmatter);
      } catch { /* skip */ }
    }
    if (targetPath) {
      try {
        const spec = parseSpec(targetPath);
        if (action === "add") {
          if (!spec.frontmatter.links.related.includes(source)) {
            spec.frontmatter.links.related.push(source);
          }
        } else {
          spec.frontmatter.links.related = spec.frontmatter.links.related.filter((r) => r !== source);
        }
        updateFrontmatter(targetPath, spec.frontmatter);
      } catch { /* skip */ }
    }
  } else {
    // For all other types (relates, blocks, blocked-by, duplicates):
    // Both specs add each other to links.related
    if (sourcePath) {
      try {
        const spec = parseSpec(sourcePath);
        if (action === "add") {
          if (!spec.frontmatter.links.related.includes(target)) {
            spec.frontmatter.links.related.push(target);
          }
        } else {
          spec.frontmatter.links.related = spec.frontmatter.links.related.filter((r) => r !== target);
        }
        updateFrontmatter(sourcePath, spec.frontmatter);
      } catch { /* skip */ }
    }
    if (targetPath) {
      try {
        const spec = parseSpec(targetPath);
        if (action === "add") {
          if (!spec.frontmatter.links.related.includes(source)) {
            spec.frontmatter.links.related.push(source);
          }
        } else {
          spec.frontmatter.links.related = spec.frontmatter.links.related.filter((r) => r !== source);
        }
        updateFrontmatter(targetPath, spec.frontmatter);
      } catch { /* skip */ }
    }
  }
}

export function addLink(
  projectRoot: string,
  source: string,
  target: string,
  type: string,
  note?: string
): { success: boolean; error?: string } {
  const data = readLinks(projectRoot);
  const { uriMap } = buildUriMap(projectRoot);

  // Validation
  const typeError = validateLinkType(data, type);
  if (typeError) return { success: false, error: typeError };

  const selfLoopError = validateSelfLoop(source, target);
  if (selfLoopError) return { success: false, error: selfLoopError };

  const sourceError = validateSpecExists(source, uriMap);
  if (sourceError) return { success: false, error: sourceError };

  const targetError = validateSpecExists(target, uriMap);
  if (targetError) return { success: false, error: targetError };

  const dupError = validateDuplicate(data, source, target, type);
  if (dupError) return { success: false, error: dupError };

  // Cycle detection for directed links
  const linkType = data.linkTypes.find((lt) => lt.name === type);
  if (linkType?.directed) {
    const newLink: Link = { source, target, type, created: new Date().toISOString().slice(0, 10) };
    const cycle = detectCycle(data.links, newLink);
    if (cycle) {
      return { success: false, error: `Adding this link would create a cycle: ${cycle.join(" → ")}` };
    }
  }

  // Add link
  const link: Link = {
    source,
    target,
    type,
    note,
    created: new Date().toISOString().slice(0, 10),
  };
  data.links.push(link);

  // Auto-add reverse link for directed types
  const reverseType = getReverseType(type);
  if (reverseType) {
    data.links.push({
      source: target,
      target: source,
      type: reverseType,
      note,
      created: link.created,
    });
  }

  writeLinks(projectRoot, data);

  // Update frontmatter (one call is enough - the handler updates both specs)
  updateSpecFrontmatter(projectRoot, uriMap, source, target, type, "add");

  return { success: true };
}

export function removeLink(
  projectRoot: string,
  source: string,
  target: string,
  type?: string
): { success: boolean; error?: string; removed: number } {
  const data = readLinks(projectRoot);
  const { uriMap } = buildUriMap(projectRoot);

  const beforeCount = data.links.length;

  if (type) {
    // Remove specific type and its reverse
    data.links = data.links.filter(
      (l) => !(l.source === source && l.target === target && l.type === type)
    );
    const reverseType = getReverseType(type);
    if (reverseType) {
      data.links = data.links.filter(
        (l) => !(l.source === target && l.target === source && l.type === reverseType)
      );
    }
  } else {
    // Remove all links between source and target
    data.links = data.links.filter(
      (l) => !(l.source === source && l.target === target) && !(l.source === target && l.target === source)
    );
  }

  const removed = beforeCount - data.links.length;
  if (removed === 0) {
    return { success: false, error: "Link not found", removed: 0 };
  }

  writeLinks(projectRoot, data);

  // Update frontmatter (one call is enough - the handler updates both specs)
  if (type) {
    updateSpecFrontmatter(projectRoot, uriMap, source, target, type, "remove");
  } else {
    // Remove all link types from frontmatter
    // Only need to call for forward types since the handler updates both specs
    updateSpecFrontmatter(projectRoot, uriMap, source, target, "parent", "remove");
    updateSpecFrontmatter(projectRoot, uriMap, source, target, "blocks", "remove");
    updateSpecFrontmatter(projectRoot, uriMap, source, target, "relates", "remove");
    updateSpecFrontmatter(projectRoot, uriMap, source, target, "duplicates", "remove");
  }

  return { success: true, removed };
}

export interface LinkQuery {
  specUri?: string;
  type?: string;
  direction?: "in" | "out" | "all";
}

export function queryLinks(projectRoot: string, query: LinkQuery = {}): Link[] {
  const data = readLinks(projectRoot);
  let results = data.links;

  if (query.specUri) {
    const dir = query.direction || "all";
    if (dir === "in") {
      results = results.filter((l) => l.target === query.specUri);
    } else if (dir === "out") {
      results = results.filter((l) => l.source === query.specUri);
    } else {
      results = results.filter((l) => l.source === query.specUri || l.target === query.specUri);
    }
  }

  if (query.type) {
    results = results.filter((l) => l.type === query.type);
  }

  return results;
}

// --- Implicit Links ---

/**
 * Calculate implicit links between specs in the same team or domain.
 */
export function calculateImplicitLinks(specs: SpecInfo[]): Link[] {
  const implicit: Link[] = [];
  const today = new Date().toISOString().slice(0, 10);

  for (let i = 0; i < specs.length; i++) {
    for (let j = i + 1; j < specs.length; j++) {
      const a = specs[i];
      const b = specs[j];

      const sameTeam = a.team && b.team && a.team === b.team;
      const sameDomain = a.domain && b.domain && a.domain === b.domain;

      if (sameTeam || sameDomain) {
        implicit.push({
          source: a.uri,
          target: b.uri,
          type: "relates",
          note: `Implicit: same ${sameDomain ? "domain" : "team"}`,
          created: today,
        });
      }
    }
  }

  return implicit;
}

// --- Sync Frontmatter ---

/**
 * Rebuild all spec frontmatter.links from links.yaml.
 */
export function syncFrontmatter(projectRoot: string): { synced: number; errors: string[] } {
  const data = readLinks(projectRoot);
  const { uriMap } = buildUriMap(projectRoot);
  const errors: string[] = [];
  let synced = 0;

  // Clear all frontmatter links first
  for (const [uri, filePath] of uriMap) {
    try {
      const spec = parseSpec(filePath);
      spec.frontmatter.links.parent = null;
      spec.frontmatter.links.related = [];
      updateFrontmatter(filePath, spec.frontmatter);
    } catch (e) {
      errors.push(`Failed to clear frontmatter for ${uri}: ${e}`);
    }
  }

  // Rebuild from links.yaml
  for (const link of data.links) {
    try {
      updateSpecFrontmatter(projectRoot, uriMap, link.source, link.target, link.type, "add");
      synced++;
    } catch (e) {
      errors.push(`Failed to sync link ${link.source} -> ${link.target}: ${e}`);
    }
  }

  return { synced, errors };
}

// --- Links Index for Hive Mind ---

export interface LinksIndex {
  version: number;
  links: Link[];
}

export function buildLinksIndex(projectRoot: string): LinksIndex {
  const data = readLinks(projectRoot);
  return {
    version: data.version,
    links: data.links,
  };
}

// --- Consistency Check ---

export interface ConsistencyResult {
  consistent: boolean;
  issues: string[];
}

export function checkConsistency(projectRoot: string): ConsistencyResult {
  const data = readLinks(projectRoot);
  const { uriMap } = buildUriMap(projectRoot);
  const issues: string[] = [];

  // Check for orphan links
  for (const link of data.links) {
    if (!resolveUriToPath(link.source, uriMap)) {
      issues.push(`Orphan link: source ${link.source} does not exist`);
    }
    if (!resolveUriToPath(link.target, uriMap)) {
      issues.push(`Orphan link: target ${link.target} does not exist`);
    }
  }

  // Check frontmatter consistency
  for (const [uri, filePath] of uriMap) {
    try {
      const spec = parseSpec(filePath);

      // Check links.parent
      const parentLinks = data.links.filter(
        (l) => (l.type === "parent" && l.target === uri) || (l.type === "child" && l.source === uri)
      );
      const expectedParent = parentLinks.length > 0 ? parentLinks[0].source : null;
      if (spec.frontmatter.links.parent !== expectedParent) {
        issues.push(`Frontmatter mismatch for ${uri}: links.parent should be ${expectedParent || "null"}, got ${spec.frontmatter.links.parent}`);
      }

      // Check links.related
      const relatedLinks = data.links.filter(
        (l) => l.source === uri || l.target === uri
      );
      const expectedRelated = new Set<string>();
      for (const link of relatedLinks) {
        if (link.source === uri) expectedRelated.add(link.target);
        if (link.target === uri) expectedRelated.add(link.source);
      }
      const actualRelated = new Set(spec.frontmatter.links.related);
      if (expectedRelated.size !== actualRelated.size || ![...expectedRelated].every((r) => actualRelated.has(r))) {
        issues.push(`Frontmatter mismatch for ${uri}: links.related mismatch`);
      }
    } catch {
      // Skip unparseable specs
    }
  }

  return {
    consistent: issues.length === 0,
    issues,
  };
}
