import { type ReactNode } from "react";
import type { Folder } from "../types";

/** 移动会话到文件夹的选择器（模态）。点击即移动并关闭。 */
export function MoveDialog({
  folders,
  onClose,
  onMove,
}: {
  folders: Folder[];
  onClose: () => void;
  onMove: (folderId: string | null) => void;
}) {
  const childFolders = (parentId: string | null) =>
    folders.filter((f) => f.parentId === parentId);

  const renderFolder = (folder: Folder, depth: number): ReactNode => {
    const subs = childFolders(folder.id);
    return (
      <div key={folder.id}>
        <button
          onClick={() => {
            onMove(folder.id);
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
          <h3 className="text-sm font-semibold text-slate-700">移动到文件夹</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 w-6 h-6 flex items-center justify-center"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-auto p-2 space-y-0.5">
          <button
            onClick={() => {
              onMove(null);
              onClose();
            }}
            className="w-full text-left flex items-center gap-2 px-3 py-2 hover:bg-amber-50 hover:text-amber-700 rounded-lg text-sm text-slate-700"
          >
            📥 <span>未分类</span>
          </button>
          {childFolders(null).map((f) => renderFolder(f, 0))}
          {folders.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-6 leading-relaxed">
              还没有文件夹
              <br />
              先在左侧「📁 文件夹」区点 + 新建
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
