# Dashboard design spec + API contract

Reference mockups: [`reference/dashboard/`](reference/dashboard/) (7 PNGs, scroll order 01–07).

## Scroll order → payload keys

| # | UI section | JSON path | Component |
|---|------------|-----------|-----------|
| 1 | Header pills | (routes only) | `TrackerPageHeader` |
| 2 | Summary stat cards ×4 | `summary_cards[]` | `TrackerStatCard` |
| 3 | KPI grid ×4 | `kpis[]` | `TrackerKpiCard` |
| 4 | Global benchmark | `global_benchmark` | Radar chart |
| 5 | Performance analysis ×4 | `performance_analysis[]` | `PerformanceRow` |
| 6 | Learning pathway | `learning_pathway.phases[]` | `TrackerPathwayTimeline` |
| 7 | Activity completion + skill distribution | `charts.activity_completion`, `charts.skill_distribution` | Recharts |
| 8 | Performance trend + skill growth | `charts.performance_trend`, `charts.skill_growth` | Recharts |
| 9 | Recent activities | `recent_activities[]` | `TrackerActivityCard` grid |
| 10 | Skills overview | `skills_overview[]` | Horizontal bars |
| 11 | Activity reminders | `activity_reminders` | `TrackerActivityReminders` |
| 12 | Activity progress + meetings | `charts.activity_progress`, `meeting_widgets` | Recharts + `TrackerMeetingsWidget` |

## Field contracts

### `summary_cards[]`

| Field | Type | Source |
|-------|------|--------|
| `title` | string | Fixed labels |
| `value` | number | DB aggregates |
| `trend_pct` | number | Snapshot / prior period delta |
| `progress_pct` | number | 0–100 |
| `last_updated` | string | Assembly time |
| `icon` | `activities` \| `meetings` \| `score` \| `hours` | Fixed |

### `kpis[]`

| Field | Type | Source |
|-------|------|--------|
| `title`, `value`, `trend_pct`, `icon`, `icon_tone` | | Computed |
| `value_number`, `value_unit` | string | Split display value for reference UI |
| `weeks` | number[4] | Rolling 4-week series (W1–W4) |
| `bar_heights` | int[4] | Normalized mini-chart heights (8–35) from `weeks` |

### `benchmark_panel`

| Field | Type | Source |
|-------|------|--------|
| `items[].label` | string | Top axes from `global_benchmark` |
| `items[].score` | int | `your_score` (unchanged by enrich) |
| `items[].insight` | string | Optional enrich copy (max 120 chars) |

### `performance_analysis[]` (exactly 4 rows for UI)

| Field | Type |
|-------|------|
| `skill` | string |
| `score`, `global_avg` | number |
| `trend` | `up` \| `down` |
| `trend_pct` | number |
| `narrative` | string (enrich optional) |

### `recent_activities[]`

| Field | Type |
|-------|------|
| `title`, `description`, `progress_pct`, `due_date`, `mentor_remarks` | |
| `term_tag` | e.g. Long-term, Mid-term, Short-term |
| `status_tag` | e.g. In Progress, Completed, Reviewed |
| `icon` | `progress` \| `completed` \| `reviewed` |

### `activity_reminders`

| Field | Type |
|-------|------|
| `upcoming_meetings` | int |
| `pending_activities` | int |
| `message` | string |
| `cta_label` | string (default `Set Reminders`) |

### `meeting_widgets`

| Field | Type |
|-------|------|
| `upcoming`, `completed`, `cancelled` | int |
| `reminder_text` | string |
| `event_dates` | ISO date strings |

### Chart blocks

Each chart object includes optional `subtitle`. Keys: `activity_completion`, `skill_distribution`, `performance_trend`, `skill_growth`, `activity_progress`.

### `skill_growth[]`

| Field | Type |
|-------|------|
| `skill`, `previous`, `current`, `growth_pct` | |

## Mapping workflow (hybrid)

1. **Load** DB facts (student, activities, meetings), `LivingReport` type `tracker_dashboard`, prior `ReportSnapshot`.
2. **Compute** all numbers in Python ([`dashboard_mapper.py`](../../app/services/dashboard_mapper.py)). Living-report fields (`performance_score`, `global_rank`, `benchmark`, …) take precedence; `display_metrics` in structured_state is **QA-only** for local mock numbers.
3. **Optional enrich** — [`dashboard_enrich.yaml`](../../app/prompts/dashboard_enrich.yaml) via `enrich_dashboard()`; copy-only merge (`merge_dashboard_copy`). Document uploads use [`dashboard_extract.yaml`](../../app/prompts/dashboard_extract.yaml) into the living report.
4. **Cache** by living-report version via `insight_cache`.

### API

| Endpoint | Notes |
|----------|--------|
| `GET /api/v1/students/{uid}/overview` | Default `enrich=1`. Pass `?enrich=0` for mapper-only (fast local debug). |
| `POST /api/v1/students/{uid}/overview/refresh` | Invalidates insight cache for uid, reruns mapper + enrich. |

## Living report `tracker_dashboard` structured_state v1

See [`DASHBOARD_PAYLOAD.example.json`](DASHBOARD_PAYLOAD.example.json) and [`app/prompts/dashboard_extract.yaml`](../../app/prompts/dashboard_extract.yaml).
