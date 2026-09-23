import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
dotenv.config({ path: path.join(root, '.env.local'), override: true });

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
console.log('Connected to:', process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@'));
const r = await c.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
console.log('Tables found:', r.rows.map(x => x.tablename));
await c.end();
