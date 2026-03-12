import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wpryhjhfgmggvvyamyfi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwcnloamhmZ21nZ3Z2eWFteWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMzkwNDQsImV4cCI6MjA4NzcxNTA0NH0.XoD41Sd-nBubS6pLjAhaYAIsttfoI1TE3Om8fU9L7dk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugRoberto() {
    const { data: employees } = await supabase.from('employees').select('id, name').ilike('name', '%roberto%');
    if (!employees || employees.length === 0) { console.log('No Roberto found'); return; }
    
    const robertoId = employees[0].id;
    console.log(`Roberto (ID: ${robertoId}) found.`);

    const { data: sales, error } = await supabase
        .from('sales')
        .select('id, date, status, created_at')
        .eq('assigned_assembler_id', robertoId);

    if (error) { console.error(error); return; }

    console.log(`\nTotal sales assigned to Roberto: ${sales.length}`);
    
    const stats = {};
    sales.forEach(s => {
        stats[s.status] = (stats[s.status] || 0) + 1;
        // Log some details for non-completed ones
        if (s.status !== 'Finalizado') {
            console.log(`- Pending: ID ${s.id}, Date: ${s.date}, Status: ${s.status}`);
        }
    });

    console.log('\nStats by status:', stats);
    
    // Check for recent completed ones
    const recentCompleted = sales.filter(s => s.status === 'Finalizado').slice(0, 5);
    console.log('\nSample Recent Completed:', recentCompleted);
}

debugRoberto();
