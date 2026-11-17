import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { csvBoolean, parseCsv } from './csv.ts';

export const databasePath = () => process.env.CLUB_DB_PATH ?? join(process.cwd(), 'data', 'club-insights.sqlite');
export function openDatabase(): DatabaseSync {
  const db = new DatabaseSync(databasePath(), { readOnly: true });
  db.exec('PRAGMA foreign_keys = ON');
  return db;
}
export function createDatabase(path = databasePath()): DatabaseSync {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  return db;
}
export function seedDatabase(db: DatabaseSync, dataDirectory: string): void {
  // Read before changing the existing database, then replace all rows atomically.
  const files = Object.fromEntries(['clubs', 'players', 'sessions', 'bookings'].map(name => [name, parseCsv(readFileSync(join(dataDirectory, `${name}.csv`), 'utf8'))]));
  db.exec(`CREATE TABLE IF NOT EXISTS clubs (club_id TEXT PRIMARY KEY, name TEXT NOT NULL, time_zone TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS players (player_id TEXT PRIMARY KEY, club_id TEXT NOT NULL REFERENCES clubs(club_id), name TEXT NOT NULL, joined_club_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (session_id TEXT PRIMARY KEY, club_id TEXT NOT NULL REFERENCES clubs(club_id), title TEXT NOT NULL, starts_at TEXT NOT NULL, duration_minutes INTEGER NOT NULL, places INTEGER NOT NULL, status TEXT NOT NULL, attendance_recorded INTEGER NOT NULL CHECK(attendance_recorded IN (0,1)));
    CREATE TABLE IF NOT EXISTS bookings (booking_id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(session_id), player_id TEXT NOT NULL REFERENCES players(player_id), booked_at TEXT NOT NULL, status TEXT NOT NULL, cancelled_at TEXT, attended INTEGER CHECK(attended IN (0,1)));
    CREATE INDEX IF NOT EXISTS sessions_club_start ON sessions(club_id, starts_at);
    CREATE INDEX IF NOT EXISTS bookings_session ON bookings(session_id);
    CREATE INDEX IF NOT EXISTS players_club ON players(club_id);`);
  db.exec('BEGIN');
  try {
    db.exec('DELETE FROM bookings; DELETE FROM sessions; DELETE FROM players; DELETE FROM clubs;');
    const club = db.prepare('INSERT INTO clubs VALUES (?, ?, ?, ?)');
    for (const r of files.clubs) club.run(r.club_id, r.name, r.time_zone, r.created_at);
    const player = db.prepare('INSERT INTO players VALUES (?, ?, ?, ?)');
    for (const r of files.players) player.run(r.player_id, r.club_id, r.name, r.joined_club_at);
    const session = db.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    for (const r of files.sessions) session.run(r.session_id, r.club_id, r.title, r.starts_at, Number(r.duration_minutes), Number(r.places), r.status, csvBoolean(r.attendance_recorded));
    const booking = db.prepare('INSERT INTO bookings VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const r of files.bookings) booking.run(r.booking_id, r.session_id, r.player_id, r.booked_at, r.status, r.cancelled_at || null, csvBoolean(r.attended, true));
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
