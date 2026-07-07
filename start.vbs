' Pi History Viewer 静默启动器：隐藏窗口调用同目录 start.bat（自动定位，无需改路径）
Set fso = CreateObject("Scripting.FileSystemObject")
here = fso.GetParentFolderName(WScript.ScriptFullName)
CreateObject("WScript.Shell").Run "cmd /c """ & here & "\start.bat""", 0, False
