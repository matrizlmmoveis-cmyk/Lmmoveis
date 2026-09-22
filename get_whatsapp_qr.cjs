const https = require('https');
const fs = require('fs');

const API_URL = 'evolution-api-d8bj-production.up.railway.app';
const API_KEY = '046ac732c84e016dcb525f29e7e947766b4aa33d047b362aea84e07b8528097d';
const INSTANCE_NAME = 'lm-moveis';

const data = JSON.stringify({
  instanceName: INSTANCE_NAME,
  qrcode: true,
  integration: "WHATSAPP-BAILEYS"
});

const options = {
  hostname: API_URL,
  port: 443,
  path: '/instance/create',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': API_KEY,
    'Content-Length': Buffer.byteLength(data)
  }
};

console.log('Solicitando criação de instância e geração de QR Code...');

const req = https.request(options, (res) => {
  let responseData = '';

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    try {
      const result = JSON.parse(responseData);
      console.log('Resposta da API:', JSON.stringify(result, null, 2));
      
      let base64Image = '';
      if (result.qrcode && result.qrcode.base64) {
        base64Image = result.qrcode.base64;
      } else if (result.base64) {
        base64Image = result.base64;
      } else if (result.hash && result.hash.qrcode) {
         // Some versions might have different structures
      }

      if (base64Image) {
        const html = `
          <html>
            <body style="display:flex; justify-content:center; align-items:center; height:100vh; background:#f0f2f5; font-family:sans-serif; flex-direction:column;">
              <div style="background:white; padding:40px; border-radius:10px; box-shadow:0 4px 10px rgba(0,0,0,0.1); text-align:center;">
                <h2>QR Code WhatsApp - Evolution API</h2>
                <p>Abra seu WhatsApp > Dispositivos Conectados > Conectar um aparelho</p>
                <img src="\${base64Image}" style="width:300px; height:300px; margin-top:20px;" />
                <p style="margin-top:20px; color:#555;">Instância: <strong>\${INSTANCE_NAME}</strong></p>
              </div>
            </body>
          </html>
        `;
        fs.writeFileSync('qrcode.html', html);
        console.log('SUCCESS: QR Code salvo em qrcode.html. Abrindo o arquivo...');
      } else {
        console.log('Não foi possível encontrar o QR Code na resposta. Verifique a API.');
      }
    } catch (e) {
      console.error('Erro ao processar a resposta:', e);
      console.log('Raw response:', responseData);
    }
  });
});

req.on('error', (e) => {
  console.error('Erro na requisição HTTPS:', e);
});

req.write(data);
req.end();
