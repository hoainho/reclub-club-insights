# Club Insights

A small Reclub dashboard that helps a club host answer three questions: how many people booked a place, how many sessions actually ran, and what the attendance records tell us about no-shows. Open any metric to see the records behind it. The comparison stays next to the current value, so a host does not have to remember numbers from another screen.

## Run locally

Use Node.js 24 LTS. If you use nvm, run `nvm use` first.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). The dev command seeds a local SQLite database from the supplied CSVs before starting Next.js. No external service, account, or API key is needed.

The default view compares the last four completed local weeks, September 7–October 4, with the four before them. Pick different dates to inspect another period, or switch to Thảo Điền Tennis Club to see what a host sees before their club has activity.

## What the numbers mean

| Metric | Rule | Why |
| --- | --- | --- |
| Active players | Distinct players with at least one non-cancelled booking for a held session in the selected range. | Bookings are available even when a host has not recorded attendance. This counts players who booked, not players confirmed to have turned up. |
| Sessions held | Non-cancelled sessions that had finished by the fixed demo clock. A session belongs to the local date on which it started. | The export labels completed sessions as scheduled too, so a status filter alone would count future sessions. Using the end time also keeps sessions in progress out of the total. |
| Recorded no-shows | Non-cancelled bookings explicitly marked absent at held sessions with recorded attendance. | Missing attendance is not evidence that everyone showed up. With no records the value is unknown. With incomplete coverage, we show the observed count and coverage without implying a reliable trend. |

Date filters include both selected dates. The previous period is the same number of local calendar days, ending the day before the selected start. The weekly chart counts held sessions, starts weeks on Monday in the club's time zone, and follows the selected date range. Source timestamps are UTC; the demo clock is **October 5, 2026, 09:00 in Ho Chi Minh City**. We never use the reviewer's current date to decide whether a session has happened.

A real example from the CSVs: September 28–October 4 had five held sessions and two recorded no-shows, but attendance was recorded for only two sessions. The right conclusion is “two recorded, partial coverage,” not “only two people missed a session that week.”

## How it fits together

```text
Supplied CSVs → seed script → SQLite → Next.js JSON routes → dashboard
```

- `GET /api/clubs` lists the two clubs. No authentication is needed for this exercise.
- `GET /api/insights?clubId=club-001&from=2026-09-07&to=2026-10-04` returns the two periods, metric values, attendance coverage, weekly buckets, and current-period drill-down rows. Mobile can consume the same JSON without reimplementing the metric rules.
- The prototype returns drill-down rows with the summary because the fixture is small. This keeps filtering and opening the details simple and ensures a card and its details agree. No extra server or caching layer is needed here.
- Motion is limited to state and chart transitions. The layout and interactions work without animation, and the dashboard respects the browser’s reduced-motion setting.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The highest-risk regression is confusing missing attendance with a verified zero. The data suite checks both against the supplied fixture, along with the exact snapshot boundary, local week conversion, prior-period comparison, excluded sessions and bookings, and the empty club. The browser suite exercises the key host flows on laptop and phone viewports.

## What I'd do next

I'd sit with a few hosts and check that the booking-based definition of active players is the one they need. Then I'd work on improving how attendance is captured before adding no-show comparisons. For a larger dataset I'd page the detail lists, add club-scoped access control, and profile the queries with representative traffic before choosing indexes or caching.
