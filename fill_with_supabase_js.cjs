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
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('URL or Key missing');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { error: delError } = await supabase.from('whatsapp_settings').delete().neq('id', 'uuid-non-existent');
    if (delError) console.log('Delete error:', delError);

    const { error } = await supabase.from('whatsapp_settings').insert([
        {
            api_url: 'https://evolution-api-d8bj-production.up.railway.app',
            api_key: '046ac732c84e016dcb525f29e7e947766b4aa33d047b362aea84e07b8528097d',
            instance_name: 'lm-moveis'
        }
    ]);
    
    if (error) {
        console.error('Insert error:', error);
    } else {
        console.log('Successfully filled whatsapp_settings!');
    }
}

main();
