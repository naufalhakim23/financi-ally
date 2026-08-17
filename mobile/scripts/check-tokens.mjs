#!/usr/bin/env node
// Fails if src/components/ui/tokens.ts drifts from global.css. Read as text
// because tokens.ts imports lucide/nativewind and cannot run in plain node.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const VAR = /--([a-z-]+):\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\s*;/g;

function hex(r, g, b) {
  return "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0").toUpperCase()).join("");
}

function cssVars(source) {
  return new Map([...source.matchAll(VAR)].map(([, name, r, g, b]) => [name, hex(+r, +g, +b)]));
}

function kebab(camel) {
  return camel.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
}

function paletteBlock(source, declaration) {
  const start = source.indexOf(declaration);
  if (start === -1) throw new Error(`tokens.ts: could not find \`${declaration}\``);
  const body = source.slice(start, source.indexOf("\n};", start));
  return new Map(
    [...body.matchAll(/(\w+):\s*"(#[0-9A-Fa-f]{6})"/g)].map(([, k, v]) => [k, v.toUpperCase()]),
  );
}

const css = readFileSync(join(root, "global.css"), "utf8");
const tokens = readFileSync(join(root, "src/components/ui/tokens.ts"), "utf8");

// The selector, not the prose: the header comment names `.dark:root` too.
const darkAt = css.search(/\.dark:root\s*\{/);
if (darkAt === -1) throw new Error("global.css: no .dark:root block");

const schemes = [
  { name: "light", vars: cssVars(css.slice(0, darkAt)), palette: paletteBlock(tokens, "const LIGHT = {") },
  { name: "dark", vars: cssVars(css.slice(darkAt)), palette: paletteBlock(tokens, "const DARK: typeof LIGHT = {") },
];

const problems = [];

for (const { name, vars, palette } of schemes) {
  if (palette.size === 0) problems.push(`${name}: parsed no colors out of tokens.ts`);
  for (const [key, value] of palette) {
    const variable = kebab(key);
    const declared = vars.get(variable);
    if (!declared) {
      problems.push(`${name}: tokens.ts has \`${key}\` but global.css has no --${variable}`);
    } else if (declared !== value) {
      problems.push(`${name}: ${key} is ${value} in tokens.ts but --${variable} is ${declared}`);
    }
  }
}

if (problems.length > 0) {
  console.error("token drift between global.css and src/components/ui/tokens.ts:\n");
  for (const p of problems) console.error("  " + p);
  console.error("\nDESIGN.md is the source of truth. Fix whichever copy is stale.");
  process.exit(1);
}

console.log(`tokens in sync (${schemes.map((s) => `${s.name} ${s.palette.size}`).join(", ")})`);
