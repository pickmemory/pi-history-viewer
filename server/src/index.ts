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
import {
  loadState,
  isFavorite,
  getCustomTitle,
  setFavorite,
  setTitle,
  getFolders,
  getFolderId,
  createFolder,
  renameFolder,
  deleteFolder,
  setSessionFolder,
} from "./state.js";

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
  loadState();
  return c.json(
    listCache.map((m) => ({
      ...m,
      title: getCustomTitle(m.id) || m.title,
      favorite: isFavorite(m.id),
      folderId: getFolderId(m.id),
    })),
  );
});

app.get("/api/search", (c) => {
  const q = c.req.query("q") || "";
  const results = searchSessions(q);
  loadState();
  return c.json(
    results.map((m) => ({
      ...m,
      title: getCustomTitle(m.id) || m.title,
      favorite: isFavorite(m.id),
      folderId: getFolderId(m.id),
    })),
  );
});

// 收藏
app.post("/api/sessions/:id/favorite", (c) => {
  setFavorite(c.req.param("id"), true);
  return c.json({ ok: true });
});
app.delete("/api/sessions/:id/favorite", (c) => {
  setFavorite(c.req.param("id"), false);
  return c.json({ ok: true });
});
// 重命名（空标题 = 恢复自动生成）
app.put("/api/sessions/:id/title", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  setTitle(
    c.req.param("id"),
    typeof body.title === "string" ? body.title : null,
  );
  return c.json({ ok: true });
});

// 文件夹
app.get("/api/folders", (c) => c.json(getFolders()));
app.post("/api/folders", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return c.json({ error: "name required" }, 400);
  const parentId =
    typeof body.parentId === "string" ? body.parentId : null;
  return c.json({ id: createFolder(name, parentId) });
});
app.put("/api/folders/:id", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (typeof body.name !== "string" || !body.name.trim())
    return c.json({ error: "name required" }, 400);
  renameFolder(c.req.param("id"), body.name);
  return c.json({ ok: true });
});
app.delete("/api/folders/:id", (c) => {
  deleteFolder(c.req.param("id"));
  return c.json({ ok: true });
});
// 移动会话到文件夹（folderId: null = 未分类）
app.put("/api/sessions/:id/folder", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const folderId =
    typeof body.folderId === "string" ? body.folderId : null;
  setSessionFolder(c.req.param("id"), folderId);
  return c.json({ ok: true });
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
