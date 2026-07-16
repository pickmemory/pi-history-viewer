' Pi History Viewer silent launcher: runs start.bat in a hidden window.
Set fso = CreateObject("Scripting.FileSystemObject")
here = fso.GetParentFolderName(WScript.ScriptFullName)
CreateObject("WScript.Shell").Run "cmd /c """ & here & "\start.bat""", 0, False
