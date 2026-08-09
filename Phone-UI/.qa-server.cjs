const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2"
};

http
  .createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
      const relativePath = pathname.endsWith("/") ? `${pathname}index.html` : pathname;
      const filePath = path.resolve(root, `.${relativePath}`);
      if (!filePath.startsWith(`${root}${path.sep}`)) throw new Error("Invalid path");
      const body = await fs.readFile(filePath);
      response.writeHead(200, {
        "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream"
      });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  })
  .listen(4173, "127.0.0.1");
