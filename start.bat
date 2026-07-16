@echo off
REM Pi History Viewer launcher.
REM Portable: resolves its own dir (%~dp0), so it runs from any clone path.
cd /d "%~dp0server"

echo ============================================
echo   Pi History Viewer
echo ============================================
echo   URL : http://localhost:8753
echo   Log : "%TEMP%\pi-history-viewer.log"
echo   Stop: run stop.bat  (or close this window)
echo ============================================
echo.
echo Starting server... (this window stays open while it runs)

node dist\index.js > "%TEMP%\pi-history-viewer.log" 2>&1

if errorlevel 1 (
  echo.
  echo [ERROR] Server exited with code %errorlevel%.
  echo See log for details: "%TEMP%\pi-history-viewer.log"
  echo.
  pause
)
