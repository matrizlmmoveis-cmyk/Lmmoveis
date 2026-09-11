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
const dbHost = 'aws-0-sa-east-1.pooler.supabase.com'; // Default pooler host, or usually db.[project_ref].supabase.co
const projectRef = env.SUPABASE_PROJECT_REF || 'wpryhjhfgmggvvyamyfi';
const connectionString = `postgres://postgres.${projectRef}:${dbPassword}@${dbHost}:6543/postgres`;

const client = new Client({
  connectionString: connectionString
});

async function check() {
  try {
    await client.connect();
    const res = await client.query(`
      SELECT state, count(*) 
      FROM pg_stat_activity 
      GROUP BY state;
    `);
    console.log("Current connections:", res.rows);
  } catch (err) {
    console.error("Connection error", err.stack);
  } finally {
    await client.end();
  }
}

check();
