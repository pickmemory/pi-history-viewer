# 收藏文件夹功能设计

> 日期：2026-07-06
> 状态：已确认，实现中

## 背景
当前收藏是扁平列表（`⭐ 收藏` 组）。升级为可自建的目录树：能新建文件夹/子文件夹，把收藏的会话归到指定文件夹下。

## 已确认决策
- **①A** 文件夹是收藏的二级分类（先收藏，再归类到文件夹）
- **②A** 一个会话只在一个文件夹（移动语义）
- **③A** 未归类的收藏会话显示在「未分类」组
- **④a** hover「移动」按钮 → 文件夹树选择器
- **⑤A** 删除文件夹时，里面的会话退回「未分类」（不丢数据、不取消收藏）

## 数据模型（扩展 `~/.pi/agent/viewer-state.json`）
```json
{
  "favorites": ["sessionId..."],
  "titles": { "sessionId": "自定义标题" },
  "folders": [
    { "id": "f1", "name": "项目A", "parentId": null },
    { "id": "f2", "name": "子目录", "parentId": "f1" }
  ],
  "folderAssignments": { "sessionId": "folderId" }
}
```
- `folders`：扁平数组 + `parentId` 表达任意深度树（`parentId: null` = 根）
- 收藏的会话在 `favorites`；其中 `folderAssignments` 有映射的 = 已归类，没有的 = 未分类
- 删除文件夹：递归收集该文件夹 + 所有子孙 → 从 `folders` 删除 → `folderAssignments` 里指向这些文件夹的条目删除（会话仍在 `favorites`，退回未分类）

## API
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/sessions` | 每个 session 合并 `title`/`favorite`/`folderId` |
| GET | `/api/folders` | 返回 folders 数组 |
| POST | `/api/folders` `{name, parentId}` | 新建，返回 `{id}` |
| PUT | `/api/folders/:id` `{name}` | 重命名 |
| DELETE | `/api/folders/:id` | 删除文件夹及子孙，会话退回未分类 |
| PUT | `/api/sessions/:id/folder` `{folderId}` | 移动（`folderId: null` = 移到未分类） |

## UI（左侧浏览模式）
1. **「📁 文件夹」区**（置顶）
   - 「+ 新建文件夹」按钮（根级）
   - 目录树：节点 `📁 名称(计数)`，点击展开/折叠；hover 显示操作：新建子目录 / 重命名 / 删除
   - 展开后显示该文件夹的子文件夹 + 直接归类的会话
2. **「未分类」组**：收藏但无 folderAssignment 的会话
3. **「📂 按 cwd 分组」**：未收藏会话（保持不变）

会话移动：hover「移动」按钮 → 弹文件夹树选择器（含「未分类」选项 + 「+ 新建文件夹」）。
