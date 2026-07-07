' Pi History Viewer 静默启动器：隐藏控制台窗口调用 start.bat
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c ""D:\self-code\pi-history-viewer\start.bat""", 0, False
Set WshShell = Nothing
