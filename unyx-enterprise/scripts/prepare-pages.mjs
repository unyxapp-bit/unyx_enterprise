import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const distDir = fileURLToPath(new URL("../dist/", import.meta.url))
const indexPath = join(distDir, "index.html")
const routerPath = fileURLToPath(new URL("../src/app/routes/AppRouter.tsx", import.meta.url))
const layoutPath = fileURLToPath(new URL("../src/app/layout/AppLayout.tsx", import.meta.url))

if (!existsSync(indexPath)) {
  throw new Error("dist/index.html not found. Run npm run build first.")
}

const fallbackRoutes = new Set(["404.html"])

function addRoute(route) {
  const cleanRoute = route.replace(/^\/+|\/+$/g, "")

  if (!cleanRoute) return

  fallbackRoutes.add(`${cleanRoute}/index.html`)
}

const routerSource = readFileSync(routerPath, "utf8")
const layoutSource = readFileSync(layoutPath, "utf8")

for (const match of routerSource.matchAll(/path="(\/[^"]*)"/g)) {
  addRoute(match[1])
}

for (const match of layoutSource.matchAll(/to:\s*"(\/app[^"]*)"/g)) {
  addRoute(match[1])
}

for (const route of fallbackRoutes) {
  const target = join(distDir, route)
  mkdirSync(dirname(target), { recursive: true })
  copyFileSync(indexPath, target)
}
