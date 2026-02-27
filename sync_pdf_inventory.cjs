const fs = require('fs');
const text = fs.readFileSync('pdf_text.txt', 'utf8');

// Array for upserting to Supabase
const inventoryToUpsert = [];

const lines = text.split('\n');

let pendingSku = null;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('Relatório de Produto') || line.startsWith('Id Reserva') || line.startsWith('Produto') || line.startsWith('------')) continue;

    // Normal line: SKU QTY [FORNECEDOR] DESC
    // Example: 3005      8                    3005 - COMODA DUBAI...
    // Example: 5a312b97  6.990    GAZIN       TAXA DE ENTREGA
    const match = line.match(/^([a-zA-Z0-9_]+)\s+([\d.,]+)\s+(.*)/);

    if (match) {
        const sku = match[1];
        // Remove pontos caso seja separador de milhar brasileiro para evitar parse errado
        const rawQty = match[2].replace(/\./g, '');
        const qty = parseInt(rawQty, 10);
        inventoryToUpsert.push({ sku, qty, originalLine: line });
        pendingSku = null;
    } else {
        // Possibility of broken line:
        // 78999311433
        // 67
        // 1                         Roupeiro recife...
        if (/^[a-zA-Z0-9_]+$/.test(line) && !pendingSku) {
            pendingSku = line;
        } else if (/^\d+$/.test(line) && pendingSku) {
            // maybe it's just a number in between?
        } else if (/^\d+\s+.*$/.test(line) && pendingSku) {
            const m = line.match(/^(\d+)\s+(.*)/);
            if (m) {
                inventoryToUpsert.push({ sku: pendingSku, qty: parseInt(m[1], 10), originalLine: line });
                pendingSku = null;
            }
        }
    }
}

console.log("Found", inventoryToUpsert.length, "items.");
fs.writeFileSync('parsed_inventory.json', JSON.stringify(inventoryToUpsert, null, 2));

const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wpryhjhfgmggvvyamyfi.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function syncInventory() {
    const storeId = 'a6bba92a-73ce-4b4e-8efd-622ecff375f3'; // CD Norte ID

    console.log("Fetching existing products (all pages)...");
    let products = [];
    let hasMore = true;
    let page = 0;
    while (hasMore) {
        const { data: pageData, error: prodErr } = await supabase.from('products').select('id, sku').order('id', { ascending: true }).range(page * 1000, (page + 1) * 1000 - 1);
        if (prodErr) { console.error(prodErr); return; }
        if (pageData && pageData.length > 0) {
            products = products.concat(pageData);
            page++;
        } else {
            hasMore = false;
        }
    }
    console.log(`Loaded ${products.length} products total.`);

    const productMap = {};
    for (const p of products) {
        if (p.sku) productMap[p.sku.toString().toLowerCase()] = p.id;
        // Also map product ID directly just in case some represent the direct ID without PRD-
        productMap[p.id.toString().toLowerCase()] = p.id;
    }

    const inventoryRecords = [];

    for (const item of inventoryToUpsert) {
        const skuKey = item.sku.toLowerCase();
        let productId = productMap[skuKey] || productMap[`prd-${skuKey}`];

        if (productId) {
            inventoryRecords.push({
                product_id: productId,
                location_id: storeId,
                quantity: item.qty,
                type: 'CD',
                last_updated: new Date().toISOString()
            });
        } else {
            console.log(`Product matches not found for SKU: ${item.sku}`);
        }
    }

    console.log(`Inserting ${inventoryRecords.length} inventory records...`);

    // UPSERT doesn't work out of the box unless we know the PK or conflict target.
    // The inventory table has an 'id' BIGSERIAL. Usually we need to check if exists or use a UNIQUE constraint.
    // There is no UNIQUE constraint on (product_id, location_id).
    // Let's delete existing inventory for CD Norte to avoid duplicates.
    console.log("Deleting old inventory for CD Norte...");
    await supabase.from('inventory').delete().eq('location_id', storeId);

    // Insert new
    // chunk large inserts
    const chunkSize = 200;
    for (let i = 0; i < inventoryRecords.length; i += chunkSize) {
        const chunk = inventoryRecords.slice(i, i + chunkSize);
        const { error: insErr } = await supabase.from('inventory').insert(chunk);
        if (insErr) {
            console.error("Error inserting chunk:", insErr);
        } else {
            console.log(`Inserted chunk ${i / chunkSize + 1}`);
        }
    }

    console.log("Inventory sync complete!");
}

syncInventory();
