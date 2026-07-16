import { useMemo, useState, type ReactNode } from "react";
import type { SessionMeta, SearchResult, Folder } from "../types";
import { MoveDialog } from "./MoveDialog";
import { FavoriteDialog } from "./FavoriteDialog";

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

const byTimeDesc = (a: SessionMeta, b: SessionMeta) =>
  a.startedAt < b.startedAt ? 1 : -1;

/* ─────────────────── 单个会话项 ─────────────────── */

interface ItemProps {
  s: SessionMeta;
  active: boolean;
  indent?: number;
  onSelect: () => void;
  onToggleFavorite: (fav: boolean) => void;
  onStartRename: () => void;
  onMove: () => void;
  onStartFavorite: () => void;
  editing: boolean;
  editValue: string;
  onEditChange: (v: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  search?: { snippet: string; matchCount: number; query: string };
}

function SessionItem(p: ItemProps) {
  if (p.editing) {
    return (
      <div
        className={`px-2 py-1.5 rounded-lg ${
          p.active ? "bg-indigo-50 ring-1 ring-indigo-100" : "bg-slate-50"
        }`}
        style={p.indent ? { marginLeft: p.indent * 12 } : undefined}
      >
        <input
          autoFocus
          value={p.editValue}
          onChange={(e) => p.onEditChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") p.onCommitRename();
            else if (e.key === "Escape") p.onCancelRename();
          }}
          onBlur={() => p.onCommitRename()}
          placeholder="输入新标题（清空恢复默认）"
          className="w-full px-2 py-1 text-sm bg-white rounded border border-indigo-300 outline-none focus:ring-2 ring-indigo-200"
        />
      </div>
    );
  }
  return (
    <div
      className={`group relative rounded-lg transition active:scale-[0.99] ${
        p.active ? "bg-indigo-50 ring-1 ring-indigo-100" : "hover:bg-slate-100"
      }`}
      style={p.indent ? { marginLeft: p.indent * 12 } : undefined}
    >
      <button onClick={p.onSelect} className="w-full text-left px-3 py-2 pr-20">
        <div
          title={p.s.title}
          className={`truncate text-sm ${
            p.active ? "text-indigo-900 font-medium" : "text-slate-700"
          }`}
        >
          {p.s.favorite && <span className="text-amber-400 mr-0.5">⭐</span>}
          {p.s.title}
        </div>
        {p.search ? (
          <>
            <div className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-snug">
              <Highlight text={p.search.snippet} q={p.search.query} />
            </div>
            <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
              <span className="text-amber-600 font-medium">
                🎯 {p.search.matchCount}
              </span>
              <span>·</span>
              <span>{fmtDate(p.s.startedAt)}</span>
              <span>·</span>
              <span className="truncate">{shortCwd(p.s.cwd)}</span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
            <span>{fmtDate(p.s.startedAt)}</span>
            <span>·</span>
            <span>{p.s.messageCount} 条</span>
            {p.s.model && (
              <>
                <span>·</span>
                <span className="truncate">{p.s.model}</span>
              </>
            )}
          </div>
        )}
      </button>
      {/* hover 操作：收藏 / 移动 / 重命名 */}
      <div className="absolute right-1 top-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
        <button
          onClick={() =>
            p.s.favorite ? p.onToggleFavorite(false) : p.onStartFavorite()
          }
          title={p.s.favorite ? "取消收藏" : "收藏到文件夹"}
          className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-amber-500 hover:bg-white"
        >
          {p.s.favorite ? "⭐" : "☆"}
        </button>
        {p.s.favorite && (
          <button
            onClick={p.onMove}
            title="移动到文件夹"
            className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-indigo-500 hover:bg-white"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        )}
        <button
          onClick={p.onStartRename}
          title="重命名"
          className="w-6 h-6 flex items-center justify-center rounded text-xs text-slate-400 hover:text-indigo-500 hover:bg-white"
        >
          ✏️
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────── 列表 ─────────────────────────── */

export function SessionList({
  sessions,
  currentId,
  onSelect,
  query,
  onQueryChange,
  searchResults,
  searching,
  onToggleFavorite,
  onRename,
  folders,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveSession,
  onFavoriteToFolder,
}: {
  sessions: SessionMeta[];
  currentId: string | null;
  onSelect: (id: string) => void;
  query: string;
  onQueryChange: (q: string) => void;
  searchResults: SearchResult[];
  searching: boolean;
  onToggleFavorite: (id: string, fav: boolean) => void;
  onRename: (id: string, title: string) => void;
  folders: Folder[];
  onCreateFolder: (name: string, parentId: string | null) => Promise<string>;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onMoveSession: (id: string, folderId: string | null) => void;
  onFavoriteToFolder: (id: string, folderId: string | null) => void;
}) {
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [collapsedCwd, setCollapsedCwd] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [folderEditing, setFolderEditing] = useState<string | null>(null);
  const [folderEditName, setFolderEditName] = useState("");
  // undefined=不在新建；null=根级新建；string=在某文件夹下新建
  const [newFolderParent, setNewFolderParent] = useState<string | null | undefined>(undefined);
  const [newFolderName, setNewFolderName] = useState("");
  const [moveTarget, setMoveTarget] = useState<string | null>(null);
  const [favoriteTarget, setFavoriteTarget] = useState<string | null>(null);

  const isSearch = query.trim().length > 0;

  const favorited = useMemo(() => sessions.filter((s) => s.favorite), [sessions]);
  const uncategorized = useMemo(
    () => favorited.filter((s) => !s.folderId).sort(byTimeDesc),
    [favorited],
  );
  const cwdSessions = useMemo(() => sessions.filter((s) => !s.favorite), [sessions]);
  const cwdGroups = useMemo(() => {
    const m = new Map<string, SessionMeta[]>();
    for (const s of cwdSessions) {
      if (!m.has(s.cwd)) m.set(s.cwd, []);
      m.get(s.cwd)!.push(s);
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [cwdSessions]);

  const childFolders = (parentId: string | null) =>
    folders.filter((f) => f.parentId === parentId);
  const sessionsIn = (folderId: string) => favorited.filter((s) => s.folderId === folderId);

  const startRename = (id: string, title: string) => {
    setEditingId(id);
    setEditValue(title);
  };
  const commitRename = () => {
    if (editingId) onRename(editingId, editValue);
    setEditingId(null);
  };

  const commitNewFolder = () => {
    if (newFolderName.trim()) onCreateFolder(newFolderName.trim(), newFolderParent ?? null);
    setNewFolderName("");
    setNewFolderParent(undefined);
  };
  const commitFolderRename = () => {
    if (folderEditing && folderEditName.trim()) onRenameFolder(folderEditing, folderEditName.trim());
    setFolderEditing(null);
  };

  const itemProps = (s: SessionMeta, indent?: number) => ({
    s,
    active: currentId === s.id,
    indent,
    onSelect: () => onSelect(s.id),
    onToggleFavorite: (fav: boolean) => onToggleFavorite(s.id, fav),
    onStartRename: () => startRename(s.id, s.title),
    onMove: () => setMoveTarget(s.id),
    onStartFavorite: () => setFavoriteTarget(s.id),
    editing: editingId === s.id,
    editValue,
    onEditChange: setEditValue,
    onCommitRename: commitRename,
    onCancelRename: () => setEditingId(null),
  });

  /* 递归渲染文件夹节点 */
  const renderFolder = (folder: Folder, depth: number): ReactNode => {
    const isCol = !!collapsedFolders[folder.id];
    const subs = childFolders(folder.id);
    const items = sessionsIn(folder.id);
    const count = subs.length + items.length;
    const editing = folderEditing === folder.id;
    return (
      <div key={folder.id}>
        <div
          className="group relative flex items-center gap-1 px-2 py-1.5 rounded hover:bg-slate-100"
          style={{ paddingLeft: depth * 12 + 8 }}
        >
          <button
            onClick={() => setCollapsedFolders((c) => ({ ...c, [folder.id]: !c[folder.id] }))}
            className="text-slate-400 shrink-0"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className={`transition-transform ${isCol ? "" : "rotate-90"}`}
            >
              <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="text-[12px]">📁</span>
          {editing ? (
            <input
              autoFocus
              value={folderEditName}
              onChange={(e) => setFolderEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitFolderRename();
                else if (e.key === "Escape") setFolderEditing(null);
              }}
              onBlur={commitFolderRename}
              className="flex-1 min-w-0 px-1.5 py-0.5 text-xs bg-white rounded border border-indigo-300 outline-none"
            />
          ) : (
            <span
              className="text-[12px] text-slate-700 truncate flex-1"
              onDoubleClick={() => {
                setFolderEditing(folder.id);
                setFolderEditName(folder.name);
              }}
            >
              {folder.name}
            </span>
          )}
          <span className="text-[10px] text-slate-400">{count}</span>
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 ml-1">
            <button
              title="新建子文件夹"
              onClick={() => {
                setNewFolderParent(folder.id);
                setNewFolderName("");
                setCollapsedFolders((c) => ({ ...c, [folder.id]: false }));
              }}
              className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-emerald-600 hover:bg-white"
            >
              ＋
            </button>
            <button
              title="重命名"
              onClick={() => {
                setFolderEditing(folder.id);
                setFolderEditName(folder.name);
              }}
              className="w-5 h-5 flex items-center justify-center rounded text-xs text-slate-400 hover:text-indigo-500 hover:bg-white"
            >
              ✏️
            </button>
            <button
              title="删除"
              onClick={() => {
                if (
                  confirm(
                    `删除文件夹「${folder.name}」？\n子文件夹一并删除，里面收藏的会话退回「未分类」。`,
                  )
                )
                  onDeleteFolder(folder.id);
              }}
              className="w-5 h-5 flex items-center justify-center rounded text-xs text-slate-400 hover:text-red-500 hover:bg-white"
            >
              🗑
            </button>
          </div>
        </div>
        {!isCol && (
          <div>
            {subs.map((sf) => renderFolder(sf, depth + 1))}
            {items.map((s) => (
              <SessionItem key={s.id} {...itemProps(s, depth + 1)} />
            ))}
            {newFolderParent === folder.id && (
              <div style={{ marginLeft: (depth + 1) * 12 + 8 }} className="px-2 py-1">
                <input
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitNewFolder();
                    else if (e.key === "Escape") setNewFolderParent(undefined);
                  }}
                  onBlur={commitNewFolder}
                  placeholder="新文件夹名"
                  className="w-full px-2 py-1 text-xs bg-white rounded border border-emerald-300 outline-none focus:ring-2 ring-emerald-200"
                />
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const rootFolders = childFolders(null);

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
              : `${sessions.length}${favorited.length ? ` · ⭐${favorited.length}` : ""}${
                  folders.length ? ` · 📁${folders.length}` : ""
                }`}
          </span>
        </div>
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
          /* ───── 搜索结果 ───── */
          searchResults.length === 0 && !searching ? (
            <p className="text-xs text-slate-400 px-3 py-10 text-center leading-relaxed">
              没有匹配的会话
            </p>
          ) : (
            <div className="space-y-0.5">
              {searchResults.map((s) => (
                <SessionItem
                  key={s.id}
                  {...itemProps(s)}
                  search={{ snippet: s.snippet, matchCount: s.matchCount, query: query.trim() }}
                />
              ))}
            </div>
          )
        ) : (
          /* ───── 浏览：文件夹树 + 未分类 + cwd 分组 ───── */
          <>
            {/* 文件夹区 */}
            <div className="mb-2">
              <div className="px-2 py-1.5 flex items-center gap-1">
                <span className="text-[11px] font-semibold text-indigo-500 flex-1">
                  📁 文件夹
                </span>
                <button
                  onClick={() => {
                    setNewFolderParent(null);
                    setNewFolderName("");
                  }}
                  title="新建文件夹"
                  className="text-[11px] text-slate-400 hover:text-emerald-600 px-1.5 py-0.5 rounded hover:bg-slate-100"
                >
                  ＋ 新建
                </button>
              </div>

              {newFolderParent === null && (
                <div className="px-2 py-1">
                  <input
                    autoFocus
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitNewFolder();
                      else if (e.key === "Escape") setNewFolderParent(undefined);
                    }}
                    onBlur={commitNewFolder}
                    placeholder="新文件夹名"
                    className="w-full px-2 py-1 text-xs bg-white rounded border border-emerald-300 outline-none focus:ring-2 ring-emerald-200"
                  />
                </div>
              )}

              <div className="space-y-0.5">
                {rootFolders.map((f) => renderFolder(f, 0))}
              </div>
              {rootFolders.length === 0 && newFolderParent !== null && (
                <p className="text-[11px] text-slate-400 px-3 py-2 leading-relaxed">
                  点上方「＋ 新建」创建文件夹，把收藏的会话分类整理。
                </p>
              )}
            </div>

            {/* 未分类收藏 */}
            {uncategorized.length > 0 && (
              <div className="mb-2">
                <div className="px-2 py-1.5 text-[11px] font-semibold text-amber-500 flex items-center gap-1">
                  📥 未分类
                  <span className="text-slate-400 font-normal">{uncategorized.length}</span>
                </div>
                <div className="space-y-0.5">
                  {uncategorized.map((s) => (
                    <SessionItem key={s.id} {...itemProps(s)} />
                  ))}
                </div>
              </div>
            )}

            {/* cwd 分组 */}
            {cwdGroups.map(([cwd, items]) => {
              const isCol = !!collapsedCwd[cwd];
              return (
                <div key={cwd} className="mb-2">
                  <button
                    onClick={() => setCollapsedCwd((c) => ({ ...c, [cwd]: !c[cwd] }))}
                    className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left"
                    title={cwd}
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      className={`text-slate-400 transition-transform ${isCol ? "" : "rotate-90"}`}
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
                        <SessionItem key={s.id} {...itemProps(s)} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {sessions.length === 0 && (
              <p className="text-xs text-slate-400 px-3 py-10 text-center">暂无会话</p>
            )}
          </>
        )}
      </div>

      {moveTarget && (
        <MoveDialog
          folders={folders}
          onClose={() => setMoveTarget(null)}
          onMove={(folderId) => onMoveSession(moveTarget, folderId)}
        />
      )}

      {favoriteTarget && (
        <FavoriteDialog
          folders={folders}
          onClose={() => setFavoriteTarget(null)}
          onPick={(folderId) => {
            onFavoriteToFolder(favoriteTarget, folderId);
            setFavoriteTarget(null);
          }}
          onCreateFolderAndPick={async (name) => {
            const id = await onCreateFolder(name, null);
            onFavoriteToFolder(favoriteTarget, id);
            setFavoriteTarget(null);
          }}
        />
      )}
    </aside>
  );
}
