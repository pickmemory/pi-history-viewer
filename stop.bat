@echo off
REM 停止 Pi History Viewer 服务（释放 8753 端口）
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8753 " ^| findstr LISTENING') do taskkill /F /PID %%a
echo Pi History Viewer 已停止。
