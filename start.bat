@echo off
REM Pi History Viewer 启动脚本（后台运行，日志写入 %TEMP%）
REM %~dp0 = 本脚本所在目录（项目根），自动定位，clone 到任意路径都无需修改
cd /d "%~dp0server"
node dist\index.js > "%TEMP%\pi-history-viewer.log" 2>&1
