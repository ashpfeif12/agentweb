#!/usr/bin/env node

/**
 * AgentWeb Readiness Scorer CLI
 */

import { crawl } from "./crawler.js";
import { score, formatReport, type ReadinessReport } from "./scorer.js";

declare const process: {
  argv: string[];
  stdout: { write(s: string): boolean };
  exit(code: number): never;
};

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help")) {
    process.stdout.write("\n  AgentWeb Readiness Scorer\n\n  Usage: npx agentweb score <url> [--json] [--compare] [--output file]\n\n");
    process.exit(0);
  }

  const jsonOutput = args.includes("--json");
  const compare = args.includes("--compare");
  const outIdx = args.indexOf("--output");
  const outputFile = outIdx !== -1 ? args[outIdx + 1] : undefined;

  const urls = args.filter(
    (a: string) =>
      !a.startsWith("--") &&
      a !== outputFile &&
      (a.startsWith("http") || (a.includes(".") && !a.endsWith(".json")))
  );

  if (urls.length === 0) {
    process.stdout.write("  Error: No URL provided.\n");
    process.exit(1);
  }

  const reports: ReadinessReport[] = [];
  for (const url of urls) {
    process.stdout.write(`  Scanning ${url}...`);
    try {
      const data = await crawl(url);
      const report = score(data);
      reports.push(report);
      process.stdout.write(` ${report.total}/100 (${report.grade})\n`);
    } catch (err) {
      process.stdout.write(` ERROR\n`);
    }
  }

  if (reports.length === 0) {
    process.stdout.write("  No sites could be scored.\n");
    process.exit(1);
  }

  if (jsonOutput) {
    process.stdout.write(JSON.stringify(compare ? reports : reports[0], null, 2) + "\n");
  } else if (compare && reports.length > 1) {
    const sorted = [...reports].sort((a, b) => b.total - a.total);
    process.stdout.write("\n  Site                         Disc  Struct  Action  Policy  Total\n");
    process.stdout.write("  " + "\u2500".repeat(65) + "\n");
    for (const r of sorted) {
      const h = (() => { try { return new URL(r.url).hostname; } catch { return r.url; } })();
      process.stdout.write(
        "  " + h.padEnd(28) +
        `${r.breakdown.discovery.score}`.padStart(4) +
        `${r.breakdown.structure.score}`.padStart(8) +
        `${r.breakdown.actions.score}`.padStart(8) +
        `${r.breakdown.policies.score}`.padStart(8) +
        `${r.total}`.padStart(7) +
        `  ${r.grade}\n`
      );
    }
  } else {
    for (const report of reports) {
      process.stdout.write(formatReport(report) + "\n");
    }
  }

  if (outputFile) {
    const { writeFileSync } = await import("fs");
    writeFileSync(outputFile, JSON.stringify(compare ? reports : reports[0], null, 2));
    process.stdout.write(`\n  Saved to ${outputFile}\n`);
  }
}

main().catch((err: unknown) => {
  process.stdout.write("Fatal: " + String(err) + "\n");
  process.exit(1);
});
