import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { createDatabase, seedDatabase } from '../lib/database.ts';
import { ClubNotFound, getClubs, getInsights } from '../lib/insights.ts';
import { comparisonRange, localDate, monday, parseInsightsQuery } from '../lib/dates.ts';
import { csvBoolean, parseCsv } from '../lib/csv.ts';
const db = createDatabase(':memory:');
seedDatabase(db, join(process.cwd(), 'data'));
after(() => db.close());
const insights = (from: string, to = from, clubId = 'club-001') => getInsights(db, clubId, from, to);

test('fixture import is complete and reseeding is idempotent', () => {
  seedDatabase(db, join(process.cwd(), 'data'));
  assert.equal(getClubs(db).length, 2);
  for (const [table, count] of [['players',260],['sessions',195],['bookings',1893]]) {
    assert.equal(db.prepare(`SELECT count(*) AS n FROM ${table}`).get()?.n, count);
  }
});
test('unknown attendance is not known zero: actual fixture s0191 vs s0178', () => {
  const unknown = insights('2026-09-28');
  assert.ok(unknown.details.sessionsHeld.some(s => s.id === 's0191'));
  assert.equal(unknown.current.noShows, null);
  assert.equal(unknown.current.attendance.status, 'unknown');
  const zero = insights('2026-09-10');
  assert.ok(zero.details.sessionsHeld.some(s => s.id === 's0178'));
  assert.equal(zero.current.noShows, 0);
  assert.equal(zero.current.attendance.status, 'complete');
});
test('UTC Sunday belongs to Monday local week', () => {
  const date = localDate('2026-09-27T22:30:00Z', 'Asia/Ho_Chi_Minh');
  assert.equal(date, '2026-09-28'); assert.equal(monday(date), '2026-09-28');
});
test('four-week fixture totals, coverage, equal previous period and drilldowns', () => {
  const result = insights('2026-09-07','2026-10-04');
  assert.deepEqual(result.range, {from:'2026-09-07',to:'2026-10-04',previousFrom:'2026-08-10',previousTo:'2026-09-06'});
  assert.equal(result.current.sessionsHeld, 20); assert.equal(result.previous.sessionsHeld,20);
  assert.equal(result.current.activePlayers,93); assert.equal(result.previous.activePlayers,92);
  assert.equal(result.current.noShows,15); assert.equal(result.previous.noShows,14);
  assert.deepEqual(result.current.attendance,{recordedSessions:11,eligibleSessions:20,status:'partial'});
  assert.equal(result.details.activePlayers.length, result.current.activePlayers);
  assert.equal(result.details.sessionsHeld.length,result.current.sessionsHeld);
  assert.equal(result.details.noShows.length,result.current.noShows);
  assert.equal(result.weekly.reduce((sum, week) => sum + week.sessionsHeld, 0),20);
});
test('week-to-week no-show observations retain differing partial coverage', () => {
  const result = insights('2026-09-28','2026-10-04');
  assert.equal(result.current.noShows,2); assert.equal(result.previous.noShows,6);
  assert.equal(result.current.attendance.recordedSessions,2); assert.equal(result.previous.attendance.recordedSessions,4);
  assert.equal(result.current.attendance.status,'partial'); assert.equal(result.previous.attendance.status,'partial');
});
test('new club is useful empty data, no manufactured no-show zero', () => {
  const result=insights('2026-09-07','2026-10-04','club-002');
  assert.equal(result.emptyClub,true); assert.equal(result.current.activePlayers,0); assert.equal(result.current.sessionsHeld,0); assert.equal(result.current.noShows,null);
  assert.ok(result.weekly.every(w => w.sessionsHeld===0));
});
test('no future sessions count beyond the fixed assessment clock', () => {
  const result=insights('2026-10-06','2026-10-31');
  assert.equal(result.current.sessionsHeld,0); assert.equal(result.current.activePlayers,0); assert.equal(result.current.noShows,null);
});
test('cancelled sessions and bookings never enter metrics', () => {
  db.exec('SAVEPOINT cancelled_check');
  try {
    const original=insights('2026-09-10');
    db.prepare("UPDATE sessions SET status = 'cancelled' WHERE session_id = ?").run('s0178');
    assert.equal(insights('2026-09-10').current.sessionsHeld,original.current.sessionsHeld-1);
    db.exec('ROLLBACK TO cancelled_check');
    db.prepare("UPDATE bookings SET status = 'cancelled', attended = 0 WHERE session_id = ?").run('s0178');
    const cancelled=insights('2026-09-10');
    assert.equal(cancelled.current.activePlayers,0); assert.equal(cancelled.current.noShows,0);
  } finally { db.exec('ROLLBACK TO cancelled_check; RELEASE cancelled_check'); }
});
test('missing attendance inside a recorded session marks the result partial', () => {
  db.exec('SAVEPOINT missing_check');
  try {
    db.prepare('UPDATE bookings SET attended = NULL WHERE session_id = ?').run('s0178');
    assert.equal(insights('2026-09-10').current.attendance.status,'partial');
  } finally { db.exec('ROLLBACK TO missing_check; RELEASE missing_check'); }
});
test('range validation rejects malformed, reversed and excessive dates', () => {
  for(const query of ['clubId=x&from=2026-02-30','clubId=x&from=2026-10-05&to=2026-10-01','clubId=x&from=2020-01-01&to=2026-01-01','from=2026-01-01','clubId=x&from=0000-01-01&to=0000-01-01','clubId=x&from=9999-01-01&to=9999-01-01']) assert.throws(()=>parseInsightsQuery(new URLSearchParams(query)));
  assert.deepEqual(comparisonRange('2026-03-01','2026-03-01'),{from:'2026-03-01',to:'2026-03-01',previousFrom:'2026-02-28',previousTo:'2026-02-28'});
  assert.throws(()=>insights('2026-01-01','2026-01-01',"' OR 1=1 --"),ClubNotFound);
});
test('CSV quoted fields, BOM, CRLF and explicit nullable booleans', () => {
  assert.deepEqual(parseCsv('\uFEFFid,name\r\n1,"Hello, ""club"""\r\n'),[{id:'1',name:'Hello, "club"'}]);
  assert.equal(csvBoolean('false'),0); assert.equal(csvBoolean('',true),null); assert.throws(()=>csvBoolean(''));
  assert.throws(()=>parseCsv('a,b\n1'));
});

