@echo off
rem Create the PersonaHub desktop shortcut. Double-click, or run: create-shortcut.cmd [extension-id]
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0create-shortcut.ps1" %*
pause
