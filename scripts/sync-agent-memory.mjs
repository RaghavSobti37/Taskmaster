#!/usr/bin/env node
/**
 * CoreKnot agent memory helpers.
 *
 *   node scripts/sync-agent-memory.mjs report   # commits since Obsidian INDEX date (boot check)
 *   node scripts/sync-agent-memory.mjs stamp    # bump Obsidian INDEX Last updated to today
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PLATFORM_ROOT = path.resolve(ROOT, "..", "..");
const INDEX = path.join(PLATFORM_ROOT, "memory/obsidian/INDEX.md");
const RECENT = path.join(PLATFORM_ROOT, "memory/obsidian/RecentChanges.md");

function today() {
  return new Date().toISOString().slice(0, 10);
}

function readIndexDate() {
  const raw = fs.readFileSync(INDEX, "utf8");
  const m =
    raw.match(/\*\*Last updated:\*\*\s*(\d{4}-\d{2}-\d{2})/) ??
    raw.match(/Last updated:\s*(\d{4}-\d{2}-\d{2})/);
  return m?.[1] ?? "1970-01-01";
}

function stampIndex() {
  let raw = fs.readFileSync(INDEX, "utf8");
  const d = today();
  if (raw.includes("**Last updated:**")) {
    raw = raw.replace(/\*\*Last updated:\*\*\s*\d{4}-\d{2}-\d{2}/, `**Last updated:** ${d}`);
  } else if (/Last updated:\s*\d{4}-\d{2}-\d{2}/.test(raw)) {
    raw = raw.replace(/Last updated:\s*\d{4}-\d{2}-\d{2}/, `Last updated: ${d}`);
  } else {
    raw = raw.replace(/(# CoreKnot Memory Index\n)/, `$1\n> **Last updated:** ${d}\n`);
  }
  fs.writeFileSync(INDEX, raw);
  console.log(`memory/obsidian/INDEX.md → Last updated: ${d}`);
}

function gitLogSince(since) {
  try {
    const out = execSync(
      `git log --since="${since}T00:00:00" --format="%h %ad %s" --date=short`,
      { cwd: ROOT, encoding: "utf8" }
    ).trim();
    return out ? out.split("\n") : [];
  } catch {
    return [];
  }
}

function recentChangesText() {
  try {
    return fs.readFileSync(RECENT, "utf8");
  } catch {
    return "";
  }
}

function report() {
  const since = readIndexDate();
  const commits = gitLogSince(since);
  const changelog = recentChangesText();

  console.log(`Memory hub last updated: ${since}`);
  console.log(`Commits since ${since}: ${commits.length}`);

  if (commits.length === 0) {
    console.log("OK — no git activity since INDEX stamp (or repo has no new commits).");
    return;
  }

  const maybeMissing = commits.filter((line) => {
    const sha = line.split(" ")[0];
    return !changelog.includes(sha);
  });

  for (const line of commits) {
    const flagged = maybeMissing.includes(line) ? " ← not in recent-changes?" : "";
    console.log(`  ${line}${flagged}`);
  }

  if (maybeMissing.length > 0) {
    console.log("\nAction: run memory-sync skill — append recent-changes.md + bump INDEX.");
    process.exitCode = 1;
  } else {
    console.log("\nOK — commits appear reflected in changelog (by sha).");
  }
}

const cmd = process.argv[2] ?? "report";
if (cmd === "stamp") stampIndex();
else if (cmd === "report") report();
else {
  console.error("Usage: sync-agent-memory.mjs report|stamp");
  process.exit(1);
}
