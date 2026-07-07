# Pi History Viewer

只读查看本机所有 **[pi agent](https://github.com/earendil-works/pi-coding-agent)** 历史会话的 web 界面。

聚合 `~/.pi/agent/sessions/` 下所有目录、所有 `.jsonl` 会话文件，在浏览器里统一浏览——按工作目录分组、全文内容搜索、minimap 导航，完整展示每条会话的用户消息、agent 回复、思考过程与工具调用。

## 特性

- 🔍 **全局汇总**：扫描所有 cwd 下的会话（不限于某个项目）
- 📂 **按目录分组**：左侧自动按工作目录折叠分组
- 🔎 **全文内容搜索**：搜消息正文 / 思考过程 / 错误信息，高亮片段 + 命中数（内存索引，毫秒级）
- 🗺️ **minimap 导航**：VSCode 风格缩略图，拖拽 / 点击快速跳转
- 🔗 **URL 路由**：会话 id 写入 hash，刷新 / 分享链接保留当前会话；一键复制 `pi --session <id>` 续聊命令
- ⚡ **懒渲染**：IntersectionObserver，大会话（数千条消息）打开不卡
- 🪶 **零依赖读取**：后端不依赖 pi SDK，直接按行解析 jsonl（坏行自动跳过）
- 🖥️ **只读**：不启动 agent、不需要 API key、不会写入任何东西

## 快速开始

```bash
git clone https://github.com/pickmemory/pi-history-viewer.git
cd pi-history-viewer
npm install

# 构建前端 + 编译后端
npm run build:web
cd server && npx tsc && cd ..

# 启动 → http://localhost:8753
npm run dev:server
```

开发模式（改前端，带热更新）：另开终端 `npm run dev:web` → http://localhost:5173

## 配置

| 环境变量 | 默认值 | 说明 |
|---------|--------|------|
| `PI_SESSIONS_DIR` | `~/.pi/agent/sessions` | pi 会话目录 |
| `PORT` | `8753` | 服务端口 |

```bash
PI_SESSIONS_DIR=/path/to/sessions PORT=9000 npm run dev:server
```

## 开机自启（Windows，可选）

项目自带静默启动脚本，**均用相对路径**，clone 到任意目录都能用：

- `start.vbs` → 隐藏窗口调用 `start.bat` → `node server/dist/index.js`
- 日志：`%TEMP%\pi-history-viewer.log`
- `stop.bat`：停止服务、释放端口

配置登录自启（无需管理员权限）：在启动文件夹创建一个指向 `start.vbs` 的快捷方式即可。

```powershell
# 打开启动文件夹
explorer.exe shell:startup

# 用 PowerShell 创建快捷方式（把 <项目路径> 换成你 clone 的实际路径）
$ws = New-Object -ComObject WScript.Shell
$lnk = $ws.CreateShortcut("$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\PiHistoryViewer.lnk")
$lnk.TargetPath = "wscript.exe"
$lnk.Arguments = '"<项目路径>\start.vbs"'
$lnk.WorkingDirectory = "<项目路径>"
$lnk.Save()

# 取消自启
Remove-Item "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\PiHistoryViewer.lnk"
```

## 数据来源

pi agent 把每个会话存成一行一条 JSON 的 `.jsonl` 文件：

```
~/.pi/agent/sessions/<encoded-cwd>/<timestamp>_<uuid>.jsonl
```

| type | 含义 |
|------|------|
| `session` | 文件头，含真实 `cwd` / `id` / `timestamp` |
| `model_change` | 模型切换记录 |
| `message` | 对话消息（`role`: user/assistant/toolResult），含 `stopReason`（error/aborted）、`errorMessage` |

本工具只做只读解析，不修改原始文件。

## 项目结构

```
pi-history-viewer/
├── server/              # Hono 后端：扫描 + 解析 jsonl + 全文搜索（内存索引）
│   └── src/{index,history}.ts
├── web/                 # React + Vite + Tailwind 前端
│   └── src/{App.tsx, types.ts, components/{SessionList,ChatWindow,ChatMinimap}}
├── start.vbs / start.bat / stop.bat   # Windows 自启脚本（相对路径）
└── README.md
```

## 致谢

- 渲染样式与解析思路借鉴自 [feedback-collector](https://github.com/pickmemory/feedback-collector)
- 基于 [pi coding agent](https://github.com/earendil-works/pi-coding-agent) 的会话格式

## License

[MIT](./LICENSE)
