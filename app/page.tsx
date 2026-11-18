'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

type Club = { id: string; name: string; timeZone: string; createdAt: string };
type Metric = 'activePlayers' | 'sessionsHeld' | 'noShows';
type Summary = { activePlayers: number; sessionsHeld: number; noShows: number | null; attendance: { recordedSessions: number; eligibleSessions: number; status: 'unknown' | 'partial' | 'complete' } };
type Insights = { club: Club; range: { from: string; to: string; previousFrom: string; previousTo: string }; emptyClub: boolean; current: Summary; previous: Summary; weekly: { weekStart: string; sessionsHeld: number }[]; details: { activePlayers: { id: string; name: string; bookings: number }[]; sessionsHeld: { id: string; title: string; startsAt: string; bookings: number; attendanceRecorded: boolean }[]; noShows: { bookingId: string; playerName: string; sessionTitle: string; startsAt: string }[] } };
const labels: Record<Metric, string> = { activePlayers: 'Active players', sessionsHeld: 'Sessions held', noShows: 'Recorded no-shows' };
const definitions: Record<Metric, string> = { activePlayers: 'Unique players with a non-cancelled booking in a completed session.', sessionsHeld: 'Non-cancelled sessions that started in this range and finished by the snapshot.', noShows: 'Non-cancelled bookings explicitly marked absent in recorded sessions.' };
const count = (n: number | null | undefined) => n == null ? '—' : n.toLocaleString('en-US');
const dateLabel = (date: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
const rangeLabel = (from: string, to: string) => `${dateLabel(from)} ${from.slice(0,4)} – ${dateLabel(to)} ${to.slice(0,4)}`;
const sessionDate = (date: string, zone: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: zone }).format(new Date(date));
function Icon({ name, size = 20 }: { name: 'grid' | 'people' | 'calendar' | 'arrow' | 'check' | 'info' | 'spark'; size?: number }) {
  const paths = { grid: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>, people: <><circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 5"/></>, calendar: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-12 5h6"/></>, arrow: <path d="M5 12h14m-5-5 5 5-5 5"/>, check: <><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></>, info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/></>, spark: <><path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4Z"/></> };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
function changeText(current: number | null, previous: number | null) {
  if (current == null || previous == null) return 'Comparison unavailable';
  if (previous === 0) return current === 0 ? 'No change from previous period' : `${count(current)} more than previous period`;
  const diff = Math.round((current - previous) / previous * 100);
  return `${diff > 0 ? '+' : ''}${diff}% vs previous period`;
}
export default function Dashboard() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [clubId, setClubId] = useState('');
  const [draft, setDraft] = useState({ from: '2026-09-07', to: '2026-10-04' });
  const [range, setRange] = useState(draft);
  const [data, setData] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<Metric>('sessionsHeld');
  const [page, setPage] = useState(1);
  const detailRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/clubs', { signal: controller.signal }).then(async r => { if (!r.ok) throw new Error('Could not load your clubs.'); return r.json(); }).then((body: { clubs: Club[] }) => {
      if (!body.clubs.length) throw new Error('No clubs found. Run the database seed and try again.');
      setClubs(body.clubs); setClubId(id => id || body.clubs[0].id);
    }).catch(e => { if (e.name !== 'AbortError') { setError(e.message); setLoading(false); } });
    return () => controller.abort();
  }, [retry]);
  useEffect(() => {
    if (!clubId) return;
    const controller = new AbortController();
    fetch(`/api/insights?${new URLSearchParams({ clubId, ...range })}`, { signal: controller.signal }).then(async r => { if (!r.ok) throw new Error('Could not load insights. Please check the date range and try again.'); return r.json(); }).then((body: Insights) => setData(body)).catch(e => { if (e.name !== 'AbortError') setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [clubId, range, retry]);
  const resetRequest = () => { setLoading(true); setError(''); setData(null); setPage(1); };
  const apply = (next: typeof range) => {
    if (!next.from || !next.to || next.from > next.to) { setFormError('Choose a start date on or before the end date.'); return; }
    if (next.to > '2026-10-05') { setFormError('This snapshot ends on 5 October 2026. Choose an earlier date.'); return; }
    if (next.from === range.from && next.to === range.to && (data || loading)) {
      setFormError(''); setDraft(next); return;
    }
    resetRequest(); setFormError(''); setDraft(next); setRange({ ...next });
  };
  const reveal = (metric: Metric) => { setSelected(metric); setPage(1); requestAnimationFrame(() => detailRef.current?.focus({ preventScroll: false })); };
  const detailCount = data?.details[selected].length ?? 0;
  const pages = Math.max(1, Math.ceil(detailCount / 8));
  const slice = <T,>(rows: T[]) => rows.slice((page - 1) * 8, page * 8);
  return <div className="app-shell">
    <a href="#main" className="skip-link">Skip to dashboard</a>
    <aside className="sidebar" aria-label="Workspace navigation">
      <Link className="wordmark" href="/" aria-label="Reclub home"><span className="brand-symbol">r<span>•</span></span>reclub<span className="wordmark-dot">.</span></Link>
      <div className="workspace-label">YOUR CLUB WORKSPACE</div>
      <div className="nav-item active"><Icon name="grid"/> Club insights <span className="nav-dot"/></div>
      <div className="sidebar-note"><div className="note-icon"><Icon name="spark"/></div><strong>More play.<br/>Better connections.</strong><p>A little perspective for the people who bring everyone together.</p></div>
      <div className="workspace-profile"><span className="avatar">CH</span><div><strong>Club host</strong><span>Insights workspace</span></div><span className="online-dot"/></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><div className="breadcrumbs">Workspace <span>/</span> <strong>Club insights</strong></div><span className="snapshot-tag"><span/> Demo snapshot · 5 Oct 2026</span></header>
      <main id="main">
        <section className="heading-row"><div><p className="eyebrow">A PULSE ON YOUR COMMUNITY</p><h1>Every session tells a story<span>.</span></h1><p className="lead">See who’s playing, what’s growing, and where to look closer.</p></div><div className="club-select-wrap"><label htmlFor="club-select">YOUR CLUB</label><select id="club-select" data-testid="club-switcher" value={clubId} disabled={!clubs.length} onChange={e => { resetRequest(); setClubId(e.target.value); }}>{!clubs.length && <option value="">Loading clubs…</option>}{clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div></section>
        <form className="date-toolbar" onSubmit={e => { e.preventDefault(); apply(draft); }}>
          <div className="preset-group" aria-label="Date range presets"><button type="button" className={range.from === '2026-09-07' && range.to === '2026-10-04' ? 'selected' : ''} onClick={() => apply({ from: '2026-09-07', to: '2026-10-04' })}>Last 4 full weeks</button><button type="button" className={range.from === '2026-09-28' && range.to === '2026-10-04' ? 'selected' : ''} onClick={() => apply({ from: '2026-09-28', to: '2026-10-04' })}>Last full week</button></div>
          <div className="date-inputs"><label><span className="sr-only">Start date</span><input aria-label="Start date" data-testid="date-from" type="date" max="2026-10-05" value={draft.from} onChange={e => setDraft({ ...draft, from: e.target.value })}/></label><span className="date-separator">→</span><label><span className="sr-only">End date</span><input aria-label="End date" data-testid="date-to" type="date" max="2026-10-05" value={draft.to} onChange={e => setDraft({ ...draft, to: e.target.value })}/></label><button className="apply-button" data-testid="range-apply" type="submit">Apply</button></div>
        </form>
        {formError && <p className="form-error" role="alert">{formError}</p>}
        <div className="period-caption"><span><Icon name="calendar" size={14}/> {rangeLabel(range.from, range.to)}</span><span>{data ? `Compared with ${rangeLabel(data.range.previousFrom, data.range.previousTo)}` : 'Compared with the previous period'} <i>·</i> {data?.club.timeZone ?? 'Asia/Ho_Chi_Minh'}</span></div>
        <div aria-live="polite" className="sr-only">{loading ? 'Loading insights.' : error || `Insights loaded for ${data?.club.name ?? 'your club'}.`}</div>
        {error ? <section className="error-state" role="alert"><Icon name="info" size={28}/><h2>We couldn’t load your insights</h2><p>{error}</p><button className="apply-button" onClick={() => { resetRequest(); setRetry(n => n + 1); }}>Try again</button></section> : loading ? <div className="loading-state" aria-busy="true"><div className="metric-grid">{[1,2,3].map(i => <div className="skeleton metric-card" key={i}/>)}</div><div className="skeleton chart-skeleton"/></div> : data ? <div className="results" key={`${data.club.id}-${range.from}-${range.to}`}>
          {data.emptyClub ? <section className="empty-club" data-testid="empty-club"><div className="empty-illustration"><span className="empty-orbit"/><Icon name="people" size={42}/><span className="empty-spark">✦</span></div><span className="eyebrow">THE BEGINNING OF SOMETHING GOOD</span><h2>Your club’s story starts here.</h2><p>{data.club.name} is new. Once sessions and bookings are added, you’ll see your community take shape here.</p><div className="empty-steps"><span><b>01</b> Host your first session</span><span><b>02</b> Bring your players together</span><span><b>03</b> Record attendance</span></div><p className="empty-footnote">No activity yet is different from missing attendance. We’ll keep that distinction clear.</p></section> : <>
          <div className="metric-grid">{(['activePlayers','sessionsHeld','noShows'] as Metric[]).map((metric, i) => { const partial = metric === 'noShows' && (data.current.attendance.status !== 'complete' || data.previous.attendance.status !== 'complete'); return <button key={metric} data-testid={`metric-${metric === 'activePlayers' ? 'active-players' : metric === 'sessionsHeld' ? 'sessions-held' : 'no-shows'}`} className={`metric-card ${selected === metric ? 'is-selected' : ''}`} onClick={() => reveal(metric)} aria-label={`${labels[metric]}: ${count(data.current[metric])}. View details`}><div className="metric-top"><span>{labels[metric]}</span><span className={`metric-icon tone-${i}`}><Icon name={i === 0 ? 'people' : i === 1 ? 'calendar' : 'info'}/></span></div><div className="metric-number">{count(data.current[metric])}{metric === 'noShows' && data.current.attendance.status !== 'complete' && <span className="partial-badge">{data.current.attendance.status === 'unknown' ? 'Unknown' : 'Partial data'}</span>}</div><p className={`metric-change ${partial ? 'muted' : ''}`}>{partial ? 'Incomplete attendance · no reliable comparison' : changeText(data.current[metric], data.previous[metric])}</p><p className="metric-definition">{definitions[metric]}</p>{metric === 'noShows' && <p className="previous-attendance">Previous: {count(data.previous.noShows)} recorded · {data.previous.attendance.recordedSessions}/{data.previous.attendance.eligibleSessions} sessions</p>}<div className="metric-bottom"><span>{metric === 'noShows' ? `${data.current.attendance.recordedSessions}/${data.current.attendance.eligibleSessions} sessions recorded` : `Previous period: ${count(data.previous[metric])}`}</span><Icon name="arrow" size={17}/></div></button>; })}</div>
          <div className="middle-grid"><section className="panel chart-panel" aria-label="Weekly sessions chart"><div className="panel-heading"><div><p className="eyebrow">CONSISTENCY BUILDS COMMUNITY</p><h2>A week at a time</h2><p>Completed sessions, Monday to Sunday.</p></div><span className="chart-legend"><i/>Sessions held</span></div><div className="chart" data-testid="weekly-chart" role="img" aria-label={`Sessions held by week: ${data.weekly.map(w => `${dateLabel(w.weekStart)}: ${w.sessionsHeld}`).join('; ') || 'No sessions'}`}><div className="chart-grid-lines"><span/><span/><span/><span/></div><div className="chart-bars" style={{ minWidth: `${Math.max(250, data.weekly.length * 55)}px` }}>{data.weekly.map((week, i) => <div className="chart-column" key={week.weekStart}><span className="bar-value">{week.sessionsHeld}</span><div className={`chart-bar ${i === data.weekly.length - 1 ? 'last-bar' : ''}`} style={{ height: `${Math.max(2, week.sessionsHeld / Math.max(1,...data.weekly.map(w => w.sessionsHeld)) * 145)}px`, animationDelay: `${i * 35}ms` }}/><span className="bar-label">{dateLabel(week.weekStart)}</span></div>)}</div></div><div className="chart-caption"><span>Week beginning · local club time</span><span>{data.weekly.length} weeks in view</span></div></section>
          <aside className="coverage-panel"><div className="coverage-icon"><Icon name="check" size={25}/></div><p className="eyebrow">NUMBERS YOU CAN TRUST</p><h2>Every check-in matters.</h2><p>Attendance is recorded for <strong>{data.current.attendance.recordedSessions} of {data.current.attendance.eligibleSessions} completed sessions</strong> in this period.</p><div className="coverage-track" role="progressbar" aria-label="Sessions with recorded attendance" aria-valuenow={data.current.attendance.recordedSessions} aria-valuemin={0} aria-valuemax={Math.max(1,data.current.attendance.eligibleSessions)}><span style={{ width: `${data.current.attendance.eligibleSessions ? data.current.attendance.recordedSessions / data.current.attendance.eligibleSessions * 100 : 0}%` }}/></div><div className="coverage-count"><span>{data.current.attendance.status === 'complete' ? 'Complete coverage' : data.current.attendance.status === 'partial' ? 'Partial coverage' : 'No attendance coverage'}</span><strong>{data.current.attendance.eligibleSessions ? Math.round(data.current.attendance.recordedSessions/data.current.attendance.eligibleSessions*100) : 0}%</strong></div><p className="coverage-note"><Icon name="info" size={16}/><span>Missing attendance means unknown no-shows, not zero. We only count explicitly recorded absences.</span></p></aside></div>
          <section className="panel detail-panel" data-testid="metric-details" ref={detailRef} tabIndex={-1} aria-labelledby="detail-heading"><div className="detail-heading-row"><div><p className="eyebrow">BEHIND THE NUMBERS</p><h2 id="detail-heading">A closer look</h2></div><div className="detail-tabs" aria-label="Detail views">{(['sessionsHeld','activePlayers','noShows'] as Metric[]).map(m => <button key={m} aria-pressed={selected === m} onClick={() => { setSelected(m); setPage(1); }}>{m === 'sessionsHeld' ? 'Sessions' : m === 'activePlayers' ? 'Players' : 'No-shows'}</button>)}</div></div><p className="detail-description">{definitions[selected]}{selected === 'noShows' && data.current.attendance.status !== 'complete' ? ' This list is incomplete because some sessions have no attendance record.' : ''}</p>
          {detailCount === 0 ? <div className="empty-detail"><Icon name={selected === 'noShows' ? 'info' : 'calendar'} size={26}/><h3>{selected === 'noShows' && data.current.attendance.status !== 'complete' ? 'No recorded absences to show' : 'Nothing to show in this period'}</h3><p>{selected === 'noShows' && data.current.attendance.status !== 'complete' ? 'Missing attendance cannot tell us whether everyone attended.' : 'Try a wider date range to explore more of your club’s activity.'}</p></div> : <><div className="table-scroll"><table><caption className="sr-only">{labels[selected]} in the selected period</caption><thead><tr>{selected === 'activePlayers' ? <><th>Player</th><th>Player ID</th><th className="text-right">Bookings</th></> : selected === 'sessionsHeld' ? <><th>Session</th><th>Local date & time</th><th>Attendance</th><th className="text-right">Bookings</th></> : <><th>Player</th><th>Session</th><th>Local date & time</th></>}</tr></thead><tbody>{selected === 'activePlayers' ? slice(data.details.activePlayers).map(p => <tr key={p.id}><td><span className="player-name"><span className="mini-avatar">{p.name.split(' ').map(n => n[0]).slice(0,2).join('')}</span>{p.name}</span></td><td className="subtle">{p.id}</td><td className="text-right">{p.bookings}</td></tr>) : selected === 'sessionsHeld' ? slice(data.details.sessionsHeld).map(s => <tr key={s.id}><td className="row-title">{s.title}</td><td>{sessionDate(s.startsAt,data.club.timeZone)}</td><td><span className={`status-tag ${s.attendanceRecorded ? 'recorded' : 'unrecorded'}`}>{s.attendanceRecorded ? 'Recorded' : 'Not recorded'}</span></td><td className="text-right">{s.bookings}</td></tr>) : slice(data.details.noShows).map(s => <tr key={s.bookingId}><td className="row-title">{s.playerName}</td><td>{s.sessionTitle}</td><td>{sessionDate(s.startsAt,data.club.timeZone)}</td></tr>)}</tbody></table></div><div className="pagination"><span>Showing {(page - 1) * 8 + 1}–{Math.min(page * 8,detailCount)} of {detailCount}</span><div><button disabled={page === 1} onClick={() => setPage(p => p - 1)} aria-label="Previous page">←</button><span>Page {page} of {pages}</span><button disabled={page === pages} onClick={() => setPage(p => p + 1)} aria-label="Next page">→</button></div></div></>}
          </section></>}
          <footer className="dashboard-footer"><span>Built around your community, not just your numbers.</span><span>Snapshot: 5 Oct 2026, 09:00 ICT <i>·</i> No live data</span></footer>
        </div> : null}
      </main>
    </div>
  </div>;
}
