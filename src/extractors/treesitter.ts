import * as TreeSitter from "web-tree-sitter";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
let parser: TreeSitter.Parser | null = null;
let initialized = false;
const languages = new Map<string, TreeSitter.Language>();

async function ensureInitialized() {
  if (initialized) return;
  const wasmPath = join(__dirname, "..", "..", "node_modules", "web-tree-sitter", "web-tree-sitter.wasm");
  await TreeSitter.Parser.init({ locateFile: () => wasmPath });
  parser = new TreeSitter.Parser();
  initialized = true;
}

export async function getParser(): Promise<TreeSitter.Parser> {
  await ensureInitialized();
  return parser!;
}

export async function getLanguage(langName: "python" | "java" | "go"): Promise<TreeSitter.Language> {
  if (languages.has(langName)) {
    return languages.get(langName)!;
  }

  const grammarPkg = `tree-sitter-${langName}`;
  const wasmPath = require.resolve(`${grammarPkg}/tree-sitter-${langName}.wasm`);
  const lang = await TreeSitter.Language.load(wasmPath);
  languages.set(langName, lang);
  return lang;
}

export async function parseSource(langName: "python" | "java" | "go", source: string): Promise<TreeSitter.Tree> {
  const parser = await getParser();
  const lang = await getLanguage(langName);
  parser.setLanguage(lang);
  return parser.parse(source);
}
