// Requires `await connection()` as the first statement of any function that
// creates the Supabase server client in render code (pages, layouts, server
// components).
//
// Why: with `partialPrefetching: true`, Next.js rejects Date.now() and
// new Date() in every render stage before the request-time stage. The Supabase
// client reads the clock (session expiry) as soon as it is created, so it must
// be created after connection(). Requiring connection() first also keeps URL
// reads and current-month helpers, which can read the clock, behind it. See
// app/(app)/dashboard/page.tsx for the pattern.
//
// Server actions ("use server") are skipped: they only run on a real request.

const SERVER_CLIENT_MODULE = "@/lib/supabase/server";

function isFunctionNode(node) {
  return (
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression" ||
    node.type === "ArrowFunctionExpression"
  );
}

function enclosingFunction(node) {
  for (let current = node.parent; current; current = current.parent) {
    if (isFunctionNode(current)) return current;
  }
  return null;
}

function hasUseServerDirective(statements) {
  return statements.some(
    (statement) =>
      statement.type === "ExpressionStatement" &&
      statement.directive === "use server",
  );
}

function importedName(specifier) {
  return specifier.imported.type === "Identifier"
    ? specifier.imported.name
    : specifier.imported.value;
}

const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require `await connection()` before creating the Supabase server client in render code.",
    },
    messages: {
      missing:
        "Make `await connection()` (next/server) the first statement of this function before calling {{name}}(). The Supabase client reads the clock when it is created, and partialPrefetching only allows that after connection().",
    },
    schema: [],
  },
  create(context) {
    const clientNames = new Set();
    const connectionNames = new Set();
    let serverActionsFile = false;

    function startsWithConnection(fn) {
      if (fn.body.type !== "BlockStatement") return false;
      const [first] = fn.body.body;
      if (first?.type !== "ExpressionStatement") return false;
      const awaited = first.expression;
      return (
        awaited.type === "AwaitExpression" &&
        awaited.argument.type === "CallExpression" &&
        awaited.argument.callee.type === "Identifier" &&
        connectionNames.has(awaited.argument.callee.name)
      );
    }

    return {
      Program(program) {
        serverActionsFile = hasUseServerDirective(program.body);
      },
      ImportDeclaration(node) {
        for (const specifier of node.specifiers) {
          if (specifier.type !== "ImportSpecifier") continue;
          const name = importedName(specifier);
          if (node.source.value === SERVER_CLIENT_MODULE && name === "createClient") {
            clientNames.add(specifier.local.name);
          } else if (node.source.value === "next/server" && name === "connection") {
            connectionNames.add(specifier.local.name);
          }
        }
      },
      CallExpression(node) {
        if (serverActionsFile) return;
        if (node.callee.type !== "Identifier" || !clientNames.has(node.callee.name)) {
          return;
        }

        const fn = enclosingFunction(node);
        if (fn?.body.type === "BlockStatement" && hasUseServerDirective(fn.body.body)) {
          return;
        }
        if (fn && startsWithConnection(fn)) return;

        context.report({
          node,
          messageId: "missing",
          data: { name: node.callee.name },
        });
      },
    };
  },
};

export default rule;
