
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wpryhjhfgmggvvyamyfi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwcnloamhmZ21nZ3Z2eWFteWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMzkwNDQsImV4cCI6MjA4NzcxNTA0NH0.XoD41Sd-nBubS6pLjAhaYAIsttfoI1TE3Om8fU9L7dk';

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
