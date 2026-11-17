import type { DatabaseSync } from 'node:sqlite';
import { addDays, comparisonRange, FIXED_NOW, localDate, monday } from './dates.ts';

type Club = { id: string; name: string; timeZone: string; createdAt: string };
type Session = { id: string; title: string; startsAt: string; durationMinutes: number; status: string; attendanceRecorded: number };
type Booking = { id: string; sessionId: string; playerId: string; playerName: string; attended: number | null };
export class ClubNotFound extends Error {}
export function getClubs(db: DatabaseSync): Club[] {
  return db.prepare('SELECT club_id AS id, name, time_zone AS timeZone, created_at AS createdAt FROM clubs ORDER BY club_id').all() as Club[];
}
export function getInsights(db: DatabaseSync, clubId: string, from: string, to: string) {
  const club = getClubs(db).find(club => club.id === clubId);
  if (!club) throw new ClubNotFound('This club could not be found.');
  const range = comparisonRange(from, to);
  const allSessions = db.prepare('SELECT session_id AS id, title, starts_at AS startsAt, duration_minutes AS durationMinutes, status, attendance_recorded AS attendanceRecorded FROM sessions WHERE club_id = ? ORDER BY starts_at, session_id').all(clubId) as Session[];
  const bookings = db.prepare(`SELECT b.booking_id AS id, b.session_id AS sessionId, b.player_id AS playerId, p.name AS playerName, b.attended
    FROM bookings b JOIN sessions s ON s.session_id = b.session_id JOIN players p ON p.player_id = b.player_id
    WHERE s.club_id = ? AND p.club_id = ? AND b.status != 'cancelled' AND b.cancelled_at IS NULL
    ORDER BY b.booking_id`).all(clubId, clubId) as Booking[];
  const bySession = new Map<string, Booking[]>();
  for (const b of bookings) { const list = bySession.get(b.sessionId) ?? []; list.push(b); bySession.set(b.sessionId, list); }
  const eligibleSessions = allSessions.filter(s => s.status !== 'cancelled' && Date.parse(s.startsAt) + s.durationMinutes * 60_000 <= Date.parse(FIXED_NOW));
  const aggregate = (start: string, end: string) => {
    const sessions = eligibleSessions.filter(s => { const date = localDate(s.startsAt, club.timeZone); return date >= start && date <= end; });
    const active = new Map<string, { id: string; name: string; bookings: number }>();
    const noShows: { bookingId: string; playerName: string; sessionTitle: string; startsAt: string }[] = [];
    let recordedSessions = 0, unknownBookings = false;
    for (const session of sessions) {
      const booked = bySession.get(session.id) ?? [];
      if (session.attendanceRecorded) recordedSessions++;
      for (const b of booked) {
        const player = active.get(b.playerId) ?? { id: b.playerId, name: b.playerName, bookings: 0 };
        player.bookings++; active.set(b.playerId, player);
        if (session.attendanceRecorded && b.attended === null) unknownBookings = true;
        if (session.attendanceRecorded && b.attended === 0) noShows.push({ bookingId: b.id, playerName: b.playerName, sessionTitle: session.title, startsAt: session.startsAt });
      }
    }
    const status = recordedSessions === 0 ? 'unknown' as const : recordedSessions < sessions.length || unknownBookings ? 'partial' as const : 'complete' as const;
    return {
      summary: { activePlayers: active.size, sessionsHeld: sessions.length, noShows: recordedSessions ? noShows.length : null, attendance: { recordedSessions, eligibleSessions: sessions.length, status } },
      details: { activePlayers: [...active.values()].sort((a,b) => b.bookings - a.bookings || a.name.localeCompare(b.name)), sessionsHeld: sessions.map(s => ({ id: s.id, title: s.title, startsAt: s.startsAt, bookings: bySession.get(s.id)?.length ?? 0, attendanceRecorded: Boolean(s.attendanceRecorded) })), noShows },
      sessions,
    };
  };
  const current = aggregate(from, to), previous = aggregate(range.previousFrom, range.previousTo);
  const buckets = new Map<string, number>();
  for (let week = monday(from); week <= to; week = addDays(week, 7)) buckets.set(week, 0);
  for (const session of current.sessions) { const week = monday(localDate(session.startsAt, club.timeZone)); buckets.set(week, (buckets.get(week) ?? 0) + 1); }
  return { club, range, emptyClub: allSessions.length === 0, current: current.summary, previous: previous.summary, weekly: [...buckets].map(([weekStart,sessionsHeld]) => ({ weekStart, sessionsHeld })), details: current.details };
}
