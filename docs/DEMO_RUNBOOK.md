# Client demo runbook (~30 minutes)

Use this with a **hosted primary** environment and a **laptop backup** (same reset script, local `.env`).

For the full **Phases 1–9** local student journey (Day0 zeros, SWOT KB activities, activity evidence, transcript UI, SQL table names, soft OCR notes), see **[LOCAL_STUDENT_JOURNEY.md](./LOCAL_STUDENT_JOURNEY.md)**.

## Pre-flight (day before + morning of)

1. Set `DEMO_MODE=1` and `WORKER_POLL_SECONDS=5` on the demo API (see [`.env.demo.example`](../.env.demo.example)).
   PowerShell: `$env:DEMO_MODE="1"; $env:WORKER_POLL_SECONDS="5"` (and clear `DEV_SQLITE` so seed/API use the same MySQL).
2. Confirm primary and secondary insight API keys in `.env` both work; check quota.
3. Set `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` if running a live call.
4. Hosted frontend build: `cd frontend` → copy `.env.demo` → set `VITE_API_BASE_URL` → `npm run build`.
5. Reset demo data:

```powershell
cd mentee-main\mentee-main
.\scripts\reset_demo_environment.ps1
```

6. Start API: `.\scripts\start_local_api.ps1` (port **8003** default).
7. Start UI: `cd frontend; npm run dev` (port **3000**, proxies to API).
8. Run preflight: `.\scripts\demo_preflight.ps1`
9. Optional Day0 baseline: `$env:API_BASE="http://127.0.0.1:8003"; python scripts/local_journey_smoke.py`
10. Optional: `POST /api/v1/students/{uid}/overview/refresh` for each demo student after seed if cache looks stale.

## Demo personas

| Login USN | Password | Use in demo |
|-----------|----------|-------------|
| `JAIN-DEMO-DAY0-001` | `SampleTest123!` | Live onboarding + uploads |
| `JAIN-DEMO-STRONG-001` | `SampleTest123!` | Semester-end dashboard, CV, report pack |
| `JAIN-DEMO-AVG-001` | `SampleTest123!` | Analysis contrast (mid performer) |
| `JAIN-DEMO-RISK-001` | `SampleTest123!` | Analysis contrast (at-risk) |
| `MENTOR-SAMPLE-001` | `SampleTest123!` | Mentor meetings / activities |
| `ADMIN-SAMPLE-001` | `SampleTest123!` | Demo pipeline + review queue |

Dev QA student (unchanged): `JAIN-SAMPLE-2026-001` / `SampleTest123!`

## Synthetic documents

Generated under `demo_assets/documents/`:

- Per persona: `id_card.pdf`, marklists, certificates, conference, internship, project, campus event.
- Shared: `documents/shared/marklist_conflict_v2.pdf`, `messy_scan_skewed.txt`
- Meeting fallback: `demo_assets/meeting_transcript_sample.txt`

Regenerate: `python scripts/generate_demo_documents.py`

## Run of show

| # | Segment | Actions |
|---|---------|---------|
| 1 | Onboarding | Login **DAY0** → `/onboarding` → consent + upload `demo_assets/documents/day0/id_card.pdf` → links → review. Watch **processing banner**. |
| 2 | Privacy | Login **ADMIN** → `/admin/ADMIN-SAMPLE-001/demo-pipeline` → paste job id from upload → show **Raw OCR** vs **Masked (analysis input)**. |
| 3 | Academic vault | **DAY0** or fresh session → Profile Academic or onboarding uploads → batch 4–5 PDFs from `demo_assets/documents/day0/`. Admin **Run worker burst** if needed. |
| 4 | Review queue | Upload `documents/shared/marklist_conflict_v2.pdf` → show pending item → **Accept new** or **Keep old**. |
| 5 | SWOT | Submit SWOT → show new activities citing **Campus resource** from knowledge base. |
| 6 | Mentor | Login **MENTOR-SAMPLE-001** → assigned students → approve/edit activity. |
| 7 | Meeting | Student **Meetings** → Join (LiveKit) OR card **Upload Transcript** with `meeting_transcript_sample.txt`; **STRONG** persona has seeded `meeting_summary`. |
| 8 | Semester end | Login **STRONG** → Dashboard / Analysis / Profile Documents → **Download all reports (ZIP)** (`swot-report.pdf`, `progress-report.pdf`, `academic-report.pdf`, `skills-report.pdf`, `curriculum-vitae.pdf`). |
| 9 | Chat | Ask grounded questions; ask about another student or grade prediction → refusal. |
| 10 | Resilience | (Staging only) unset primary insight key → upload doc → verify secondary in API logs. |

## API shortcuts

- Recent jobs: `GET /api/v1/students/{uid}/jobs/recent`
- Worker burst: `POST /api/v1/admin/demo/run-worker` body `{"count":8}` (requires `DEMO_MODE`)
- Report pack: `GET /api/v1/students/{uid}/reports/pack`
- Refresh insights: `POST .../overview/refresh`, `.../profile/refresh`, `.../analysis/refresh`

## Backup plan

- Record a full dry-run screen capture.
- Laptop: same reset script + local MySQL `DATABASE_URL` in `.env`.
- If LiveKit fails, use **STRONG** seeded meeting summary and transcript upload only.

## Rehearsal checklist

- [ ] Reset script completes without errors
- [ ] `python scripts/audit_demo_data_leaks.py` passes
- [ ] DAY0 profile overview shows empty/zero summary cards (Phase 1 / `local_journey_smoke.py`)
- [ ] Activities page: progress + evidence; Meetings: Upload Transcript
- [ ] STRONG CV exists under `uploads/cv/` and Documents tab
- [ ] Admin pipeline shows masked text for at least one job
- [ ] Report ZIP downloads in under 10s
- [ ] Full Phases 1–9 walkthrough per [LOCAL_STUDENT_JOURNEY.md](./LOCAL_STUDENT_JOURNEY.md)
