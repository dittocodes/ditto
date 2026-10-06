# Student redesign — build status (Phases 0–12)

**Status:** Feature-complete for MVP. Pixel polish and MySQL production validation may continue iteratively.

## Backend

| Phase | Delivered |
|-------|-----------|
| 0 | UID, platform tables, vault, jobs, worker, `/api/v1`, InsightGateway, insight cache |
| 1–2 | OCR/PII services, pipeline, living reports, snapshots, notify, DLQ |
| 3 | Onboarding API: links, id-card, **profile/review** |
| 4–5 | Academic/career upload + records |
| 6 | SWOT + KB admin API + activity generation from weaknesses |
| 7 | Activities CRUD, evidence upload, mentor PATCH |
| 8 | LiveKit join token |
| 9 | Campus upload |
| 10 | CV generate, documents list, **PDF report download** |
| 11–12 | Overview/profile/analysis + chat |

Config: `app/config/doc_types.yaml`, `app/config/id_card_jain.yaml`

## Frontend

Tracker shell, full dashboard sections, profile 4 tabs, analysis 4 tabs, SWOT, activities (filters), meetings, onboarding wizard, campus, **/chat**, Support Assistant FAB.

Hooks: `useProcessingJob.js`, `useTrackerOverview` in same file.

## Tests

```powershell
$env:DEV_SQLITE="1"
python -m pytest tests/ -q
```

## Run

See [SAMPLE_STUDENT.md](./SAMPLE_STUDENT.md). Database host: **16.16.70.205** in `.env`.

## Not in scope (plan §11)

Predictive analytics, ERP sync, full admin KB CMS UI, Playwright visual snapshots, Redis cluster (in-process cache used).
