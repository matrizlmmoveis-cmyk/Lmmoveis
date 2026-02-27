const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wpryhjhfgmggvvyamyfi.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const inventoryToUpsert = require('./parsed_inventory.json');

async function check() {
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

    let notFound = 0;
    let found = 0;
    let missingList = [];

    for (const item of inventoryToUpsert) {
        const skuKey = item.sku.toLowerCase();
        let productId = productMap[skuKey] || productMap[`prd-${skuKey}`];

        if (productId) {
            found++;
        } else {
            notFound++;
            missingList.push(item);
        }
    }

    fs.writeFileSync('missing_skus.json', JSON.stringify({ found, notFound, missingSamples: missingList.slice(0, 50) }, null, 2));
    console.log("Saved to missing_skus.json");
}

check();
