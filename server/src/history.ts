import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import os from "node:os";

/* ────────────────────────────── 类型 ────────────────────────────── */

export interface ChatMsg {
  id: string;
  role: "user" | "agent";
  text: string;
  thinking?: string;
  tools: { name: string; isError?: boolean }[];
  error?: string;
  aborted?: boolean;
}

export interface SessionMeta {
  id: string; // 会话 uuid
  jsonlPath: string;
  cwd: string; // 真实工作目录（来自文件头）
  startedAt: string; // ISO 时间
  title: string; // 首条 user 消息（截断）
  messageCount: number;
  model?: string; // provider/modelId
  durationMs?: number;
}

/* ────────────────────────────── 配置 ────────────────────────────── */

export function getSessionDir(): string {
  return (
    process.env.PI_SESSIONS_DIR ||
    path.join(os.homedir(), ".pi", "agent", "sessions")
  );
}

/* ──────────────────────────── jsonl 解析 ────────────────────────── */

/**
 * 解析单个 session jsonl，返回前端可渲染的 ChatMsg[]。
 * 与 pi 内部 API 解耦：纯按行 JSON.parse，坏行跳过。
 */
export function parseSessionJsonl(jsonlPath: string): ChatMsg[] {
  let raw: string;
  try {
    raw = readFileSync(jsonlPath, "utf-8");
  } catch {
    return [];
  }

  const out: ChatMsg[] = [];
  let lastAgent: ChatMsg | null = null;

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let o: any;
    try {
      o = JSON.parse(trimmed);
    } catch {
      continue; // 部分写入的行，跳过
    }
    if (o.type !== "message") continue;
    const msg = o.message;
    if (!msg) continue;

    if (msg.role === "user") {
      const text = (msg.content ?? [])
        .filter((c: any) => c.type === "text")
        .map((c: any) => c.text)
        .join("");
      out.push({ id: o.id, role: "user", text, tools: [] });
      lastAgent = null;
    } else if (msg.role === "assistant") {
      const thinking = (msg.content ?? [])
        .filter((c: any) => c.type === "thinking")
        .map((c: any) => c.thinking)
        .join("");
      const text = (msg.content ?? [])
        .filter((c: any) => c.type === "text")
        .map((c: any) => c.text)
        .join("");
      // 兼容 toolCall（openai/glm 风格）与 tool_use（claude 风格）
      const tools = (msg.content ?? [])
        .filter((c: any) => c.type === "toolCall" || c.type === "tool_use")
        .map((c: any) => ({ name: c.name }));
      const m: ChatMsg = {
        id: o.id,
        role: "agent",
        text,
        thinking,
        tools,
      };
      // API 报错 / 中止
      if (msg.stopReason === "error") {
        m.error = msg.errorMessage || "请求失败";
      } else if (
        msg.stopReason === "aborted" &&
        !text &&
        !thinking &&
        tools.length === 0
      ) {
        m.aborted = true;
      }
      out.push(m);
      lastAgent = m;
    } else if (msg.role === "toolResult") {
      // 工具结果附加到发起它的 agent 消息
      if (lastAgent) {
        lastAgent.tools.push({ name: msg.toolName, isError: msg.isError });
      }
    }
  }

  return out;
}

/* ──────────────────────────── 元数据提取 ────────────────────────── */

function readMetaFromRaw(fp: string, raw: string): SessionMeta | null {
  let header: any = null;
  let model: string | undefined;
  let messageCount = 0;
  let firstUserText: string | null = null;
  let lastTs: string | undefined;

  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    let o: any;
    try {
      o = JSON.parse(t);
    } catch {
      continue;
    }
    if (o.type === "session" && !header) {
      header = o;
    } else if (
      o.type === "model_change" &&
      !model &&
      o.provider &&
      o.modelId
    ) {
      model = `${o.provider}/${o.modelId}`;
    } else if (o.type === "message") {
      messageCount++;
      if (o.timestamp) lastTs = o.timestamp;
      const msg = o.message;
      if (!firstUserText && msg?.role === "user") {
        const text = (msg.content ?? [])
          .filter((c: any) => c.type === "text")
          .map((c: any) => c.text)
          .join("");
        if (text.trim()) firstUserText = text.trim();
      }
    }
  }

  if (!header) return null;

  const title = firstUserText
    ? firstUserText.length > 50
      ? firstUserText.slice(0, 50) + "…"
      : firstUserText
    : "(空会话)";

  const startedAt: string = header.timestamp;
  const durationMs =
    lastTs && startedAt
      ? Date.parse(lastTs) - Date.parse(startedAt)
      : undefined;

  return {
    id: header.id,
    jsonlPath: fp,
    cwd: header.cwd ?? "(unknown)",
    startedAt,
    title,
    messageCount,
    model,
    durationMs,
  };
}

function readMeta(fp: string): SessionMeta | null {
  let raw: string;
  try {
    raw = readFileSync(fp, "utf-8");
  } catch {
    return null;
  }
  return readMetaFromRaw(fp, raw);
}

/* ──────────────────────────── 扫描全部会话 ──────────────────────── */

