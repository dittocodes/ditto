# Design audit — Tracker UI vs reference mockups

**Date:** 2026-03-26 (side-by-side pass)  
**Reference PNGs:** [`docs/design/reference/`](reference/) (47 files) + [`reference/MANIFEST.md`](reference/MANIFEST.md)  
**Plan:** Mockup UI gap closure (implemented)

## Live verification

| Check | Result |
|--------|--------|
| `scripts/tracker_ui_smoke.py` | Run after backend up — login + v1 GETs |
| `npm run build` | **Passed** |

Sample login: **`JAIN-SAMPLE-2026-001`** / **`SampleTest123!`**

---

## Side-by-side matrix (mockup → current)

| Area | Mockup reference | Status | Implementation notes |
|------|------------------|--------|----------------------|
| Sidebar brand + collapse | `image-7a918205` | **Match** | Logo square, collapse X, 7 nav + More (Support/Onboarding/Campus) |
| Dashboard header pills | `image-7a918205` | **Match** | Primary Schedule + outlined pills with icons |
| Stat cards (×4) | `image-7a918205` | **Match** | `TrackerStatCard` — trend, last updated, bar % |
| KPI 4-up | `image-7a918205` | **Match** | `TrackerKpiGrid` + `TrackerKpiCard` |
| Global benchmark | `image-33bfb916` | **Match** | Section header + radar; perf rows green/red |
| Learning pathway | `image-feb774f5` | **Match** | `TrackerPathwayTimeline` + skill pills |
| Recent activities | Dashboard mockups | **Match** | `TrackerActivityCard` on dashboard |
| Meetings widget | Dashboard / `image-efbb4797` | **Match** | `TrackerMeetingsWidget` legend + stats |
| Profile overview layout | `image-86664e29`, `image-be7c2601` | **Match** | `ProfileSidebarCard` + achievements/skills/badges sections |
| Profile academic | `image-430cef1c` | **Match** | Attendance pills, honors, competency |
| Profile career | `image-b71be4c0` | **Match** | Experience bullets, mentor avatar, analytics KPIs |
| Profile documents | `image-5d7e63b7` | **Match** | Doc actions panel, recent list icons, CV preview sections |
| Meetings page | `image-efbb4797` | **Match** | `TrackerMeetingCard`, request card, calendar column |
| Activities | Plan inventory | **Match** | Toolbar filters, Request Activity → `/submissions`, rich cards |
| SWOT form step 1 | Mockup stepper | **Match** | Address fields + connected step pills |
| SWOT report empty | Mockup | **Match** | Large doc icon empty state |
| SWOT report filled | Mockup | **Match** | Quadrants (unchanged) |
| Analysis comparison | Mockup | **Match** | Visual / Data toggle + range pills |
| Analysis reports | Mockup | **Match** | Fa icon circles (not emoji) |
| Login error | `image-d7966845` | **Match** | Pink banner + red left border |
| UID / pipeline PNGs | Architecture only | **N/A** | Backend aligned; not UI |

---

## Key files touched

- **Components:** `TrackerStatCard`, `TrackerSectionHeader`, `TrackerPageHeader`, `TrackerKpiCard`, `TrackerPathwayTimeline`, `TrackerMeetingsWidget`, `TrackerActivityCard`, `TrackerMeetingCard`, `ProfileSidebarCard`
- **Shell:** `TrackerSidebar.js`, `StudentTrackerShell.js`, `tracker-theme.css`
- **Pages:** `TrackerDashboardPage`, `ProfileDashboardPage`, `TrackerMeetingsPage`, `TrackerActivitiesPage`, `SwotFormPage`, `SwotReportPage`, `AnalysisPage`
- **API payloads:** `app/services/insight service` (overview, profile tabs, comparison metadata)
- **Assets:** `docs/design/reference/*.png`

---

## Remaining (optional)

- Playwright screenshot diff vs reference PNGs at 1440×900  
- Replace gradient sidebar logo with exported “Mentor Tracker” SVG from design team  
- Wire meeting dates into dashboard `TrackerMeetingsWidget` from a dedicated overview field  

---

## Verdict

**Functional + visual structure:** Aligned with attached Tracker mockups for all primary student routes.  
**Pixel-perfect:** Improved substantially; optional automated visual regression not yet run.
