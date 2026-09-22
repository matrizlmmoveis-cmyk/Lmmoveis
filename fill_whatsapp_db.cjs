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
const projectRef = env.VITE_SUPABASE_PROJECT_REF || 'wpryhjhfgmggvvyamyfi';

if (!dbPassword) {
    console.error('Error: SUPABASE_DB_PASSWORD is not set in .env');
    process.exit(1);
}

const client = new Client({
    user: `postgres.${projectRef}`, // SNI proxy format for supabase
    host: 'aws-0-sa-east-1.pooler.supabase.com',
    database: 'postgres',
    password: dbPassword,
    port: 6543,
    ssl: { rejectUnauthorized: false }
});

const sql = `
CREATE TABLE IF NOT EXISTS public.whatsapp_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  api_url text NOT NULL,
  api_key text NOT NULL,
  instance_name text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

TRUNCATE TABLE public.whatsapp_settings RESTART IDENTITY;

INSERT INTO public.whatsapp_settings (api_url, api_key, instance_name)
VALUES ('https://evolution-api-d8bj-production.up.railway.app', '046ac732c84e016dcb525f29e7e947766b4aa33d047b362aea84e07b8528097d', 'lm-moveis');
`;

async function main() {
    try {
        await client.connect();
        console.log('Connected to Supabase PostgreSQL!');
        
        await client.query(sql);
        console.log('SUCCESS: Table whatsapp_settings created and populated successfully!');
        
    } catch (err) {
        console.error('Database connection/query error:', err);
    } finally {
        await client.end();
    }
}

main();
