import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY);

async function checkIds() {
    try {
        const idsToCheck = ['master', 'admin', 'ana_atacado'];
        const { data, error } = await supabase
            .from('employees')
            .select('id, name')
            .in('id', idsToCheck);
        
        if (error) {
            console.error('Error fetching employees:', error);
            // Try fetching first 3 employees to see IDs
            const { data: all, error: err2 } = await supabase.from('employees').select('id, name').limit(3);
            if (err2) console.error('Error fetching sample:', err2);
            else console.log('Sample employees:', all);
            return;
        }
        
        console.log('Found employees:', data);
        
        const { data: all } = await supabase.from('employees').select('id, name').limit(3);
        console.log('Sample employees:', all);
    } catch (e) {
        console.error('Unexpected error:', e);
    }
}

checkIds();
