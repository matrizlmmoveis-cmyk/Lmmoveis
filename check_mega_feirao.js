import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wpryhjhfgmggvvyamyfi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwcnloamhmZ21nZ3Z2eWFteWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMzkwNDQsImV4cCI6MjA4NzcxNTA0NH0.XoD41Sd-nBubS6pLjAhaYAIsttfoI1TE3Om8fU9L7dk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyze() {
    const { data: stores } = await supabase.from('stores').select('*').ilike('name', '%mega%');
    if (!stores || stores.length === 0) return;
    const storeId = stores[0].id;
    
    const { data: sales, error } = await supabase.from('sales').select('*, payments:sale_payments(*)').eq('store_id', storeId);
    if (error) { console.error(error); return; }
    
    let totalAll = 0;
    let paymentTotal = 0;
    
    const now = new Date();
    
    sales.forEach(sale => {
        if (sale.status === 'Cancelada') return;
        
        const d = new Date(sale.date);
        if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
            const val = parseFloat(sale.total) || 0;
            totalAll += val;
            
            const pSum = (sale.payments || []).reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
            paymentTotal += pSum;
            
            if (Math.abs(val - pSum) > 0.01) {
                console.log(`Discrepancy in sale ${sale.id}: Total: ${val}, Payments: ${pSum}`);
            }
        }
    });
    
    console.log(`\nTotal This Month (sale.total): R$ ${totalAll.toFixed(2)}`);
    console.log(`Total This Month (payments): R$ ${paymentTotal.toFixed(2)}`);
}

analyze();
