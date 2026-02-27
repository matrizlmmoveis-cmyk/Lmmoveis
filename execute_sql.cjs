const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
    host: process.env.SUPABASE_DB_HOST || 'aws-0-sa-east-1.pooler.supabase.com',
    port: parseInt(process.env.SUPABASE_DB_PORT || '6543'),
    user: process.env.SUPABASE_DB_USER || 'postgres.wpryhjhfgmggvvyamyfi',
    password: process.env.SUPABASE_DB_PASSWORD || '',
    database: process.env.SUPABASE_DB_DATABASE || 'postgres',
    ssl: {
        rejectUnauthorized: false
    }
});

async function run() {
    try {
        await client.connect();
        console.log('Conectado ao Supavisor do Supabase.');

        const sqlPath = path.join(__dirname, 'supabase_schema.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Executando script SQL...');
        await client.query(sql);
        console.log('Tabelas criadas com sucesso!');
    } catch (err) {
        console.error('Erro ao executar SQL:', err);
    } finally {
        await client.end();
    }
}

run();
