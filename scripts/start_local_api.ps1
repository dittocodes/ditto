# Start FastAPI against local MySQL (.env). Default port 8003 (8000 may be stuck on Windows).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root
$Python = Join-Path $Root ".venv\Scripts\python.exe"
$Port = if ($env:API_PORT) { $env:API_PORT } else { "8003" }
Write-Host "Starting API on http://127.0.0.1:$Port (Ctrl+C to stop)" -ForegroundColor Cyan
Write-Host "Frontend dev proxy targets this port (see frontend/vite.config.js)." -ForegroundColor DarkGray
& $Python -m uvicorn app.main:app --host 127.0.0.1 --port $Port --reload
