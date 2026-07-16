@echo off
REM Stop Pi History Viewer (frees port 8753).
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8753 " ^| findstr LISTENING') do taskkill /F /PID %%a
echo Pi History Viewer stopped.
