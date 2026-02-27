const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '');

const data = fs.readFileSync('products.csv', 'utf8');

const rows = [];
let currentRow = [];
let currentCell = '';
let inQuotes = false;
for (let i = 0; i < data.length; i++) {
    let char = data[i];
    if (inQuotes) {
        if (char === '"') {
            if (i + 1 < data.length && data[i + 1] === '"') {
                currentCell += '"';
                i++;
            } else {
                inQuotes = false;
            }
        } else {
            currentCell += char;
        }
    } else {
        if (char === '"') {
            inQuotes = true;
        } else if (char === ',') {
            currentRow.push(currentCell);
            currentCell = '';
        } else if (char === '\n' || char === '\r') {
            if (char === '\r' && i + 1 < data.length && data[i + 1] === '\n') {
                i++;
            }
            currentRow.push(currentCell);
            rows.push(currentRow);
            currentRow = [];
            currentCell = '';
        } else {
            currentCell += char;
        }
    }
}
if (currentRow.length > 0) rows.push(currentRow);

console.log(`Parsed ${rows.length} rows.`);

const productsToInsert = [];
let noSkuCount = 0;
for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 2) continue;
    if (!row[1] || row[1].trim() === 'Apagar' || row[1].trim() === '') continue;

    let rawPriceStr = row[4] ? String(row[4]).replace('R$', '').replace(/\./g, '').replace(',', '.').trim() : '0';
    let rawCostStr = row[3] ? String(row[3]).replace('R$', '').replace(/\./g, '').replace(',', '.').trim() : '0';

    let price = parseFloat(rawPriceStr);
    let costPrice = parseFloat(rawCostStr);
    if (isNaN(price)) price = 0;
    if (isNaN(costPrice)) costPrice = 0;

    let name = row[1].trim();
    let skuMatch = name.match(/^(\d+)\s+-/);
    let sku = skuMatch ? skuMatch[1] : (row[0] && row[0].trim() !== '' ? row[0].trim() : `SKU-${++noSkuCount}`);

    let imageUrl = row[5] ? row[5].replace('Produto_Images/', '') : null;
    let supplierId = row[6] ? row[6] : null;

    productsToInsert.push({
        id: `PRD-${sku}`,
        name: name,
        sku: sku,
        price: price,
        cost_price: costPrice,
        image_url: imageUrl,
        supplier_id: supplierId,
        category: 'Geral',
        active: true
    });
}

console.log(`Upserting ${productsToInsert.length} products...`);

async function runImport() {
    const chunkSize = 200;
    for (let i = 0; i < productsToInsert.length; i += chunkSize) {
        const chunk = productsToInsert.slice(i, i + chunkSize);
        // Remove duplicates by ID in chunk to prevent PK issues
        const uniqueMap = new Map();
        chunk.forEach(p => uniqueMap.set(p.id, p));
        const uniqueChunk = Array.from(uniqueMap.values());

        const { error } = await supabase.from('products').upsert(uniqueChunk, { onConflict: 'id' });
        if (error) {
            console.error('Error inserting chunk:', i, error.message);
            for (let j = 0; j < uniqueChunk.length; j++) {
                const { error: err2 } = await supabase.from('products').upsert(uniqueChunk[j], { onConflict: 'id' });
                if (err2) console.error("Error on single row:", uniqueChunk[j].id, err2.message);
            }
        } else {
            console.log(`Inserted chunk ${Math.floor(i / chunkSize) + 1} / ${Math.ceil(productsToInsert.length / chunkSize)}`);
        }
    }

    const { data: countData, error: countErr } = await supabase.from('products').select('id', { count: 'exact' });
    console.log(`Update Complete. Total products now in DB: ${countData ? countData.length : 'error'}`);
}

runImport();
