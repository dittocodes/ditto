# Deep audit — student redesign vs master plan

**Audit date:** 2026-03-26  
**Automated checks:** `pytest tests/` → **4 passed** (with `DEV_SQLITE=1`); frontend `npm run build` was green after last changes.

---

## Blockers (must fix to run on production DB)

| Issue | Detail |
|--------|--------|
| **MySQL access** | `.env` → `16.16.70.205` still returns `Access denied for user 'workbench_user'@'103.171.99.66'`. App startup runs `Base.metadata.create_all` — will fail or be incomplete until grants/credentials are fixed. |
| **Run seed on MySQL** | `scripts/seed_sample_student.py` not verified against live MySQL (only SQLite/dev). |

---

## Done (matches plan intent)

- Phases **0–12** API surface on `/api/v1` (overview, profile, analysis, uploads, jobs, SWOT, activities, CV, documents, campus, chat, LiveKit join, profile review, PDF reports).
- Pipeline **5 stages** + notify + dead-letter; OCR/PII split modules; living reports + snapshots.
- Tracker **shell + routes**; dashboard/analysis/profile depth; onboarding; Support Assistant + `/chat`.
- Sample seed, `docs/SAMPLE_STUDENT.md`, integration tests (vault dedupe, job idempotency, overview payload).
- Login → **`/dashboard`**; mentor v1 activity PATCH API.

---

## Gaps vs master plan (still open)

### High (functional)

| Gap | Plan reference | Notes |
|-----|----------------|--------|
| **Download Transcript** | Profile Documents | Button in UI has **no handler** (SWOT/progress PDF downloads work via Analysis). |
| **Meetings mockup** | Phase 8 | No Cancel / Add to Calendar; calendar widget; recording → **`meeting_summary`** pipeline **not built**. |
| **Campus list API** | Phase 9 | Upload only; no `GET /campus` or UI list of `campus_activities`. |
| **CV as async job** | Phase 10 | `POST /cv/generate` is **sync** (stores JSON preview), not 202 + heavy PDF job. |
| **Onboarding manual form** | Phase 3 | Wizard = consent/ID + links + review; no full pre-filled profile edit step beyond review API. |
| **Admin KB UI** | Phase 6 | `GET/POST /api/v1/admin/knowledge-base` only — **no admin React screen**. |
| **Mentor UI for v1 PATCH** | Phase 7 | API exists; mentor app still uses legacy activity flows. |

### Medium (§10 / engineering)

| Gap | Notes |
|-----|--------|
| **`doc_types.yaml` / `id_card_jain.yaml`** | Files exist but **not loaded** by pipeline/classifier code. |
| **Conflict review queue** | Living-report merge is silent overwrite; no mentor/admin queue. |
| **`GEMINI_DAILY_BUDGET` / cost cap** | Not implemented. |
| **UID backfill script** | Plan mentions backfill for existing students; only `ensure_student_uid` on demand. |
| **Shadow writes** | Optional dual-write to legacy `academic_performance` — **not done**. |
| **Erasure / tombstone job** | §10.3 — **not done**. |
| **Redis insight cache** | In-process TTL only (`insight_cache.py`); Redis in requirements unused for insights. |
| **Pydantic validation** | `tracker_insights.py` schemas **not enforced** on API responses. |
| **`cryptography` (Fernet)** | Used when `PII_FERNET_KEY` set but **not in `requirements.txt`**. |
| **MySQL migration** | `migrations/student_redesign_phase0.sql` uses `ADD COLUMN IF NOT EXISTS` (MySQL 8.0.12+); prod may need manual run; dev relies on `create_all`. |

### Low (polish / plan “definition of done”)

| Gap | Notes |
|-----|--------|
| **Pixel-perfect PNGs** | Layout implemented; not visual-regression tested. |
| **Plan shell components** | No separate `TrackerPageHeader`, `TrackerStatCard`, `TrackerTabBar`, etc. (logic inlined in pages). |
| **`useTrackerProfile` / `useTrackerAnalysis`** | Only `useProcessingJob.js` (+ inline `useEffect` in pages). |
| **`REACT_APP_TRACKER_UI`** | Flag unused; Tracker always on via `StudentDashboard`. |
| **`tests/fixtures/documents/`** | Missing synthetic PDF corpus from plan. |
| **Playwright / visual QA** | Not implemented. |
| **Legacy insight service** | `genai_service.py` still used by observation/analysis legacy routes (not fully migrated to `InsightGateway`). |
| **Activities “overdue” tab** | UI tab exists; statuses in DB are `pending` / `in_progress` — **overdue filter never matches** unless you derive from `due_date`. |
| **Chat auth** | Uses `get_uid_for_current_student` but path `{uid}` is not validated via `get_student_by_uid` (token uid check only — OK if consistent). |

---

## Recommended order to finish

1. **Fix MySQL** grants for `workbench_user` from your IP → run seed → smoke login on real data.
2. Wire **Download Transcript** → `downloadReport(uid, 'academic')`.
3. **Activities overdue** → filter by `due_date < now` when tab is `overdue`.
4. **Load `doc_types.yaml`** in `pipeline_processor` for categories/report_target.
5. Admin **Knowledge Base** minimal page (list + POST).
6. Meetings: **Cancel** via legacy API if exists + optional calendar link.
7. Optional: meeting recording → vault → `meeting_summary` (larger chunk).

---

## Fix applied during this audit

- **`GET /swot`** now falls back to latest `SwotEntry` when no living `swot_report` exists (avoids false empty state after seed/form-only SWOT).

---

## Verdict

**Codebase:** MVP+ complete for student Tracker redesign; automated tests green on SQLite.  
**Production-ready:** **No** until MySQL auth works and you run seed + manual smoke on `16.16.70.205`.  
**Plan “100%”:** **Mostly** — pixel/visual QA and Playwright still optional; MySQL ops remain.

### Implemented after audit (2026-03-26 batch)

- Profile **Download Transcript** wired; **CV async job** + poll; **campus GET** + UI list; **activities overdue** by `due_date`
- Meetings **cancel**, **ICS calendar**, **recording → meeting_summary** pipeline
- **doc_types.yaml** loaded in pipeline; **GEMINI_DAILY_BUDGET**; **review queue** + admin resolve; **erasure** admin endpoint
- **UID backfill** + **MySQL test** scripts; **Redis** insight cache layer; **Pydantic** on overview/profile/analysis; **cryptography** + **PyYAML** in requirements
- Admin **Knowledge Base** UI; mentor **v1 activity** panel; onboarding **profile edit** step; **`REACT_APP_TRACKER_UI`**; hooks **`useTrackerProfile` / `useTrackerAnalysis`**; document fixture PDF
