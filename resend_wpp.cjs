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
    console.log("Buscando pedido 5976...");
    const { data: sale, error } = await supabase
        .from('sales')
        .select('*')
        .eq('id', 5976)
        .single();
        
    if (error || !sale) {
        console.error("Erro ao buscar pedido:", error);
        return;
    }

    const { data: items } = await supabase
        .from('sale_items')
        .select('*, products(*)')
        .eq('sale_id', 5976);

    const { data: payments } = await supabase
        .from('sale_payments')
        .select('*')
        .eq('sale_id', 5976);

    sale.items = items || [];
    sale.payments = payments || [];

    // Formata telefone
    let phone = sale.customer_phone.replace(/\D/g, '');
    if (!phone.startsWith('55') && phone.length <= 11) {
      phone = '55' + phone;
    }

    const api_url = 'https://evolution-api-d8bj-production.up.railway.app';
    const instance_name = 'lm-moveis';
    const api_key = '046ac732c84e016dcb525f29e7e947766b4aa33d047b362aea84e07b8528097d';

    const sendText = async (txt) => {
        const textRes = await fetch(`${api_url}/message/sendText/${instance_name}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': api_key },
          body: JSON.stringify({ number: phone, text: txt })
        });
        if (!textRes.ok) console.error("Erro no texto:", await textRes.text());
        else console.log("Texto enviado!");
    };

    const sendMedia = async (url, caption) => {
        const mediaRes = await fetch(`${api_url}/message/sendMedia/${instance_name}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': api_key },
          body: JSON.stringify({ number: phone, mediatype: "image", caption, media: url })
        });
        if (!mediaRes.ok) {
          console.error("Erro na imagem, enviando como texto:", await mediaRes.text());
          await sendText(caption);
        } else {
            console.log("Imagem enviada!");
        }
    };

    // Mensagem 1: Introdução
    const publicLink = `https://lmmoveis.vercel.app/pedido/${sale.id}`;
    const introText = `*Oba! Seu pedido no Grupo LM Móveis foi concluído com sucesso!* 🎉\n\n*Pedido:* ${sale.id}\n*Data:* ${new Date(sale.date).toLocaleDateString('pt-BR')}\n*Cliente:* ${sale.customer_name}\n\n*Assinatura do Pedido:*\nPor favor, assine digitalmente o seu pedido através do link abaixo para liberar a separação e entrega:\n🔗 ${publicLink}\n\n*🛒 Itens do Pedido:*`;
    await sendText(introText);

    // Mensagens do meio
    for (const item of sale.items) {
        const pName = item.products ? item.products.name : 'Produto';
        const caption = `🔸 *${pName}*\n   ${item.quantity}x de R$ ${item.price.toFixed(2)} - Subtotal: R$ ${(item.quantity * item.price).toFixed(2)}`;
        
        let finalUrl = null;
        if (item.products && (item.products.image_url || item.products.image_url_2)) {
            const raw = item.products.image_url || item.products.image_url_2;
            if (raw && raw.startsWith('http')) finalUrl = raw;
        }

        if (finalUrl) {
            await sendMedia(finalUrl, caption);
        } else {
            await sendText(caption);
        }
    }

    // Mensagem Final
    let finalMsg = `\n*💰 Total da Compra:* R$ ${sale.total.toFixed(2)}\n`;

    if (sale.payments && sale.payments.length > 0) {
      finalMsg += `\n*💳 Formas de Pagamento:*\n`;
      let valNaEntrega = 0;
      sale.payments.forEach((p) => {
        finalMsg += `🔹 ${p.method}: R$ ${p.amount.toFixed(2)}\n`;
        if (p.method === 'Entrega' || p.method.toLowerCase().includes('entrega')) {
          valNaEntrega += p.amount;
        }
      });
      
      if (valNaEntrega > 0) {
        finalMsg += `\n⚠️ *Atenção: Será pago R$ ${valNaEntrega.toFixed(2)} no ato da entrega.*\n`;
      }
    }

    if (sale.delivery_address) {
      let addr = sale.delivery_address;
      try {
        const addrObj = JSON.parse(sale.delivery_address);
        addr = `${addrObj.street || ''}, ${addrObj.number || 'S/N'}`;
      } catch (e) {}
      finalMsg += `\n*Endereço de Entrega:* ${addr}\n`;
    }
    
    // Simular nome do vendedor
    finalMsg += `*O seu vendedor é:* Vendedor LM\n`;
    finalMsg += `\nAgradecemos a preferência!`;

    await sendText(finalMsg);

    console.log("Pronto!");
}

main();
