# Sample student & local login accounts

## Local MySQL80 (Workbench)

| Setting | Value |
|---------|--------|
| Connection | Local instance MySQL80 |
| Hostname | `localhost` or `127.0.0.1` |
| Port | `3306` |
| Username | `root` |
| Database | `menteetracker` |

Set `DATABASE_URL` in `.env` (encode `@` in password as `%40`):

`mysql+pymysql://root:YOUR_ENCODED_PASSWORD@127.0.0.1:3306/menteetracker`

## One-command bootstrap

From `mentee-main\mentee-main` (MySQL80 service running). **Do not set `DEV_SQLITE=1` in the shell** when using local MySQL — that seeds a separate SQLite file the API will not use.

```powershell
.\scripts\bootstrap_local_mysql.ps1
```

This creates the database, **all ORM tables** (`create_all` via [`app/db/models/registry.py`](app/db/models/registry.py)), sample student, mentor/admin/meetings, and committee test users.

Manual steps (equivalent):

```powershell
.\.venv\Scripts\python.exe scripts\ensure_mysql_database.py
.\.venv\Scripts\python.exe scripts\init_mysql_schema.py
.\.venv\Scripts\python.exe scripts\seed_sample_student.py
.\.venv\Scripts\python.exe seed_committee_members.py
# optional: other seed_*.py scripts in project root
```

## Login accounts

| Role | Login ID | Password | Notes |
|------|----------|----------|--------|
| Student (Tracker QA) | `JAIN-SAMPLE-2026-001` | `SampleTest123!` | Dashboard, onboarding, uploads |
| Mentor | `MENTOR-SAMPLE-001` | `SampleTest123!` | Linked to sample student + meetings |
| Admin | `ADMIN-SAMPLE-001` | `SampleTest123!` | Admin routes |
| Leader | `leader1` | `Committee@1` | `seed_committee_members.py` |
| Working committee | `wc1`, `wc2`, `wc3` | `Committee@1` | Same seed |
| Working committee (alt) | `wc01`, `wc02`, `wc03` | `Committee@123` | `seed_working_committee_three.py` |
| Dept / HOD / program faculty | per `seed_*.py` docstrings | usually `Committee@1` | Run full bootstrap |

Student email in DB: `sample.student@jain.test`

## Client demo personas

Reset before each demo:

```powershell
.\scripts\reset_demo_environment.ps1
```

| Login USN | Password | Role |
|-----------|----------|------|
| `JAIN-DEMO-DAY0-001` | `SampleTest123!` | Empty profile — live uploads / onboarding |
| `JAIN-DEMO-STRONG-001` | `SampleTest123!` | Full semester — CV + report pack |
| `JAIN-DEMO-AVG-001` | `SampleTest123!` | Mid performer (analysis contrast) |
| `JAIN-DEMO-RISK-001` | `SampleTest123!` | At-risk (analysis contrast) |

See [DEMO_RUNBOOK.md](./DEMO_RUNBOOK.md) for the 30-minute script. Synthetic files live under `demo_assets/documents/`.

Set `DEMO_MODE=1` on the API for faster worker polling and admin worker burst. Example env: [`.env.demo.example`](../.env.demo.example).

**QA mock numbers:** Sample seed may set `display_metrics` on the `tracker_dashboard` living report (e.g. 24 activities, 128 learning hours) for screenshot parity. Other students use DB facts and document-pipeline deltas unless you add that block manually.

## Run app

```powershell
cd mentee-main\mentee-main
.\scripts\start_local_api.ps1
```

Uses port **8003** by default (avoids a stuck listener on 8000). Override: `$env:API_PORT="8000"; .\scripts\start_local_api.ps1`

```powershell
cd frontend
npm run dev
```

Student URL after login: `/student/JAIN-SAMPLE-2026-001/dashboard`

## Smoke path

1. Login as sample student → dashboard (`/student/JAIN-SAMPLE-2026-001/dashboard`) — four summary cards (24 / 18 / 85.7 / 32), KPI carousel **1 / 2**, Global Benchmark row (re-seed + overview refresh if numbers look stale)  
2. Profile · Analysis · SWOT · Activities  
3. Upload academic doc → poll job  
4. **Activities tab:** nine mock cards (re-run `python scripts/seed_sample_student.py` to refresh activity rows)  
5. **Profile tab:** overview layout + `GET /api/v1/students/{uid}/profile?tab=overview|academic|career|documents` (stats, achievements, skills from DB; re-seed for links/name)  
   - **Academic tab:** courses, GPA trend, credits, attendance, honors, competency via `build_academic_tab()` + `academic_report` living report  
   - **Career tab:** goals, experience, mentor, analytics metrics, skill breakdown, performance indicators, semester achievements, recent activity, growth analysis, learning resources via `build_career_tab()` + optional `career_report` structured state (defaults from `mock_tracker_profile`)  
   - **Documents tab:** CV preview/actions plus `documents.library` list (mock library when none uploaded)  
   - After backend changes, call profile refresh or wait for cache expiry before re-testing tabs.
6. **Analysis tab:** `GET /api/v1/students/{uid}/analysis?tab=overview|skills|comparison|reports` — Overview: Jan–Jun activity chart, skill pie, performance trend (W1–W8), skill growth Previous/Current, Analytics Report sidebar, Monthly Report + Meeting Notes CTAs; other tabs match mock layouts (re-seed for chart/sidebar defaults).  
   - **Skills sub-tab:** SWOT (Strengths/Weaknesses/Opportunities/Threats), mentor recommendations panel, key metrics bars, horizontal skills assessment chart, recommendation cards — `build_skills_tab_payload()` + seeded SWOT (`Oct 15, 2023`).  
   - **Comparison sub-tab:** `comparison.chart_rows`, improvement/focus cards, `activity_progress`, `global_benchmark`, and `performance_analysis` via `build_comparison_tab_payload()` (override via `comparison_*` keys on `tracker_dashboard`).
7. **Meetings:** `/student/JAIN-SAMPLE-2026-001/meetings` — upcoming/completed tabs, join/calendar/cancel actions, calendar + stats (seed via `scripts/seed_local_roles.py` → `MOCK_TRACKER_MEETINGS`).
8. **Support:** `/student/JAIN-SAMPLE-2026-001/chat` or the yellow **Support Assistant** FAB — sample thread, search history, quick prompts, voice search (Chrome/Edge; mic permission required).
9. **Onboarding:** `/student/JAIN-SAMPLE-2026-001/onboarding` — 5-step wizard (consent + ID upload, links, profile, review, done) with progress bar and API hooks (`id-card`, links, profile review).
10. Optional: `python scripts/tracker_ui_smoke.py` with API running  

## Remote server

To switch back to shared RDS, change `DATABASE_URL` in `.env` to the remote host/database and ensure your IP is whitelisted (MySQL error 1130).
