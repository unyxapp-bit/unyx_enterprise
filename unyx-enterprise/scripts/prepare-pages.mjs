import { copyFileSync, existsSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const distDir = fileURLToPath(new URL("../dist/", import.meta.url))
const indexPath = join(distDir, "index.html")

if (!existsSync(indexPath)) {
  throw new Error("dist/index.html not found. Run npm run build first.")
}

const fallbackRoutes = [
  "404.html",
  "login/index.html",
  "app/index.html",
  "app/employees/index.html",
  "app/schedules/index.html",
  "app/operations/index.html",
  "app/branches/index.html",
  "app/settings/index.html",
]

for (const route of fallbackRoutes) {
  const target = join(distDir, route)
  mkdirSync(dirname(target), { recursive: true })
  copyFileSync(indexPath, target)
}
