import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wpryhjhfgmggvvyamyfi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwcnloamhmZ21nZ3Z2eWFteWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMzkwNDQsImV4cCI6MjA4NzcxNTA0NH0.XoD41Sd-nBubS6pLjAhaYAIsttfoI1TE3Om8fU9L7dk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDuplicates() {
    const { data: employees } = await supabase.from('employees').select('*').ilike('name', '%roberto%');
    console.log('Employees found:', JSON.stringify(employees, null, 2));
    
    if (employees && employees.length > 0) {
        for (const emp of employees) {
            const { count } = await supabase
                .from('sales')
                .select('*', { count: 'exact', head: true })
                .eq('assigned_assembler_id', emp.id);
            console.log(`Employee ${emp.name} (ID: ${emp.id}) has ${count} assigned sales.`);
        }
    }
}

checkDuplicates();
