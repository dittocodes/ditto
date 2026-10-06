# Pre-flight checks before client demo
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $Root "..")

$apiPort = if ($env:API_PORT) { $env:API_PORT } else { "8003" }
$base = "http://127.0.0.1:$apiPort"

Write-Host "Health check $base/health ..."
$health = Invoke-RestMethod -Uri "$base/health" -Method Get
if ($health.status -ne "ok") { throw "Health check failed" }
Write-Host "OK: $($health.service)"

Write-Host "Login sample admin..."
$loginBody = @{ id = "ADMIN-SAMPLE-001"; password = "SampleTest123!" } | ConvertTo-Json
try {
    $auth = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
    Write-Host "OK: admin login token received"
} catch {
    Write-Warning "Admin login failed (run seed_local_roles.py): $_"
}

$py = Join-Path $Root ".." ".venv\Scripts\python.exe"
if (Test-Path $py) {
    Write-Host "Running demo data audit..."
    & $py scripts/audit_demo_data_leaks.py
}

Write-Host "Pre-flight complete."
