
const { createClient } = require('@supabase/supabase-client');
require('dotenv').config({ path: 'd:/Projetos/móveis-lm-erp-pro/Lmmoveis/.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSale125() {
    console.log('Buscando venda 125...');
    const { data, error } = await supabase
        .from('sales')
        .select('*, items:sale_items(*), payments:sale_payments(*)')
        .eq('id', '125');

    if (error) {
        console.error('Erro ao buscar venda:', error);
        return;
    }

    if (!data || data.length === 0) {
        console.log('Venda 125 não encontrada.');
        return;
    }

    console.log('Dados da Venda 125:');
    console.log(JSON.stringify(data[0], null, 2));
}

checkSale125();
