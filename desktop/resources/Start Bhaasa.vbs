Option Explicit
Dim shell, files, app
Set shell = CreateObject("WScript.Shell")
Set files = CreateObject("Scripting.FileSystemObject")
app = files.BuildPath(files.GetParentFolderName(WScript.ScriptFullName), "Bhaasa.exe")
On Error Resume Next
shell.Run Chr(34) & app & Chr(34), 0, False
If Err.Number <> 0 Then MsgBox "Could not start Bhaasa. Run Bhaasa.exe directly to see startup messages.", 48, "Bhaasa"
