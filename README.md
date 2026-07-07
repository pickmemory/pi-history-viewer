# Pi History Viewer

只读查看本机所有 **pi agent** 历史会话的 web 界面。

聚合 `~/.pi/agent/sessions/` 下所有目录、所有 `.jsonl` 会话文件，在浏览器里统一浏览——按工作目录分组、支持搜索，完整展示每条会话的用户消息、agent 回复、思考过程与工具调用。

## 特性

- 🔍 **全局汇总**：扫描所有 cwd 下的会话（不限于某个项目）
- 📂 **按目录分组**：左侧自动按工作目录折叠分组
- 🔎 **搜索**：标题 / 目录模糊匹配
- 💬 **完整渲染**：Markdown + 代码块、思考过程折叠、工具调用气泡
- 🪶 **零依赖读取**：后端不依赖 pi SDK，直接按行解析 jsonl（坏行自动跳过）
- 🖥️ **只读**：不启动 agent、不需要 API key、不会写入任何东西
- 🚀 **开机自启**：已配置登录自动运行（见下文）

## 访问地址

**http://localhost:8753**

（端口选了冷门的 8753，避开常用开发端口 3000/5173/8080 等）

## 开机自启（已配置）

本机已通过 **启动文件夹快捷方式** 配置开机自启，无需管理员权限：

- 快捷方式位置：`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\PiHistoryViewer.lnk`
- 启动方式：`wscript.exe` 静默运行 `start.vbs` → 调用 `start.bat` → 运行 `node server/dist/index.js`
- 日志文件：`%TEMP%\pi-history-viewer.log`
- 静默后台运行，无控制台黑窗

**管理自启：**

```powershell
# 查看是否已配置
Get-ChildItem "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\PiHistoryViewer.lnk"

# 取消开机自启（删除快捷方式）
Remove-Item "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\PiHistoryViewer.lnk"

# 手动停止当前运行的服务
D:\self-code\pi-history-viewer\stop.bat
```

## 手动运行（开发/调试）

```bash
cd D:\self-code\pi-history-viewer
npm install

# 方式 A：单端口（生产，需先构建前端）
npm run build:web
cd server && npx tsc && node dist/index.js   # → http://localhost:8753

# 方式 B：开发模式（改前端时用，带热更新）
npm run dev:server   # 终端1：API @ 8753
npm run dev:web      # 终端2：Vite @ 5173，访问 http://localhost:5173
```

## 配置

会话目录默认 `~/.pi/agent/sessions`，端口默认 `8753`，均可用环境变量覆盖：

```bash
PI_SESSIONS_DIR=/path/to/sessions PORT=9000 npm run dev:server
```

> 注意：若改了端口，需同步更新 `start.bat` 和自启快捷方式。

## 数据来源

pi agent 把每个会话存成一行一条 JSON 的 `.jsonl` 文件：

```
~/.pi/agent/sessions/<encoded-cwd>/<timestamp>_<uuid>.jsonl
```

每行一个 JSON，关键字段：

| type          | 含义                                   |
| ------------- | -------------------------------------- |
| `session`     | 文件头，含真实 `cwd` / `id` / `timestamp` |
| `model_change`| 模型切换记录                            |
| `message`     | 对话消息（`role`: user/assistant/toolResult）|

本工具只做只读解析，不修改原始文件。

## 项目结构

```
pi-history-viewer/
├── server/              # Hono 后端，扫描 + 解析 jsonl
│   ├── src/{index,history}.ts
│   └── dist/            # tsc 编译产物（自启运行用）
├── web/                 # React + Vite + Tailwind 前端
│   ├── src/{App.tsx, types.ts, components/*}
│   └── dist/            # vite build 产物（单端口模式托管）
├── start.vbs            # 静默启动器（隐藏窗口）
├── start.bat            # 启动脚本（cd + node，写日志）
└── stop.bat             # 停止服务（释放端口）
```

## 备注

- 渲染样式借鉴自 `feedback-collector` 项目。
- 解析逻辑与 pi 内部 API 解耦，pi 版本升级通常不会影响（除非 jsonl 行结构大改）。
