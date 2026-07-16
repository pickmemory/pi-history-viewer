import { type ReactNode, useState } from "react";
import type { Folder } from "../types";

/**
 * 收藏会话时选择归入哪个文件夹（模态）。点击即「收藏 + 归类」并关闭。
 * - onPick(null)        → 仅收藏，不归入文件夹
 * - onPick(folderId)    → 收藏并归入该文件夹
 * - onCreateFolderAndPick(name) → 新建文件夹并直接收藏+归入
 */
export function FavoriteDialog({
  folders,
  onClose,
  onPick,
  onCreateFolderAndPick,
}: {
  folders: Folder[];
  onClose: () => void;
  onPick: (folderId: string | null) => void;
  onCreateFolderAndPick: (name: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const childFolders = (parentId: string | null) =>
    folders.filter((f) => f.parentId === parentId);

  const renderFolder = (folder: Folder, depth: number): ReactNode => {
    const subs = childFolders(folder.id);
    return (
      <div key={folder.id}>
        <button
          onClick={() => {
            onPick(folder.id);
            onClose();
          }}
          className="w-full text-left flex items-center gap-2 px-3 py-2 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg text-sm text-slate-700"
          style={{ paddingLeft: depth * 16 + 12 }}
        >
          📁 <span className="truncate">{folder.name}</span>
        </button>
        {subs.map((sf) => renderFolder(sf, depth + 1))}
      </div>
    );
  };

  const submitNew = () => {
    const name = newName.trim();
    if (!name) return;
    onCreateFolderAndPick(name);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-slate-900/40" />
      <div
        className="relative bg-white rounded-xl shadow-xl w-full max-w-sm max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">收藏到文件夹</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 w-6 h-6 flex items-center justify-center"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-auto p-2 space-y-0.5">
          {/* 仅收藏 */}
          <button
            onClick={() => {
              onPick(null);
              onClose();
            }}
            className="w-full text-left flex items-center gap-2 px-3 py-2 hover:bg-amber-50 hover:text-amber-700 rounded-lg text-sm text-slate-700"
          >
            ⭐ <span>仅收藏（不归入文件夹）</span>
          </button>

          {/* 文件夹树 */}
          {childFolders(null).map((f) => renderFolder(f, 0))}

          {/* 新建文件夹 */}
          {creating ? (
            <div className="px-2 py-1">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitNew();
                  else if (e.key === "Escape") setCreating(false);
                }}
                placeholder="新文件夹名"
                className="w-full px-2 py-1 text-xs bg-white rounded border border-emerald-300 outline-none focus:ring-2 ring-emerald-200"
              />
            </div>
          ) : (
            <button
              onClick={() => {
                setCreating(true);
                setNewName("");
              }}
              className="w-full text-left flex items-center gap-2 px-3 py-2 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg text-sm text-slate-500"
            >
              ➕ <span>新建文件夹…</span>
            </button>
          )}

          {folders.length === 0 && !creating && (
            <p className="text-xs text-slate-400 text-center py-4 leading-relaxed">
              还没有文件夹
              <br />
              点上方「新建文件夹」创建
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
