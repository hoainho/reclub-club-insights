import { openDatabase } from '../../../lib/database.ts';
import { getClubs } from '../../../lib/insights.ts';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const db = openDatabase();
    try { return Response.json({ clubs: getClubs(db) }); } finally { db.close(); }
  } catch (error) {
    console.error('Could not read clubs', error);
    return Response.json({ error: 'Unable to load clubs. Please try again.' }, { status: 500 });
  }
}