test('JSON API returns success, bad-input and unknown-club statuses', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { GET: getClubsRoute } = await import('../app/api/clubs/route.ts');
  const { GET: getInsightsRoute } = await import('../app/api/insights/route.ts');
  const directory = mkdtempSync(join(tmpdir(), 'club-insights-api-'));
  const path = join(directory, 'test.sqlite');
  const seed = createDatabase(path);
  try { seedDatabase(seed, join(process.cwd(), 'data')); } finally { seed.close(); }
  const previousPath = process.env.CLUB_DB_PATH;
  process.env.CLUB_DB_PATH = path;
  try {
    const clubsResponse = await getClubsRoute();
    assert.equal(clubsResponse.status, 200);
    assert.equal((await clubsResponse.json()).clubs.length, 2);
    const request = (query: string) => new Request(`http://localhost/api/insights?${query}`);
    const success = await getInsightsRoute(request('clubId=club-001&from=2026-09-28&to=2026-09-28'));
    assert.equal(success.status,200);
    assert.equal(success.headers.get('content-type'), 'application/json');
    assert.equal((await success.json()).current.noShows,null);
    assert.equal((await getInsightsRoute(request('clubId=club-001&from=2026-02-30'))).status,400);
    assert.equal((await getInsightsRoute(request('clubId=does-not-exist'))).status,404);
    const fresh = await getInsightsRoute(request('clubId=club-002'));
    assert.equal((await fresh.json()).emptyClub,true);
  } finally {
    if (previousPath === undefined) delete process.env.CLUB_DB_PATH; else process.env.CLUB_DB_PATH = previousPath;
    rmSync(directory, {recursive:true,force:true});
  }
});


test('held means ended: ongoing at the fixed clock is excluded, exact end is included', () => {
  db.exec('SAVEPOINT boundary_check');
  try {
    // Fixed now is 2026-10-05 09:00 HCMC (02:00 UTC).
    const insert = db.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    insert.run('test-ended', 'club-002', 'Ends at now', '2026-10-05T01:00:00Z', 60, 10, 'scheduled', 1);
    insert.run('test-ongoing', 'club-002', 'Ends one minute later', '2026-10-05T01:01:00Z', 60, 10, 'scheduled', 1);
    const result = insights('2026-10-05', '2026-10-05', 'club-002');
    assert.equal(result.current.sessionsHeld, 1);
    assert.deepEqual(result.details.sessionsHeld.map(s => s.id), ['test-ended']);
    assert.equal(result.current.noShows, 0);
  } finally { db.exec('ROLLBACK TO boundary_check; RELEASE boundary_check'); }
});
