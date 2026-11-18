# Club Insights

A dashboard for club hosts to explore participation, completed sessions and recorded no-shows. Built for the Reclub fullstack prototype brief: **Next.js + TypeScript**, a shared **JSON API**, and **SQLite** seeded from the supplied CSV files.

## Quick start

**Requirements:** Node.js 24 or newer and npm. With nvm:

```sh
nvm install
nvm use
npm ci
npm run dev
```

Open **http://localhost:3000**. After installation, `npm run dev` is the single command needed to seed the database and start the app. No account, API key or external database is required.

> **Seed note:** `npm run dev` and `npm start` both replace the database contents with the CSV fixtures on every start. Do not point `CLUB_DB_PATH` at a database containing data you want to keep. The default database is `data/club-insights.sqlite` and is not committed.

For a production-mode local run:

```sh
npm run build
npm start
```

## Using the dashboard

1. Select a club in the switcher. The second club, Thảo Điền Tennis Club, demonstrates the new-club empty state.
2. Choose a preset or enter a start and end date and select **Apply**. Dates are inclusive. The previous period has the same number of calendar days and ends the day before the selected start.
3. Select a metric to inspect its underlying players, sessions or recorded absences. The detail table is paginated.
4. Read the weekly sessions chart and attendance coverage alongside the metrics. Weeks run Monday–Sunday in the club's time zone; a partial first or last week contains only dates within the selected range.

The default period is **7 September–4 October 2026**, compared with **10 August–6 September 2026**. The data is a fixed snapshot, not live data: “now” is **5 October 2026, 09:00 in Ho Chi Minh City** (02:00 UTC). The UI prevents selecting a date after the snapshot.

## Metric definitions and decisions

| Metric | Definition | Interpretation |
| --- | --- | --- |
| Active players | Distinct players with a non-cancelled booking for a held session starting in the selected local dates. | This measures bookings, not confirmed attendance. |
| Sessions held | Non-cancelled sessions starting in the selected local dates and finished by the snapshot. | Sessions in progress, future sessions and cancelled sessions are excluded. |
| Recorded no-shows | Non-cancelled bookings explicitly marked absent at held sessions where attendance was recorded. | An unrecorded session is **unknown**, not zero. Partial coverage is labelled and comparisons are not presented as reliable trends. |

The CSV timestamps are UTC; dates and week boundaries are interpreted in the club's time zone. If a recorded session contains a booking with unknown attendance, no-show coverage is also partial. For example, 28 September–4 October has five held sessions and two recorded no-shows, but attendance was recorded for only two sessions. This does not establish the total number of absences.

These are prototype definitions where the brief leaves room for interpretation. In particular, hosts should validate whether booking-based “active players” matches their needs.

## JSON API

The dashboard reads the same API that another client, such as a mobile app, can consume. No authentication is implemented for this exercise.

### `GET /api/clubs`

Returns `{ "clubs": [...] }`, including each club's ID, name, time zone and creation timestamp.

### `GET /api/insights`

```sh
curl 'http://localhost:3000/api/insights?clubId=club-001&from=2026-09-28&to=2026-10-04'
```

| Parameter | Meaning |
| --- | --- |
| `clubId` | Required club ID. |
| `from` | Inclusive local start date, `YYYY-MM-DD`; defaults to `2026-09-07`. |
| `to` | Inclusive local end date, `YYYY-MM-DD`; defaults to `2026-10-04`. |

The response contains the club, selected and previous ranges, current and previous summaries, attendance coverage, weekly session buckets and current-period detail rows. `noShows` is `null` when no eligible session has recorded attendance; inspect `attendance.status` (`unknown`, `partial` or `complete`) before interpreting it.

Invalid parameters return HTTP **400**, an unknown club returns **404**, and a database/server failure returns **500**. The API accepts valid dates from 1900 through 2100 and ranges up to 731 inclusive days; the dashboard additionally limits the end date to the snapshot date. Details are returned with the summary because the supplied fixture is small.

## Data and implementation

```text
data/*.csv → scripts/seed.ts → SQLite → app/api/* → dashboard
```

| Path | Responsibility |
| --- | --- |
| `data/` | Supplied clubs, players, sessions and bookings CSV fixtures. |
| `scripts/seed.ts`, `lib/database.ts`, `lib/csv.ts` | CSV import and transactional SQLite seed. |
| `lib/dates.ts`, `lib/insights.ts` | Date boundaries, comparisons, metric aggregation and drill-down data. |
| `app/api/` | Node.js JSON route handlers. |
| `app/page.tsx`, `app/globals.css` | Dashboard, responsive layout and interaction. |
| `tests/` | Data/API regression tests and Playwright browser tests. |

Set `CLUB_DB_PATH` to choose a different SQLite file. The seed reads CSVs from this project's `data/` directory and replaces the four tables' rows in a transaction. The API opens the seeded database read-only. Node's built-in `node:sqlite` requires the specified Node version.

## Verification

```sh
npm test               # metric, seed, date and API regression tests
npm run lint
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e       # desktop and mobile Chromium; starts production server
```

The browser suite requires a production build first. If using an existing Chromium-compatible browser instead of Playwright's downloaded Chromium, set `PLAYWRIGHT_CHROMIUM_PATH` to its executable before running the suite. The data tests specifically distinguish unknown attendance from a verified zero, and exercise local-week boundaries, the fixed clock, cancellation and the empty club.

## Limitations and next steps

- The fixture is small: detail rows are sent with each response and paginated in the browser. Larger datasets would need server-side pagination and query profiling.
- Authentication and club-scoped authorization are deliberately absent; add both before exposing real club data.
- Validate the active-player definition with hosts and improve attendance capture before drawing no-show trends.
- The snapshot clock is fixed for the brief. A live deployment needs a real clock, updated data ingestion and an explicit policy for incomplete attendance.
