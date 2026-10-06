# Local student journey (Phases 1–9)

Runnable protocol on the **existing local stack**: FastAPI + APScheduler (`WORKER_POLL_SECONDS=5`) + MySQL (or SQLite only if you set `DEV_SQLITE`) + Vite. **No Redis / Celery.**

Use after a clean demo reset. Exact GPA (e.g. 3.82) and career readiness scores depend on document extract quality — treat those as soft expectations.

## Quick start (Windows)

```powershell
cd mentee-main\mentee-main
Remove-Item Env:DEV_SQLITE -ErrorAction SilentlyContinue
$env:DEMO_MODE = "1"
$env:WORKER_POLL_SECONDS = "5"
.\scripts\reset_demo_environment.ps1
.\scripts\start_local_api.ps1
```

In a second terminal:

```powershell
cd mentee-main\mentee-main\frontend
npm run dev
```

- UI: http://127.0.0.1:3000  
- API: http://127.0.0.1:8003  

Optional Day0 baseline check (API must be running):

```powershell
$env:API_BASE = "http://127.0.0.1:8003"
.\.venv\Scripts\python.exe scripts\local_journey_smoke.py
```

Full Phases 1–9 + personas + chat refusals (API with `DEMO_MODE=1`):

```powershell
$env:API_BASE = "http://127.0.0.1:8003"
.\.venv\Scripts\python.exe scripts\local_journey_e2e.py
```

## Credentials

| Role | USN | Password |
|------|-----|----------|
| Day0 journey | `JAIN-DEMO-DAY0-001` | `SampleTest123!` |
| Strong (seeded semester-end) | `JAIN-DEMO-STRONG-001` | `SampleTest123!` |
| Mentor | `MENTOR-SAMPLE-001` | `SampleTest123!` |
| Admin | `ADMIN-SAMPLE-001` | `SampleTest123!` |

## Demo assets (Day0)

Under `demo_assets/documents/day0/`:

| File | Phase use |
|------|-----------|
| `id_card.pdf` | Onboarding ID OCR |
| `marklist_sem1.pdf`, `marklist_sem2.pdf` | Academic / GPA extract |
| `cert_*.pdf`, `conference_proof.pdf` | Academic / skills evidence |
| `internship_letter.pdf` | Career / offer-style upload |
| `project_report.pdf`, `campus_event.pdf` | Extra academic/campus |

Also:

- `demo_assets/meeting_transcript_sample.txt` — meeting transcript upload
- Any small PDF/PNG/TXT — activity evidence stub

Regenerate: `python scripts/generate_demo_documents.py`

## Real table names (SQL checks)

| Concept | Table / model |
|---------|----------------|
| Activities | `activities_v2` (`StudentActivityV2`) |
| Living reports | `living_reports` |
| Report history | `report_snapshots` |
| PII vault | `pii_vault` |
| Processing jobs | `processing_jobs` (or equivalent job table used by worker) |
| Links | `student_links` |
| Knowledge base | campus KB seed rows from `demo_personas.DEMO_KB_ENTRIES` |

Example checks (MySQL; adjust schema name):

```sql
SELECT report_type, version FROM living_reports WHERE uid = '<day0-uid>' ORDER BY report_type;
SELECT id, title, origin, progress_pct, status, linked_swot_item FROM activities_v2 WHERE uid = '<day0-uid>';
SELECT verified_bool, url FROM student_links WHERE uid = '<day0-uid>';
SELECT verified_at FROM students WHERE student_usn = 'JAIN-DEMO-DAY0-001';
```

## Report ZIP contents

`GET /api/v1/students/{uid}/reports/pack` downloads `mentee-report-pack.zip` containing:

- `swot-report.pdf`
- `progress-report.pdf`
- `academic-report.pdf`
- `skills-report.pdf`
- `curriculum-vitae.pdf` (when CV generation has completed)

## Soft OCR / extract notes

- After any upload, wait for the **processing banner** (or Admin → Run worker burst) before asserting dashboard fields.
- GPA / course rows materialize from marksheet extract into `academic_report`. If extract is weak, refresh Profile Academic after the worker finishes and re-check `living_reports`.
- Career readiness (e.g. “78/100 Offer Accepted”) is **not guaranteed**; look for career timeline / structured fields in the Career tab when present.
- Link verification is best-effort HEAD/GET (3s timeout). Unreachable URLs stay `verified_bool=0` without failing onboarding.

---

## Phase 1 — Day0 baseline

1. Reset → login `JAIN-DEMO-DAY0-001`.
2. Open Dashboard / overview.
3. **Expect:** summary cards at **0**, empty/near-empty charts, no completed activity tiles (`day0_baseline` when no `tracker_dashboard` living report).

Smoke: `local_journey_smoke.py` asserts zero summary card values.

## Phase 2 — Onboarding

1. Go to Onboarding wizard.
2. Consent → upload `documents/day0/id_card.pdf` → add LinkedIn/GitHub-style `http(s)` links → review/approve profile.
3. **Expect:** processing stages in banner; after approve, `students.verified_at` set; links may show verified when HEAD/GET returns 2xx.

## Phase 3 — Academic

1. Upload marksheets (+ optional certs) from `documents/day0/`.
2. Watch banner → Profile Academic tab.
3. **Expect:** `academic_report` version increments; courses/GPA appear when extract succeeds (soft-assert).

## Phase 4 — Career

1. Upload `internship_letter.pdf` via career upload.
2. **Expect:** `career_report` updates; Career tab shows timeline / readiness when structured fields exist (soft).

## Phase 5 — SWOT → KB activities

1. Submit SWOT with weaknesses mentioning **public speaking / stage fright** and **whiteboarding / system design / interviews**.
2. **Expect:** ≥1 activity titled like **Attend Campus Toastmasters sessions** and ≥1 skill/interview-style activity (whiteboarding lab), `origin=ai`, linked SWOT item, grounded in seeded KB.

## Phase 6 — Activities + meeting transcript

1. Activities page: set progress slider → Save / Mark complete; **Upload evidence**.
2. Meetings page: on a meeting card → **Upload Transcript** (`meeting_transcript_sample.txt`).
3. **Expect:** PATCH updates `activities_v2`; evidence + transcript enqueue jobs; banner tracks jobs.

## Phase 7 — Dashboard refresh

1. After activity/meeting completion, refresh overview (or hard reload).
2. **Expect:** Day0 empty baseline replaced by live facts + living reports (no longer all zeros once `tracker_dashboard` / facts exist).

## Phase 8 — Chat

1. Ask grounded questions about SWOT / academics.
2. Ask peer GPA / batch compare / “predict next semester grade”.
3. **Expect:** refusals for peer/predict; grounded answers can cite living report types/versions (e.g. `swot_report v1`).

## Phase 9 — Documents

1. Profile Documents → Generate CV; Download report pack ZIP.
2. **Expect:** CV job completes; ZIP downloads with the names listed above.

---

## Acceptance checklist

- [ ] Reset → Day0 Phase 1 dashboard zeros/empty
- [ ] Onboarding ID + approve sets `verified_at`
- [ ] Academic + career uploads complete via banner; living report versions increment
- [ ] SWOT creates ≥1 Toastmasters-style and ≥1 whiteboarding/interview-style activity
- [ ] Activity 100% + evidence; meeting transcript upload from UI
- [ ] Chat refuses peer/predict; cites report context after data exists
- [ ] Generate CV + ZIP succeed

See also [DEMO_RUNBOOK.md](./DEMO_RUNBOOK.md) for the shorter client demo run-of-show.
