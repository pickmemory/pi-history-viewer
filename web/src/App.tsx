import { useEffect, useState, useCallback } from "react";
import type { SessionMeta, ChatMsg, SearchResult, Folder } from "./types";
import { SessionList } from "./components/SessionList";
import { ChatWindow } from "./components/ChatWindow";

function fmtFullDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("zh-CN", { hour12: false });
  } catch {
    return iso;
  }
}

function fmtDuration(ms?: number): string {
  if (!ms || ms < 0) return "";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m${s % 60 ? ` ${s % 60}s` : ""}`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export default function App() {
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(() => {
    const m = window.location.hash.match(/^#\/sessions\/([^/]+)/);
    return m ? m[1] : null;
  });
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false); // 移动端抽屉
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [copied, setCopied] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);

  const refresh = useCallback((force = false) => {
    fetch(`/api/sessions${force ? "?refresh=1" : ""}`)
      .then((r) => r.json())
      .then((s: SessionMeta[]) => setSessions(s))
      .catch(() => {});
  }, []);

  const refreshFolders = useCallback(() => {
    fetch("/api/folders")
      .then((r) => r.json())
      .then((f: Folder[]) => setFolders(f))
      .catch(() => {});
  }, []);

  const createFolder = (name: string, parentId: string | null) => {
    fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parentId }),
    })
      .then(() => refreshFolders())
      .catch(() => {});
  };

  const renameFolder = (id: string, name: string) => {
    fetch(`/api/folders/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
      .then(() => refreshFolders())
      .catch(() => {});
  };

  const deleteFolder = (id: string) => {
    fetch(`/api/folders/${id}`, { method: "DELETE" })
      .then(() => {
        refresh();
        refreshFolders();
      })
      .catch(() => {});
  };

  const moveSession = (id: string, folderId: string | null) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, folderId } : s)),
    );
    fetch(`/api/sessions/${id}/folder`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId }),
    }).catch(() => {});
  };

  const toggleFavorite = (id: string, fav: boolean) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, favorite: fav } : s)),
    );
    fetch(`/api/sessions/${id}/favorite`, {
      method: fav ? "POST" : "DELETE",
    }).catch(() => {});
  };

  const renameSession = (id: string, title: string) => {
    const trimmed = title.trim();
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title: trimmed || s.title } : s)),
    );
    fetch(`/api/sessions/${id}/title`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    }).then(() => {
      if (!trimmed) refresh(); // 清空 = 恢复自动标题，重新拉取
    });
  };

  useEffect(() => {
    refresh();
    refreshFolders();
  }, [refresh, refreshFolders]);

  // 内容搜索：输入带 debounce，调后端全文检索
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((res: SearchResult[]) => setSearchResults(res))
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  // 加载某会话消息
  useEffect(() => {
    if (!currentId) {
      setMsgs([]);
      return;
    }
    setLoading(true);
    fetch(`/api/sessions/${currentId}/messages`)
      .then((r) => r.json())
      .then((m: unknown) => setMsgs(Array.isArray(m) ? (m as ChatMsg[]) : []))
      .catch(() => setMsgs([]))
      .finally(() => setLoading(false));
  }, [currentId]);

  // 路由：currentId ↔ URL hash，刷新页面保留当前会话
  useEffect(() => {
    if (currentId) {
      window.location.hash = `/sessions/${currentId}`;
    } else if (window.location.hash) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, [currentId]);

  useEffect(() => {
    const onHash = () => {
      const m = window.location.hash.match(/^#\/sessions\/([^/]+)/);
      const id = m ? m[1] : null;
      setCurrentId((cur) => (cur === id ? cur : id));
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const current = sessions.find((s) => s.id === currentId);

  return (
    <div className="h-full flex bg-slate-100">
      {/* 左侧列表（桌面） */}
      <div className="hidden md:block w-72 lg:w-80 shrink-0">
        <SessionList
          sessions={sessions}
          currentId={currentId}
          onSelect={setCurrentId}
          query={query}
          onQueryChange={setQuery}
          searchResults={searchResults}
          searching={searching}
          onToggleFavorite={toggleFavorite}
          onRename={renameSession}
          folders={folders}
          onCreateFolder={createFolder}
          onRenameFolder={renameFolder}
          onDeleteFolder={deleteFolder}
          onMoveSession={moveSession}
        />
      </div>

      {/* 移动端抽屉 */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative w-72 max-w-[80vw] bg-white">
            <SessionList
              sessions={sessions}
              currentId={currentId}
              onSelect={(id) => {
                setCurrentId(id);
                setDrawerOpen(false);
              }}
              query={query}
              onQueryChange={setQuery}
              searchResults={searchResults}
              searching={searching}
              onToggleFavorite={toggleFavorite}
              onRename={renameSession}
              folders={folders}
              onCreateFolder={createFolder}
              onRenameFolder={renameFolder}
              onDeleteFolder={deleteFolder}
              onMoveSession={moveSession}
            />
          </div>
        </div>
      )}

      {/* 右侧主区 */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* 顶部信息栏 */}
        <header className="shrink-0 bg-white border-b border-slate-200 px-4 py-2.5 flex items-center gap-3">
          {/* 移动端菜单按钮 */}
          <button
            className="md:hidden p-1 -ml-1 text-slate-500"
            onClick={() => setDrawerOpen(true)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>

          {current ? (
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold text-slate-800 truncate">
                  {current.title}
                </h1>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400 overflow-hidden">
                <span className="truncate" title={current.cwd}>
                  📂 {current.cwd}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex-1 text-sm text-slate-400">
              Pi History Viewer · 选择左侧会话查看
            </div>
          )}

          {current && (
            <div className="hidden sm:flex items-center gap-3 text-[11px] text-slate-400 shrink-0">
              <button
                onClick={() => {
                  navigator.clipboard
                    .writeText(`pi --session ${current.id}`)
                    .then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    })
                    .catch(() => {});
                }}
                title={`点击复制 resume 命令：\npi --session ${current.id}\n（请在对应工作目录 ${current.cwd} 下运行）`}
                className="flex items-center gap-1 px-2 py-1 rounded-md font-mono text-[11px] bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 transition shrink-0"
              >
                {copied ? (
                  <span className="text-emerald-600 not-italic">✓ 已复制</span>
                ) : (
                  <>
                    <span>{current.id.slice(0, 8)}</span>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="11" height="11" rx="2" />
                      <path d="M5 15V5a2 2 0 012-2h10" />
                    </svg>
                  </>
                )}
              </button>
              <span>{fmtFullDate(current.startedAt)}</span>
              {current.durationMs ? (
                <span>⏱ {fmtDuration(current.durationMs)}</span>
              ) : null}
              <span>💬 {current.messageCount}</span>
              <button
                onClick={() => refresh(true)}
                title="刷新列表"
                className="p-1 hover:text-indigo-500"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M21 12a9 9 0 11-3-6.7L21 8" />
                  <path d="M21 3v5h-5" />
                </svg>
              </button>
            </div>
          )}
        </header>

        {/* 聊天区 */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
            加载中…
          </div>
        ) : current ? (
          msgs.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
              该会话没有消息记录
            </div>
          ) : (
            <ChatWindow msgs={msgs} />
          )
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-3xl mb-5 shadow-lg shadow-indigo-200">
              📜
            </div>
            <h3 className="text-lg font-semibold text-slate-700 mb-2">
              Pi Agent 历史会话
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed max-w-sm">
              汇总本机所有 pi agent 的对话记录。从左侧选择一个会话即可查看完整内容（含思考过程、工具调用）。
            </p>
            <p className="text-xs text-slate-300 mt-4">
              共 {sessions.length} 个会话
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
