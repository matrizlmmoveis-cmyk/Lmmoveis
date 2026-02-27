const https = require('https');
const fs = require('fs');

const sql = fs.readFileSync('supabase_schema.sql', 'utf8');
const data = JSON.stringify({ query: sql });

const options = {
    hostname: 'api.supabase.com',
    port: 443,
    path: `/v1/projects/${process.env.SUPABASE_PROJECT_REF || 'wpryhjhfgmggvvyamyfi'}/query`,
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_MANAGEMENT_TOKEN || ''}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
    }
};

const req = https.request(options, (res) => {
    console.log(`Status Code: ${res.statusCode}`);
    let responseData = '';

    res.on('data', (d) => {
        responseData += d;
    });

    res.on('end', () => {
        console.log('Response:', responseData);
        if (res.statusCode === 200 || res.statusCode === 201) {
            console.log('Tabelas criadas com sucesso via API!');
        } else {
            console.error('Falha ao criar tabelas.');
        }
    });
});

req.on('error', (error) => {
    console.error('Erro na requisição:', error);
});

req.write(data);
req.end();
