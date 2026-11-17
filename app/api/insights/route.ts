import { openDatabase } from '../../../lib/database.ts';
import { InputError, parseInsightsQuery } from '../../../lib/dates.ts';
import { ClubNotFound, getInsights } from '../../../lib/insights.ts';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const { clubId, from, to } = parseInsightsQuery(new URL(request.url).searchParams);
    const db = openDatabase();
    try { return Response.json(getInsights(db, clubId, from, to)); } finally { db.close(); }
  } catch (error) {
    if (error instanceof InputError) return Response.json({ error: error.message }, { status: 400 });
    if (error instanceof ClubNotFound) return Response.json({ error: error.message }, { status: 404 });
    console.error('Could not calculate insights', error);
    return Response.json({ error: 'Unable to load insights. Please try again.' }, { status: 500 });
  }
}
