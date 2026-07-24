const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('d:/Projetos/móveis-lm-erp-pro/Lmmoveis/.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        env[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_ANON_KEY'];

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSales() {
    const { data, error } = await supabase
        .from('sales')
        .select('*, items:sale_items(*), payments:sale_payments(*)')
        .in('id', ['4258', '4262']);

    if (error) {
        console.error('Erro ao buscar vendas:', error);
        return;
    }

    console.log(JSON.stringify(data, null, 2));
}

checkSales();
