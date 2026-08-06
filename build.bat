@echo off
cd /d "%~dp0"
echo Building Scam Guard...
node tools\build.mjs
if errorlevel 1 (
  echo Build failed.
  pause
  exit /b 1
)
echo.
pause
