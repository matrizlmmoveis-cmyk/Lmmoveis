const https = require('https');
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

const sql = `
-- 1. Adicionar a coluna
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS product_code INTEGER;

-- 2. Criar sequência começando em 100
CREATE SEQUENCE IF NOT EXISTS product_code_seq START 100;

-- 3. Preencher produtos existentes (que ainda não tem código)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.products WHERE product_code IS NULL ORDER BY created_at ASC, id ASC LOOP
        UPDATE public.products SET product_code = nextval('product_code_seq') WHERE id = r.id;
    END LOOP;
END $$;

-- 4. Definir o valor padrão para novos inserts
ALTER TABLE public.products ALTER COLUMN product_code SET DEFAULT nextval('product_code_seq');
`;

const data = JSON.stringify({ query: sql });

const options = {
    hostname: 'api.supabase.com',
    port: 443,
    path: `/v1/projects/${env.SUPABASE_PROJECT_REF || 'wpryhjhfgmggvvyamyfi'}/query`,
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${env.SUPABASE_MANAGEMENT_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
    }
};

const req = https.request(options, (res) => {
    let responseData = '';
    res.on('data', (d) => { responseData += d; });
    res.on('end', () => {
        console.log('Status Code:', res.statusCode);
        console.log('Response:', responseData);
    });
});

req.on('error', (error) => { console.error('Error:', error); });
req.write(data);
req.end();
