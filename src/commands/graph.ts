import type { CommandModule, Argv } from "yargs";
import chalk from "chalk";
import { readLinks, buildUriMap, parseSpecUri, SpecInfo, Link } from "../core/links.js";

interface GraphArgs {
  format?: "ascii" | "dot";
  type?: string;
  team?: string;
  domain?: string;
}

export const graphCommand: CommandModule<{}, GraphArgs> = {
  command: "graph",
  describe: "Visualize spec links as a graph",
  builder: (yargs: Argv<{}>): Argv<GraphArgs> =>
    yargs
      .option("format", {
        type: "string",
        choices: ["ascii", "dot"],
        default: "ascii",
        describe: "Output format: ascii (terminal) or dot (Graphviz)",
      })
      .option("type", {
        type: "string",
        describe: "Filter by link type",
      })
      .option("team", {
        type: "string",
        describe: "Filter by team",
      })
      .option("domain", {
        type: "string",
        describe: "Filter by domain",
      }) as Argv<GraphArgs>,
  handler: (argv) => {
    const cwd = process.cwd();
    const data = readLinks(cwd);
    const { uriMap, specInfos } = buildUriMap(cwd);

    // Filter links by type
    let links = data.links;
    if (argv.type) {
      links = links.filter((l) => l.type === argv.type);
    }

    // Filter specs by team/domain
    let filteredSpecs = specInfos;
    if (argv.team) {
      filteredSpecs = filteredSpecs.filter((s) => s.team === argv.team);
    }
    if (argv.domain) {
      filteredSpecs = filteredSpecs.filter((s) => s.domain === argv.domain);
    }

    const filteredUris = new Set(filteredSpecs.map((s) => s.uri));

    // Filter links to only include filtered specs
    links = links.filter((l) => filteredUris.has(l.source) && filteredUris.has(l.target));

    if (argv.format === "dot") {
      console.log(generateDot(links, specInfos));
    } else {
      console.log(generateAscii(links, specInfos));
    }
  },
};

function generateDot(links: Link[], specInfos: SpecInfo[]): string {
  const lines = ["digraph specs {", '  rankdir=LR;', '  node [shape=box, style=filled, fillcolor="#f3f4f6"];', ""];

  // Add nodes
  for (const spec of specInfos) {
    const parsed = parseSpecUri(spec.uri);
    const label = parsed?.slug || spec.uri;
    lines.push(`  "${spec.uri}" [label="${label}"];`);
  }

  lines.push("");

  // Add edges
  for (const link of links) {
    const style = link.type === "relates" || link.type === "duplicates" ? "dir=none" : "dir=forward";
    const color = link.type === "blocks" || link.type === "blocked-by"
      ? "#eab308"
      : link.type === "parent" || link.type === "child"
        ? "#06b6d4"
        : "#6b7280";
    lines.push(`  "${link.source}" -> "${link.target}" [${style}, color="${color}", label="${link.type}"];`);
  }

  lines.push("}");
  return lines.join("\n");
}

function generateAscii(links: Link[], specInfos: SpecInfo[]): string {
  if (links.length === 0) {
    return chalk.gray("No links to display");
  }

  const lines: string[] = [];
  lines.push(chalk.bold("Spec Links Graph\n"));

  // Build adjacency list
  const adj = new Map<string, { target: string; type: string; note?: string }[]>();
  for (const link of links) {
    if (!adj.has(link.source)) adj.set(link.source, []);
    adj.get(link.source)!.push({ target: link.target, type: link.type, note: link.note });
  }

  // Find root nodes (nodes with no incoming links via forward types)
  const forwardTypes = new Set(["parent", "blocks"]);
  const hasIncoming = new Set<string>();
  for (const link of links) {
    if (forwardTypes.has(link.type)) {
      hasIncoming.add(link.target);
    }
  }
  const roots = [...adj.keys()].filter((n) => !hasIncoming.has(n));

  // If no roots, use all nodes
  const startNodes = roots.length > 0 ? roots : [...adj.keys()];

  // Track globally rendered nodes to avoid duplicate subtrees
  const globalRendered = new Set<string>();

  function renderNode(uri: string, prefix: string, isLast: boolean, ancestors: Set<string>) {
    const parsed = parseSpecUri(uri);
    const label = parsed?.slug || uri;
    const connector = isLast ? "└─ " : "├─ ";

    // Check for actual cycle (node appears in current path)
    if (ancestors.has(uri)) {
      lines.push(`${prefix}${connector}${chalk.red("⚠ circular")}`);
      return;
    }

    // Check if already rendered in another branch
    if (globalRendered.has(uri)) {
      lines.push(`${prefix}${connector}${chalk.dim("… " + label + " (see above)")}`);
      return;
    }

    globalRendered.add(uri);
    const newAncestors = new Set(ancestors);
    newAncestors.add(uri);

    lines.push(`${prefix}${connector}${label}`);

    const children = adj.get(uri) || [];
    const childPrefix = prefix + (isLast ? "   " : "│  ");

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const childIsLast = i === children.length - 1;
      const arrow = child.type === "relates" || child.type === "duplicates" ? "───" : "──→";
      const typeColor = child.type === "blocks" || child.type === "blocked-by"
        ? chalk.yellow
        : child.type === "parent" || child.type === "child"
          ? chalk.cyan
          : chalk.white;
      lines.push(`${childPrefix}${typeColor(`[${child.type}] ${arrow}`)}`);
      renderNode(child.target, childPrefix, childIsLast, newAncestors);
    }
  }

  for (let i = 0; i < startNodes.length; i++) {
    renderNode(startNodes[i], "", i === startNodes.length - 1, new Set());
  }

  return lines.join("\n");
}
