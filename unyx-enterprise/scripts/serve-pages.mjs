import { createServer } from "node:http"
import { readFile, stat } from "node:fs/promises"
import { extname, resolve, sep } from "node:path"

const root = resolve("dist")
const prefix = "/unyx_enterprise"
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
}

createServer(async (request, response) => {
  const pathname = new URL(request.url ?? "/", "http://localhost").pathname
  if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) {
    response.writeHead(404).end("Not found")
    return
  }

  const relative = decodeURIComponent(pathname.slice(prefix.length)).replace(/^\/+/, "")
  let file = resolve(root, relative || "index.html")
  if (file !== root && !file.startsWith(`${root}${sep}`)) {
    response.writeHead(400).end("Invalid path")
    return
  }

  try {
    if (!(await stat(file)).isFile()) file = resolve(root, "index.html")
  } catch {
    file = resolve(root, "index.html")
  }

  try {
    const body = await readFile(file)
    response.writeHead(200, {
      "Content-Type": mimeTypes[extname(file)] ?? "application/octet-stream",
      "Cache-Control": "no-store",
    })
    response.end(body)
  } catch {
    response.writeHead(404).end("Not found")
  }
}).listen(4173, "127.0.0.1")
