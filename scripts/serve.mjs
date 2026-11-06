import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { basePath, stripBasePath } from "./paths.mjs";

const root = path.resolve("dist");
const port = Number(process.env.PORT || 5173);
const types = {
  ".mp4": "video/mp4",
  ".wasm": "application/wasm",
  ".json": "application/json",
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".wgsl": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
};

try {
  await stat(path.join(root, "index.html"));
} catch {
  console.error("请先运行 npm run build。");
  process.exit(1);
}

const server = createServer(async (req, res) => {
  try {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { Allow: "GET, HEAD" });
      res.end();
      return;
    }
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    if (basePath && pathname === basePath) {
      res.writeHead(301, { Location: `${basePath}/` });
      res.end();
      return;
    }
    let file = path.resolve(root, "." + stripBasePath(pathname));
    if (file !== root && !file.startsWith(root + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
    const content = await readFile(file);
    const headers = {
      "Content-Type": types[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store",
      "Accept-Ranges": "bytes",
      "Content-Length": content.length,
    };
    const range = req.headers.range;
    if (range && req.method === "GET") {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      const start = match?.[1] ? Number(match[1]) : Math.max(0, content.length - Number(match?.[2]));
      const end = match?.[1] && match?.[2] ? Math.min(Number(match[2]), content.length - 1) : content.length - 1;
      if (!match || (!match[1] && !match[2]) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= content.length) {
        res.writeHead(416, { "Content-Range": `bytes */${content.length}` });
        res.end();
        return;
      }
      res.writeHead(206, { ...headers, "Content-Range": `bytes ${start}-${end}/${content.length}`, "Content-Length": end - start + 1 });
      res.end(content.subarray(start, end + 1));
      return;
    }
    res.writeHead(200, headers);
    res.end(req.method === "HEAD" ? undefined : content);
  } catch {
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    const content = await readFile(path.join(root, "404.html")).catch(
      () => "页面不存在",
    );
    res.end(req.method === "HEAD" ? undefined : content);
  }
});

server.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});
server.listen(port, "127.0.0.1", () => {
  console.log(`Local: http://127.0.0.1:${port}${basePath}/`);
});
