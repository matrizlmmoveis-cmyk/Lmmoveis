import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://wpryhjhfgmggvvyamyfi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwcnloamhmZ21nZ3Z2eWFteWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMzkwNDQsImV4cCI6MjA4NzcxNTA0NH0.XoD41Sd-nBubS6pLjAhaYAIsttfoI1TE3Om8fU9L7dk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: stores } = await supabase.from('stores').select('*').ilike('name', '%mega feir%');
    if (!stores || stores.length === 0) {
        console.log("Loja Mega Feirão não encontrada.");
        return;
    }
    const storeId = stores[0].id;
    
    async function fetchAll(table, queryBuilder) {
        let allData = [];
        let from = 0;
        let to = 999;
        let hasMore = true;

        while (hasMore) {
            let query = supabase.from(table).select('*').range(from, to);
            if (queryBuilder) query = queryBuilder(query);

            const { data, error } = await query;
            if (error) {
                console.error(`Erro ao buscar ${table}:`, error);
                break;
            }

            if (data && data.length > 0) {
                allData = allData.concat(data);
                from += 1000;
                to += 1000;
                if (data.length < 1000) hasMore = false;
            } else {
                hasMore = false;
            }
        }
        return allData;
    }

    const inventory = await fetchAll('inventory', q => q.eq('location_id', storeId));
    const products = await fetchAll('products', null);
    
    // Buscar movimentos para pegar a última "descrição de ajuste"
    const movements = await fetchAll('inventory_movements', q => q.eq('location_id', storeId).order('created_at', { ascending: false }));

    const latestReasonMap = {};
    if (movements) {
        movements.forEach(m => {
            // Pega o primeiro que aparecer (mais recente) por produto que NÃO seja VENDA automática
            if (!latestReasonMap[m.product_id]) {
                if (m.reason && m.reason !== 'VENDA' && m.reason !== 'COMPRA') {
                    latestReasonMap[m.product_id] = m.reason;
                }
            }
        });
    }

    const prodMap = {};
    products.forEach(p => prodMap[p.id] = p);

    let md = `# Relatório de Estoque - ${stores[0].name}\n\n`;
    md += `| Produto | Código/SKU | Categoria | Quantidade | Último Ajuste (Motivo) |\n`;
    md += `|---|---|---|---|---|\n`;

    let lines = [];
    inventory.forEach(inv => {
        const prod = prodMap[inv.product_id];
        if (prod && inv.quantity !== 0) {
            const reason = latestReasonMap[inv.product_id] || '-';
            lines.push({ name: prod.name, sku: prod.sku || prod.product_code || '', category: prod.category || '', qty: inv.quantity, reason });
        }
    });

    lines.sort((a, b) => a.name.localeCompare(b.name));

    lines.forEach(l => {
        md += `| ${l.name} | ${l.sku} | ${l.category} | **${l.qty}** | ${l.reason} |\n`;
    });

    fs.writeFileSync('C:\\Users\\SAMSUNG\\.gemini\\antigravity-ide\\brain\\4683dac5-af7a-4936-9c03-df4b4c97f406\\estoque_mega_feirao.md', md);
    console.log("Arquivo gerado com sucesso!");
}

run();
