@echo off
title Trending Launcher
echo ================================================================
echo 🚀 LAUNCHING TRENDING DIGITAL ECOSYSTEM LOCAL ENGINE...
echo ================================================================
cd /d "%~dp0"

:: Test if python launcher is available
py --version >nul 2>&1
if %errorlevel% equ 0 (
    echo [+] Python detected. Launching secure localhost server...
    echo [+] Chrome and Edge speech recognition STT fully enabled!
    py run_server.py
) else (
    echo [-] Python launcher not found. Falling back to direct static file...
    echo [!] NOTE: Browsers require localhost or HTTPS for mic permissions.
    echo [!] Direct file load will disable the Speech Assistant mic.
    start "" "index.html"
)
exit
