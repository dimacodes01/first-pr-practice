@echo off
rem Double-click this file to open ScholarPath at http://localhost:8000/index.html
title ScholarPath - localhost
cd /d "%~dp0"
set "PY="
py -3 --version >nul 2>&1 && set "PY=py -3"
if not defined PY (python --version >nul 2>&1 && set "PY=python")
if not defined PY (
  echo Python is not installed on this computer, so the localhost address cannot start.
  echo ScholarPath will open straight from the file instead. It works the same way.
  start "" "%~dp0index.html"
  pause
  exit /b
)
echo.
echo   ScholarPath is running at:  http://localhost:8000/index.html
echo.
echo   Keep this window open while you use ScholarPath.
echo   Close this window when you are finished.
echo.
start "" /min cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:8000/index.html"
%PY% -m http.server 8000 --bind 127.0.0.1
echo.
echo ScholarPath stopped. If it says the address is already in use, close the other ScholarPath window first.
pause
