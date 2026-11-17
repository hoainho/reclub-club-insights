import { join } from 'node:path';
import { createDatabase, databasePath, seedDatabase } from '../lib/database.ts';
const db = createDatabase();
try {
  seedDatabase(db, join(process.cwd(), 'data'));
  console.log(`Seeded Club Insights at ${databasePath()}`);
} finally { db.close(); }
