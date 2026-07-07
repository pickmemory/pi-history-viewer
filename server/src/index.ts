import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  scanSessions,
  parseSessionJsonl,
  getSessionDir,
  searchSessions,
  primeSearchIndex,
} from "./history.js";

const app = new Hono();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* 带简单内存缓存的会话列表：首次或显式 ?refresh=1 时重扫 */
let listCache: ReturnType<typeof scanSessions> | null = null;

app.get("/api/health", (c) =>
  c.json({ ok: true, sessionsDir: getSessionDir() }),
);

app.get("/api/sessions", (c) => {
  if (!listCache || c.req.query("refresh") === "1") {
    listCache = scanSessions();
  }
  return c.json(listCache);
});

app.get("/api/search", (c) => {
  const q = c.req.query("q") || "";
  return c.json(searchSessions(q));
});

app.get("/api/sessions/:id/messages", (c) => {
  const id = c.req.param("id");
  if (!listCache) listCache = scanSessions();
  const meta = listCache.find((m) => m.id === id);
  if (!meta) return c.json({ error: "not found" }, 404);
  return c.json(parseSessionJsonl(meta.jsonlPath));
});

/* ────────────── 生产环境静态托管 web 构建产物 ────────────── */
// server 运行时：相对路径 ../../web/dist（dev 时不存在，自动跳过）
const webDist = path.resolve(__dirname, "../../web/dist");
if (fs.existsSync(webDist)) {
  // serveStatic 的 root 相对进程 cwd（=server/），故用 ../web/dist
  app.use("/assets/*", serveStatic({ root: "../web/dist" }));
  app.use("/vite.svg", serveStatic({ root: "../web/dist" }));
  // SPA fallback
  app.get("*", (c) => {
    const p = c.req.path;
    if (p.startsWith("/api")) return c.notFound();
    return c.html(fs.readFileSync(path.join(webDist, "index.html"), "utf-8"));
  });
}

const port = Number(process.env.PORT) || 8753;
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[pi-history-viewer] http://localhost:${info.port}`);
  console.log(`  会话目录: ${getSessionDir()}`);
  if (!fs.existsSync(webDist)) {
    console.log("  (dev 模式：前端请另开 npm run dev:web，访问 http://localhost:5173)");
  }
  // 异步预热搜索索引（不阻塞启动）
  setTimeout(() => primeSearchIndex(), 500);
});
