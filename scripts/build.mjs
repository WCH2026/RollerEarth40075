#!/usr/bin/env node
// Builds index.html (full document) from src/page.html.
// With --preview, also writes dist/preview.html: data and images inlined (for a standalone preview).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const src = readFileSync("src/page.html", "utf8");
const head = src.match(/<!-- HEAD -->([\s\S]*?)<!-- \/HEAD -->/)[1].trim();
const body = src.replace(/<!-- HEAD -->[\s\S]*?<!-- \/HEAD -->/, "").trim();
const doc = `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${head}\n</head>\n<body>\n${body}\n</body>\n</html>\n`;
writeFileSync("index.html", doc);
console.log("index.html written");
if (process.argv.includes("--preview")) {
  const data = readFileSync("data/strava.json", "utf8").replace(/<\/script/gi, "<\\/script");
  let preview = head + "\n" + body;
  preview = preview.replace(/src="assets\/([^"]+)"/g, (_, f) => `src="data:image/jpeg;base64,${readFileSync("assets/" + f).toString("base64")}"`);
  preview = preview.replace("<script>\n(function", `<script id="strava-data" type="application/json">${data}</script>\n<script>\n(function`);
  mkdirSync("dist", { recursive: true });
  writeFileSync("dist/preview.html", preview);
  console.log("dist/preview.html written", (preview.length / 1024 / 1024).toFixed(2), "MB");
}
