const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    host: 'aws-0-sa-east-1.pooler.supabase.com',
    port: 6543,
    user: 'postgres.wpryhjhfgmggvvyamyfi',
    password: process.env.SUPABASE_DB_PASSWORD,
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await client.connect();
        console.log('Conectado ao banco de dados.');

        // 1. Add missing columns
        console.log('Adicionando colunas...');
        await client.query(`
            ALTER TABLE public.products ADD COLUMN IF NOT EXISTS description TEXT;
            ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_url_2 TEXT;
        `);
        console.log('Colunas ok.');

        // 2. Check suppliers
        console.log('Verificando fornecedores...');
        const res = await client.query('SELECT * FROM public.suppliers;');
        console.log('Fornecedores atuais:', res.rows);

        if (res.rows.length === 0) {
            console.log('Nenhum fornecedor encontrado. Adicionando FORNECEDOR A...');
            await client.query("INSERT INTO public.suppliers (id, name, active) VALUES ('FORNECEDOR A', 'FORNECEDOR A', true) ON CONFLICT (id) DO NOTHING;");
            console.log('Fornecedor adicionado.');
        }

    } catch (err) {
        console.error('Erro:', err);
    } finally {
        await client.end();
    }
}

run();
