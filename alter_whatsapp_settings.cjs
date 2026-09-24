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
let projectRef = env.VITE_SUPABASE_PROJECT_REF || 'wpryhjhfgmggvvyamyfi';

const client = new Client({
    connectionString: `postgresql://postgres:${dbPassword}@db.${projectRef}.supabase.co:5432/postgres`,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        await client.connect();
        await client.query(`ALTER TABLE public.whatsapp_settings ADD COLUMN IF NOT EXISTS store_id text;`);
        console.log('Column store_id added to whatsapp_settings');
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}
main();
