const { Client } = require('pg');
const fs = require('fs');

const env = {};
if (fs.existsSync('.env')) {
    const content = fs.readFileSync('.env', 'utf8');
    content.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            env[parts[0].trim()] = parts.slice(1).join('=').trim();
        }
    });
}

const dbPassword = env.SUPABASE_DB_PASSWORD;
const projectRef = env.SUPABASE_PROJECT_REF || 'wpryhjhfgmggvvyamyfi';
// Direct connection bypassing pooler
const connectionString = `postgres://postgres:${dbPassword}@db.${projectRef}.supabase.co:5432/postgres`;

const client = new Client({ connectionString });

async function check() {
  try {
    await client.connect();
    console.log('Connected to DB directly.');
    
    // 1. Checking pg_stat_statements for slow/failing queries
    console.log('--- Top 5 Slowest Queries ---');
    const slowQueries = await client.query(`
      SELECT substring(query, 1, 100) as query_snippet, calls, total_exec_time, mean_exec_time, rows 
      FROM pg_stat_statements 
      ORDER BY total_exec_time DESC 
      LIMIT 5;
    `);
    console.table(slowQueries.rows);

    // 2. Checking table sizes and sequential scans
    console.log('\n--- Table Sequential Scans (Missing Indexes?) ---');
    const seqScans = await client.query(`
      SELECT relname AS table_name, seq_scan, seq_tup_read, idx_scan, idx_tup_fetch
      FROM pg_stat_user_tables
      ORDER BY seq_tup_read DESC
      LIMIT 5;
    `);
    console.table(seqScans.rows);

  } catch (err) {
    console.error("Error", err.message);
  } finally {
    await client.end();
  }
}

check();
