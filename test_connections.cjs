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
SELECT state, count(*) 
FROM pg_stat_activity 
GROUP BY state;
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
