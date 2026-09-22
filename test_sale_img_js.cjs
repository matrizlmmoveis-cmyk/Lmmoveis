const { createClient } = require('@supabase/supabase-js');
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

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
    const { data: saleItems, error } = await supabase
        .from('sale_items')
        .select('product_id, products(name, image_url)')
        .eq('sale_id', 5976);
        
    console.log(saleItems);
    
    if (saleItems) {
        saleItems.forEach(si => {
            if (si.products && si.products.image_url) {
                const { data } = supabase.storage.from('produtos').getPublicUrl(si.products.image_url);
                console.log('Public URL:', data.publicUrl);
            }
        });
    }
}
main();
