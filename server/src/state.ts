import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import os from "node:os";

/* ─────────── 收藏 / 重命名 / 文件夹 持久化（viewer 私有状态） ─────────── */

export interface Folder {
  id: string;
  name: string;
  parentId: string | null; // null = 根级
}

export interface ViewerState {
  favorites: string[]; // 收藏的 session id
  titles: Record<string, string>; // id -> 自定义标题
  folders: Folder[];
  folderAssignments: Record<string, string>; // sessionId -> folderId
}

function getStateFile(): string {
  return (
    process.env.VIEWER_STATE_FILE ||
    path.join(os.homedir(), ".pi", "agent", "viewer-state.json")
  );
}

let state: ViewerState = { favorites: [], titles: {}, folders: [], folderAssignments: {} };
let loaded = false;

export function loadState(): ViewerState {
  if (loaded) return state;
  loaded = true;
  try {
    const raw = readFileSync(getStateFile(), "utf-8");
    const o = JSON.parse(raw);
    state.favorites = Array.isArray(o.favorites) ? o.favorites : [];
    state.titles = o.titles && typeof o.titles === "object" ? o.titles : {};
    state.folders = Array.isArray(o.folders) ? o.folders : [];
    state.folderAssignments =
      o.folderAssignments && typeof o.folderAssignments === "object"
        ? o.folderAssignments
        : {};
  } catch {
    // 文件不存在或损坏：用默认空状态
  }
  return state;
}

function saveState() {
  try {
    const file = getStateFile();
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(state, null, 2), "utf-8");
  } catch (e) {
    console.error("[state] 保存失败:", e);
  }
}

/* ── 收藏 ── */
export function isFavorite(id: string): boolean {
  loadState();
  return state.favorites.includes(id);
}
export function setFavorite(id: string, fav: boolean) {
  loadState();
  if (fav) {
    if (!state.favorites.includes(id)) {
      state.favorites.push(id);
      saveState();
    }
  } else {
    // 取消收藏时连同归类一起清掉
    const before = state.favorites.length;
    state.favorites = state.favorites.filter((x) => x !== id);
    delete state.folderAssignments[id];
    if (state.favorites.length !== before) saveState();
  }
}

/* ── 标题 ── */
export function getCustomTitle(id: string): string | undefined {
  loadState();
  return state.titles[id];
}
export function setTitle(id: string, title: string | null) {
  loadState();
  if (!title || !title.trim()) {
    if (id in state.titles) {
      delete state.titles[id];
      saveState();
    }
  } else {
    state.titles[id] = title.trim();
    saveState();
  }
}

/* ── 文件夹 ── */
export function getFolders(): Folder[] {
  loadState();
  return state.folders;
}

export function getFolderId(sessionId: string): string | null {
  loadState();
  return state.folderAssignments[sessionId] ?? null;
}

export function createFolder(name: string, parentId: string | null): string {
  loadState();
  const id = randomUUID().slice(0, 8);
  state.folders.push({ id, name: name.trim(), parentId });
  saveState();
  return id;
}

export function renameFolder(id: string, name: string): boolean {
  loadState();
  const f = state.folders.find((x) => x.id === id);
  if (!f) return false;
  f.name = name.trim();
  saveState();
  return true;
}

/** 收集一个文件夹及其所有子孙 id */
function collectDescendants(rootId: string): Set<string> {
  loadState();
  const set = new Set<string>([rootId]);
  let added = true;
  while (added) {
    added = false;
    for (const f of state.folders) {
      if (f.parentId && set.has(f.parentId) && !set.has(f.id)) {
        set.add(f.id);
        added = true;
      }
    }
  }
  return set;
}

export function deleteFolder(id: string): void {
  loadState();
  const toDelete = collectDescendants(id);
  state.folders = state.folders.filter((f) => !toDelete.has(f.id));
  // 会话退回未分类：删除指向这些文件夹的 assignment（保留 favorite）
  for (const sid of Object.keys(state.folderAssignments)) {
    if (toDelete.has(state.folderAssignments[sid])) {
      delete state.folderAssignments[sid];
    }
  }
  saveState();
}

export function setSessionFolder(sessionId: string, folderId: string | null) {
  loadState();
  if (!folderId) {
    if (sessionId in state.folderAssignments) {
      delete state.folderAssignments[sessionId];
      saveState();
    }
  } else {
    state.folderAssignments[sessionId] = folderId;
    saveState();
  }
}
