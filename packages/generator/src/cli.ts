#!/usr/bin/env node

import { OpenApiParser } from "./parsers/openapi.js";
import { TypeScriptGenerator } from "./generators/typescript.js";
import type { GeneratorConfig, CapabilityMap, InputType } from "./types.js";

declare const process: {
  argv: string[];
  stdout: { write(s: string): boolean };
  exit(code: number): never;
  cwd(): string;
};

function getArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

function detectInputType(from: string): InputType {
  const lower = from.toLowerCase();
  if (lower.includes("openapi") || lower.endsWith(".yaml") || lower.endsWith(".yml") || lower.includes("swagger")) return "openapi";
  if (lower.endsWith(".graphql") || lower.endsWith(".gql")) return "graphql";
  return "openapi";
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help")) {
    process.stdout.write("\n  AgentWeb MCP Server Generator\n\n  Usage:\n    npx agentweb generate --from <source> [options]\n\n  Options:\n    --from <path|url>   OpenAPI spec, GraphQL schema, or URL\n    --output <dir>      Output directory (default: ./mcp-server)\n    --name <name>       Service name\n    --transport <type>  sse | streamable-http | stdio (default: sse)\n    --no-docker         Skip Dockerfile\n\n");
    process.exit(0);
  }

  const from = getArg(args, "--from");
  if (!from) {
    process.stdout.write("  Error: --from is required.\n");
    process.exit(1);
  }

  const config: GeneratorConfig = {
    from,
    inputType: detectInputType(from),
    output: getArg(args, "--output") || "./mcp-server",
    name: getArg(args, "--name"),
    transport: (getArg(args, "--transport") as GeneratorConfig["transport"]) || "sse",
    language: "typescript",
    docker: !args.includes("--no-docker"),
    tests: !args.includes("--no-tests"),
  };

  process.stdout.write("\n  AgentWeb MCP Server Generator\n\n");
  process.stdout.write("  Source:    " + config.from + "\n");
  process.stdout.write("  Output:    " + config.output + "\n\n");

  try {
    process.stdout.write("  [1/5] Parsing input...");
    const parser = new OpenApiParser();
    const capMap = await parser.parse(config.from, config);
    process.stdout.write(" Found " + capMap.tools.length + " tools\n");

    process.stdout.write("  [2/5] Generating code...");
    const generator = new TypeScriptGenerator();
    const serverCode = generator.generateServer(capMap, config);
    const authCode = generator.generateAuth(capMap.auth, config);
    const typesCode = generator.generateTypes(capMap.types, config);
    process.stdout.write(" Done\n");

    process.stdout.write("  [3/5] Generating agent.json...");
    const agentJson = {
      name: capMap.service.name,
      version: "1.0.0",
      spec_version: "1.0",
      description: capMap.service.description,
      capabilities: capMap.tools.map(t => ({
        name: t.name,
        description: t.description,
        type: t.annotations.readOnlyHint ? "query" : "action",
      })),
      endpoints: { mcp: "http://localhost:3000/sse", rest: capMap.service.baseUrl },
      policies: { rate_limit: "100/minute", data_handling: "no_training_on_interactions" },
      brand_voice: { tone: "helpful, accurate, professional" },
    };
    process.stdout.write(" Done\n");

    process.stdout.write("  [4/5] Generating package files...");
    const safeName = capMap.service.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const pkgJson = {
      name: safeName + "-mcp-server",
      version: "1.0.0",
      description: "MCP server for " + capMap.service.name,
      main: "dist/server.js",
      scripts: { build: "tsc", start: "node dist/server.js", dev: "tsx src/server.ts" },
      dependencies: { "@modelcontextprotocol/sdk": "^1.12.0", zod: "^3.23.0" },
      devDependencies: { typescript: "^5.4.0", tsx: "^4.21.0", "@types/node": "^20.0.0" },
    };
    const tsConf = {
      compilerOptions: { target: "ES2022", module: "Node16", moduleResolution: "Node16", declaration: true, outDir: "dist", rootDir: "src", strict: true, esModuleInterop: true, skipLibCheck: true },
      include: ["src/**/*.ts"],
    };
    const dockerfile = "FROM node:22-slim\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci --production=false\nCOPY . .\nRUN npm run build\nENV PORT=3000\nEXPOSE 3000\nCMD [\"node\", \"dist/server.js\"]\n";
    process.stdout.write(" Done\n");

    process.stdout.write("  [5/5] Writing to " + config.output + "/...");
    const { mkdirSync, writeFileSync } = await import("fs");
    const { join, dirname } = await import("path");
    const files: Record<string, string> = {
      "src/server.ts": serverCode,
      "src/auth.ts": authCode,
      "src/types.ts": typesCode,
      "agent.json": JSON.stringify(agentJson, null, 2),
      "package.json": JSON.stringify(pkgJson, null, 2),
      "tsconfig.json": JSON.stringify(tsConf, null, 2),
    };
    if (config.docker) files["Dockerfile"] = dockerfile;
    for (const [relPath, content] of Object.entries(files)) {
      const fullPath = join(config.output, relPath);
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, content);
    }
    process.stdout.write(" Done\n");

    process.stdout.write("\n  MCP server generated at " + config.output + "/\n");
    process.stdout.write("  Run: cd " + config.output + " && npm install && npm start\n\n");

  } catch (err) {
    process.stdout.write(" FAILED\n  Error: " + err + "\n");
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  process.stdout.write("Fatal: " + String(err) + "\n");
  process.exit(1);
});
