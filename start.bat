@echo off
REM Pi History Viewer 启动脚本（后台运行，日志写入 %TEMP%）
cd /d D:\self-code\pi-history-viewer\server
node dist\index.js > "%TEMP%\pi-history-viewer.log" 2>&1
