#!/usr/bin/env node
// Tiny static server for local preview. No dependencies.
// Usage: node scripts/serve.mjs [port]   (default 8080)
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize, resolve } from "node:path";

const root = resolve(process.cwd());
const port = Number(process.argv[2] || process.env.PORT || 8080);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
};

createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (path.endsWith("/")) path += "index.html";
    const file = join(root, normalize(path));
    if (!file.startsWith(root)) throw Object.assign(new Error("forbidden"), { code: "EACCES" });
    const s = await stat(file);
    if (s.isDirectory()) { res.writeHead(301, { Location: path + "/" }); return res.end(); }
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": types[extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(body);
  } catch (e) {
    res.writeHead(e.code === "ENOENT" ? 404 : 500, { "Content-Type": "text/plain" });
    res.end(e.code === "ENOENT" ? "Not found" : "Error");
  }
}).listen(port, () => console.log(`Serving ${root} at http://localhost:${port}/`));
