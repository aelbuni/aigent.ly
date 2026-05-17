import { readFileSync } from 'fs';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const sql = readFileSync('./apps/web/drizzle/0010_schema_v2.sql', 'utf-8');

// Split on semicolons but preserve DO $$ ... $$ blocks
const statements = [];
let current = '';
let inDollarQuote = false;

for (const line of sql.split('\n')) {
  const trimmed = line.trim();
  if (trimmed.startsWith('--')) { current += '\n'; continue; }
  if (trimmed.includes('$$')) {
    inDollarQuote = !inDollarQuote;
    current += line + '\n';
    continue;
  }
  if (!inDollarQuote && trimmed.endsWith(';')) {
    current += line;
    statements.push(current.trim());
    current = '';
  } else {
    current += line + '\n';
  }
}

let ok = 0, err = 0;
for (const stmt of statements) {
  if (!stmt || stmt.length < 5) continue;
  try {
    await pool.query(stmt);
    console.log('✓', stmt.slice(0, 80).replace(/\n/g, ' '));
    ok++;
  } catch (e) {
    console.error('✗', stmt.slice(0, 80).replace(/\n/g, ' '), '->', e.message);
    err++;
  }
}

await pool.end();
console.log(`\nDONE: ${ok} ok, ${err} errors`);
