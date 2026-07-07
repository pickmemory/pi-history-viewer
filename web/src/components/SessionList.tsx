import { useMemo, useState, type ReactNode } from "react";
import type { SessionMeta, SearchResult } from "../types";

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
      d.getHours(),
    )}:${pad(d.getMinutes())}`;
  } catch {
    return iso;
  }
}

function shortCwd(cwd: string): string {
  const parts = cwd.replace(/\\/g, "/").split("/").filter(Boolean);
  if (parts.length <= 3) return cwd;
  return ".../" + parts.slice(-2).join("/");
}

/** 把文本里命中的 query 片段高亮（大小写不敏感） */
function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const lower = text.toLowerCase();
  const ql = q.toLowerCase();
  const parts: ReactNode[] = [];
  let i = 0;
  let k = 0;
  let idx: number;
  while ((idx = lower.indexOf(ql, i)) !== -1) {
    if (idx > i) parts.push(text.slice(i, idx));
    parts.push(
      <mark key={k++} className="bg-amber-200 text-slate-800 rounded px-0.5">
        {text.slice(idx, idx + ql.length)}
      </mark>,
    );
    i = idx + ql.length;
  }
  if (i < text.length) parts.push(text.slice(i));
  return <>{parts}</>;
}

export function SessionList({
  sessions,
  currentId,
  onSelect,
  query,
  onQueryChange,
  searchResults,
  searching,
}: {
  sessions: SessionMeta[];
  currentId: string | null;
  onSelect: (id: string) => void;
  query: string;
  onQueryChange: (q: string) => void;
  searchResults: SearchResult[];
  searching: boolean;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const isSearch = query.trim().length > 0;

  // 浏览模式：按 cwd 分组
  const groups = useMemo(() => {
    const m = new Map<string, SessionMeta[]>();
    for (const s of sessions) {
      if (!m.has(s.cwd)) m.set(s.cwd, []);
      m.get(s.cwd)!.push(s);
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [sessions]);

  const toggle = (cwd: string) =>
    setCollapsed((c) => ({ ...c, [cwd]: !c[cwd] }));

  return (
    <aside className="h-full flex flex-col bg-white border-r border-slate-200">
      {/* 顶栏 */}
      <div className="p-4 border-b border-slate-100 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {isSearch ? "内容搜索" : "会话历史"}
          </h2>
          <span className="text-[11px] text-slate-400">
            {isSearch
              ? searching
                ? "搜索中…"
                : `${searchResults.length} 个结果`
              : `${sessions.length}`}
          </span>
        </div>
        {/* 搜索 */}
        <div className="relative">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="搜索标题或对话内容…"
            className="w-full pl-8 pr-3 py-2 text-sm bg-slate-100 rounded-lg outline-none focus:ring-2 ring-indigo-200 placeholder:text-slate-400"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto px-2 py-2">
        {isSearch ? (
          /* ───── 搜索结果模式：扁平列表 + 片段高亮 ───── */
          searchResults.length === 0 && !searching ? (
            <p className="text-xs text-slate-400 px-3 py-10 text-center leading-relaxed">
              没有匹配的会话
            </p>
          ) : (
            <div className="space-y-0.5">
              {searchResults.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onSelect(s.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition active:scale-[0.99] ${
                    currentId === s.id
                      ? "bg-indigo-50 ring-1 ring-indigo-100"
                      : "hover:bg-slate-100"
                  }`}
                >
                  <div
                    className={`truncate text-sm ${
                      currentId === s.id
                        ? "text-indigo-900 font-medium"
                        : "text-slate-700"
                    }`}
                  >
                    {s.title}
                  </div>
                  <div className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-snug">
                    <Highlight text={s.snippet} q={query.trim()} />
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                    <span className="text-amber-600 font-medium">
                      🎯 {s.matchCount}
                    </span>
                    <span>·</span>
                    <span>{fmtDate(s.startedAt)}</span>
                    <span>·</span>
                    <span className="truncate">{shortCwd(s.cwd)}</span>
                  </div>
                </button>
              ))}
            </div>
          )
        ) : (
          /* ───── 浏览模式：按 cwd 分组 ───── */
          groups.length === 0 ? (
            <p className="text-xs text-slate-400 px-3 py-10 text-center leading-relaxed">
              暂无会话
            </p>
          ) : (
            groups.map(([cwd, items]) => {
              const isCol = !!collapsed[cwd];
              return (
                <div key={cwd} className="mb-2">
                  <button
                    onClick={() => toggle(cwd)}
                    className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left group"
                    title={cwd}
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      className={`text-slate-400 transition-transform ${
                        isCol ? "" : "rotate-90"
                      }`}
                    >
                      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="text-[11px] font-medium text-slate-500 truncate flex-1">
                      📂 {shortCwd(cwd)}
                    </span>
                    <span className="text-[10px] text-slate-400">{items.length}</span>
                  </button>

                  {!isCol && (
                    <div className="space-y-0.5 ml-1">
                      {items.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => onSelect(s.id)}
                          className={`w-full text-left px-3 py-2 rounded-lg transition active:scale-[0.99] ${
                            currentId === s.id
                              ? "bg-indigo-50 ring-1 ring-indigo-100"
                              : "hover:bg-slate-100"
                          }`}
                        >
                          <div
                            className={`truncate text-sm ${
                              currentId === s.id
                                ? "text-indigo-900 font-medium"
                                : "text-slate-700"
                            }`}
                          >
                            {s.title}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                            <span>{fmtDate(s.startedAt)}</span>
                            <span>·</span>
                            <span>{s.messageCount} 条</span>
                            {s.model && (
                              <>
                                <span>·</span>
                                <span className="truncate">{s.model}</span>
                              </>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )
        )}
      </div>
    </aside>
  );
}
