# Demo reset: clears demo UIDs, regenerates documents, re-seeds personas and roles.
$ErrorActionPreference = "Stop"
Remove-Item Env:DEV_SQLITE -ErrorAction SilentlyContinue
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
Set-Location $ProjectRoot

$py = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $py)) { $py = "python" }

Write-Host "Generating demo documents..."
& $py scripts/generate_demo_documents.py

Write-Host "Clearing demo platform data..."
& $py scripts/clear_demo_data.py

Write-Host "Seeding demo personas..."
& $py scripts/seed_demo_personas.py

Write-Host "Seeding mentor/admin/meetings..."
& $py scripts/seed_local_roles.py

Write-Host "Running demo data audit..."
& $py scripts/audit_demo_data_leaks.py
if ($LASTEXITCODE -ne 0) { throw "Demo audit failed" }

Write-Host "Demo environment reset complete."
