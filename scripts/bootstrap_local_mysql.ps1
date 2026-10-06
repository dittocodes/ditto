# Bootstrap local MySQL80: database, schema, sample student, committee test accounts.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$Python = Join-Path $Root ".venv\Scripts\python.exe"
if (-not (Test-Path $Python)) {
    Write-Error "Create venv first: python -m venv .venv && .\.venv\Scripts\pip install -r app\requirements.txt"
}

$Steps = @(
    @{ Name = "Ensure database"; Script = "scripts\ensure_mysql_database.py" },
    @{ Name = "Create tables"; Script = "scripts\init_mysql_schema.py" },
    @{ Name = "Seed sample student"; Script = "scripts\seed_sample_student.py" },
    @{ Name = "Seed demo personas"; Script = "scripts\seed_demo_personas.py" },
    @{ Name = "Seed mentor/admin/meetings"; Script = "scripts\seed_local_roles.py" },
    @{ Name = "Seed committee members"; Script = "seed_committee_members.py" },
    @{ Name = "Seed working committee (3)"; Script = "seed_working_committee_three.py" },
    @{ Name = "Seed HOD departments"; Script = "seed_hod_departments.py" },
    @{ Name = "Seed department faculty wc01"; Script = "seed_department_faculty_wc01.py" },
    @{ Name = "Seed program faculty"; Script = "seed_program_faculty.py" }
)

foreach ($step in $Steps) {
    Write-Host "`n=== $($step.Name) ===" -ForegroundColor Cyan
    & $Python $step.Script
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed: $($step.Script)"
    }
}

Write-Host "`n=== Bootstrap complete ===" -ForegroundColor Green
Write-Host @"

Login accounts (see docs/SAMPLE_STUDENT.md):

  Student (Tracker):  JAIN-SAMPLE-2026-001  /  SampleTest123!
  Mentor:             MENTOR-SAMPLE-001       /  SampleTest123!
  Admin:              ADMIN-SAMPLE-001        /  SampleTest123!
  Leader:             leader1               /  Committee@1
  Working committee:  wc1, wc2, wc3        /  Committee@1  (also wc01-wc03 @ Committee@123 from working committee seed)
  Faculty / HOD / PF:  see seed script docstrings

Start API:
  .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

"@
