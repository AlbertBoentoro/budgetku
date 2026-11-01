// Lets `node --test` load the app's TypeScript modules without a test
// framework:
// - .ts files: Node strips the types.
// - .tsx files: compiled here with the project's own TypeScript (JSX included),
//   because Node's type stripping does not handle JSX.
// - "@/..." resolves like the tsconfig.json path alias, and extensionless
//   imports between project files find their .ts/.tsx file.
// - "next/server"-style subpaths resolve to their .js entry, which Next's
//   package has no "exports" map for.
// - A test can import a module with "?expose=a,b" to also export the named
//   module-private functions. Next.js page files may only export `default` and
//   route config, so this is how tests reach a page's internal loaders. It only
//   changes the test copy of the module, never the source file.
import { existsSync, readFileSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = new URL("../../", import.meta.url);
const SUFFIXES = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];
const PROJECT_FILE = /\.(ts|tsx)$/;

function findFile(base) {
  for (const suffix of SUFFIXES) {
    const url = new URL(base.href + suffix);
    const file = fileURLToPath(url);
    if (existsSync(file) && statSync(file).isFile()) return url.href;
  }
  return null;
}

function splitQuery(specifier) {
  const index = specifier.indexOf("?");
  return index === -1
    ? [specifier, ""]
    : [specifier.slice(0, index), specifier.slice(index)];
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    const [path, query] = splitQuery(specifier);
    const parentPath = context.parentURL ? new URL(context.parentURL).pathname : "";

    if (path.startsWith("@/")) {
      const found = findFile(new URL(path.slice(2), root));
      if (found) return { url: found + query, shortCircuit: true };
    } else if (
      (path.startsWith("./") || path.startsWith("../")) &&
      PROJECT_FILE.test(parentPath) &&
      !/\.[cm]?[jt]sx?$/.test(path)
    ) {
      const found = findFile(new URL(path, context.parentURL));
      if (found) return { url: found + query, shortCircuit: true };
    } else if (/^next\/[\w-]+$/.test(path)) {
      return nextResolve(`${path}.js`, context);
    }
    return nextResolve(specifier, context);
  },

  load(url, context, nextLoad) {
    const parsed = new URL(url);
    const expose = parsed.searchParams.get("expose");
    const isTsx = parsed.protocol === "file:" && parsed.pathname.endsWith(".tsx");
    if (!isTsx && !expose) return nextLoad(url, context);

    const file = fileURLToPath(new URL(parsed.pathname, "file://"));
    let source = readFileSync(file, "utf8");
    if (isTsx || file.endsWith(".ts")) {
      source = ts.transpileModule(source, {
        fileName: file,
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true,
          isolatedModules: true,
        },
      }).outputText;
    }
    if (expose) {
      const names = expose.split(",").filter((n) => /^[A-Za-z_$][\w$]*$/.test(n));
      source += `\nexport { ${names.join(", ")} };\n`;
    }
    return { format: "module", source, shortCircuit: true };
  },
});