export function scanSessions(): SessionMeta[] {
  const root = getSessionDir();
  let dirs: string[];
  try {
    dirs = readdirSync(root);
  } catch {
    return [];
  }

  const metas: SessionMeta[] = [];
  for (const d of dirs) {
    const dirPath = path.join(root, d);
    let st;
    try {
      st = statSync(dirPath);
    } catch {
      continue;
    }
    if (!st.isDirectory()) continue;

    let files: string[];
    try {
      files = readdirSync(dirPath);
    } catch {
      continue;
    }
    for (const f of files) {
      if (!f.endsWith(".jsonl")) continue;
      const meta = readMeta(path.join(dirPath, f));
      if (meta) metas.push(meta);
    }
  }

  // 新→旧
  metas.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
  return metas;
}

/* ─────────────────────── 内容搜索（内存索引） ───────────────────── */
/* 优化：首次搜索时把所有文件读进内存建索引（元数据 + 可搜索文本拼接，
   每个文件只读一次），后续 60s 内的搜索纯内存字符串匹配，不再做磁盘
   I/O，也跳过 JSON 解析。避免每次按键触发 0.3s 同步阻塞。 */

export interface SearchResult extends SessionMeta {
  snippet: string; // 第一处匹配的上下文片段
  matchCount: number; // 命中次数
}

interface IndexedFile {
  meta: SessionMeta;
  texts: string[]; // 原始可搜索片段（保留大小写，用于提取 snippet）
  haystack: string; // texts.join("\n").toLowerCase()，用于快速命中判断
}

let indexCache: IndexedFile[] | null = null;
let indexAt = 0;
const INDEX_TTL = 60_000; // 60s 内复用索引；新会话/改动最多 60s 后可见

/** 收集一个文件里所有可搜索文本（正文 + 思考 + 错误信息） */
function collectSearchTexts(raw: string): string[] {
  const texts: string[] = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    let o: any;
    try {
      o = JSON.parse(t);
    } catch {
      continue;
    }
    if (o.type !== "message") continue;
    const msg = o.message;
    if (!msg) continue;
    if (Array.isArray(msg.content)) {
      for (const c of msg.content) {
        if (c.type === "text" && typeof c.text === "string")
          texts.push(c.text);
        else if (c.type === "thinking" && typeof c.thinking === "string")
          texts.push(c.thinking);
      }
    }
    if (typeof msg.errorMessage === "string") texts.push(msg.errorMessage);
  }
  return texts;
}

function buildIndex(): IndexedFile[] {
  const root = getSessionDir();
  let dirs: string[];
  try {
    dirs = readdirSync(root);
  } catch {
    return [];
  }
  const idx: IndexedFile[] = [];
  for (const d of dirs) {
    const dirPath = path.join(root, d);
    let st;
    try {
      st = statSync(dirPath);
    } catch {
      continue;
    }
    if (!st.isDirectory()) continue;
    let files: string[];
    try {
      files = readdirSync(dirPath);
    } catch {
      continue;
    }
    for (const f of files) {
      if (!f.endsWith(".jsonl")) continue;
      const fp = path.join(dirPath, f);
      let raw: string;
      try {
        raw = readFileSync(fp, "utf-8");
      } catch {
        continue;
      }
      const meta = readMetaFromRaw(fp, raw);
      if (!meta) continue;
      const texts = collectSearchTexts(raw);
      idx.push({
        meta,
        texts,
        haystack: texts.join("\n").toLowerCase(),
      });
    }
  }
  return idx;
}

function getIndex(): IndexedFile[] {
  const now = Date.now();
  if (indexCache && now - indexAt < INDEX_TTL) return indexCache;
  indexCache = buildIndex();
  indexAt = now;
  return indexCache;
}

/** 预热搜索索引（启动时调用，让首次查询也是热查询） */
export function primeSearchIndex(): void {
  getIndex();
}

/**
 * 全文搜索所有会话的消息正文、思考过程与错误信息，大小写不敏感。
 * 返回命中会话列表，按命中次数降序、再按时间降序。
 */
export function searchSessions(query: string): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const idx = getIndex();
  const out: SearchResult[] = [];

  for (const item of idx) {
    // 快速命中判断（整个文件的拼接文本里是否有 q）
    if (!item.haystack.includes(q)) continue;

    let matchCount = 0;
    let snippet = "";
    for (const text of item.texts) {
      const lower = text.toLowerCase();
      let from = 0;
      let i: number;
      while ((i = lower.indexOf(q, from)) !== -1) {
        matchCount++;
        if (!snippet) {
          const start = Math.max(0, i - 30);
          const end = Math.min(text.length, i + q.length + 30);
          snippet =
            (start > 0 ? "…" : "") +
            text.slice(start, end).replace(/\s+/g, " ").trim() +
            (end < text.length ? "…" : "");
        }
        from = i + q.length;
      }
    }
    if (matchCount > 0) {
      out.push({ ...item.meta, snippet, matchCount });
    }
  }

  out.sort(
    (a, b) =>
      b.matchCount - a.matchCount || (a.startedAt < b.startedAt ? 1 : -1),
  );
  return out;
}
