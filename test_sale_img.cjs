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

const client = new Client({
    connectionString: `postgresql://postgres:${dbPassword}@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        await client.connect();
        
        // Get sale 5976
        const res = await client.query(`
            SELECT s.id, si.product_id, p.name, p.image_url 
            FROM sales s
            JOIN sale_items si ON s.id = si.sale_id
            JOIN products p ON si.product_id = p.id
            WHERE s.id = 5976
        `);
        console.log(res.rows);
        
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}
main();
