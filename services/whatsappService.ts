import { supabaseService } from './supabaseService';

export const whatsappService = {
  async sendSaleSummary(sale: any, storeName: string, customerPhone: string, productImages?: {name: string, url: string}[]): Promise<boolean> {
    const storeId = sale.storeId || sale.store_id;
    const settings = await supabaseService.getWhatsappSettings(storeId);

    if (!settings || !settings.api_url || !settings.api_key || !settings.instance_name) {
      console.warn("Evolution API não configurada no banco de dados para a loja.");
      return false;
    }

    const { api_url, api_key, instance_name } = settings;

    if (!customerPhone) {
      console.warn("Telefone do cliente não informado.");
      return false;
    }

    // Formata telefone (remove não números)
    let phone = customerPhone.replace(/\D/g, '');
    if (!phone.startsWith('55') && phone.length <= 11) {
      phone = '55' + phone;
    }

    try {
      // Mensagem 1: Introdução
      const publicLink = `https://lmmoveis.vercel.app/pedido/${sale.id}`;
      const sellerInfo = sale.sellerName ? `\n*Vendedor:* ${sale.sellerName}` : '';
      const introText = `*Oba! Seu pedido no Grupo LM Móveis foi concluído com sucesso!* 🎉\n\n*Pedido:* ${sale.id}\n*Data:* ${new Date(sale.date).toLocaleDateString('pt-BR')}\n*Unidade:* ${storeName}${sellerInfo}\n*Cliente:* ${sale.customerName}\n\n*Assinatura do Pedido:*\nPor favor, assine digitalmente o seu pedido através do link abaixo para liberar a separação e entrega:\n🔗 ${publicLink}\n\n*🛒 Itens do Pedido:*`;
      
      const sendText = async (txt: string, targetPhone: string) => {
        const textRes = await fetch(`${api_url}/message/sendText/${instance_name}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': api_key },
          body: JSON.stringify({ number: targetPhone, text: txt })
        });
        if (!textRes.ok) throw new Error(`Erro ao enviar mensagem de texto: ${textRes.statusText}`);
      };

      const sendMedia = async (url: string, caption: string, targetPhone: string) => {
        const mediaRes = await fetch(`${api_url}/message/sendMedia/${instance_name}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': api_key },
          body: JSON.stringify({ number: targetPhone, mediatype: "image", caption, media: url })
        });
        if (!mediaRes.ok) {
          console.error(`Erro ao enviar mídia. Fallback para texto.`, await mediaRes.text().catch(()=>''));
          await sendText(caption, targetPhone);
        }
      };

      // Wrapper para enviar para o cliente e para o dono
      const sendToBoth = async (type: 'text' | 'media', content1: string, content2?: string) => {
        const ownerPhone = '5521964582179';
        if (type === 'text') {
           await sendText(content1, phone);
           await sendText(content1, ownerPhone).catch(e => console.error("Erro dono", e));
        } else if (type === 'media') {
           await sendMedia(content1, content2!, phone);
           await sendMedia(content1, content2!, ownerPhone).catch(e => console.error("Erro dono", e));
        }
      };

      await sendToBoth('text', introText);

      // Mensagens do meio: Uma para cada produto
      for (const item of sale.items) {
        const caption = `🔸 *${item.productName || 'Produto'}*\n   ${item.quantity}x de R$ ${item.price.toFixed(2)} - Subtotal: R$ ${(item.quantity * item.price).toFixed(2)}`;
        
        // Acha a imagem desse produto
        const imgObj = productImages?.find(img => img.name === item.productName);
        
        if (imgObj && imgObj.url && imgObj.url.startsWith('http')) {
          await sendToBoth('media', imgObj.url, caption);
        } else {
          await sendToBoth('text', caption);
        }
      }

      // Mensagem Final: Total e informações adicionais
      let finalMsg = `\n*💰 Total da Compra:* R$ ${sale.total.toFixed(2)}\n`;

      if (sale.payments && sale.payments.length > 0) {
        finalMsg += `\n*💳 Formas de Pagamento:*\n`;
        let valNaEntrega = 0;
        sale.payments.forEach((p: any) => {
          finalMsg += `🔹 ${p.method}: R$ ${p.amount.toFixed(2)}\n`;
          if (p.method === 'Entrega' || p.method.toLowerCase().includes('entrega')) {
            valNaEntrega += p.amount;
          }
        });
        
        if (valNaEntrega > 0) {
          finalMsg += `\n⚠️ *Atenção: Será pago R$ ${valNaEntrega.toFixed(2)} no ato da entrega.*\n`;
        }
      }
      
      if (sale.deliveryAddress) {
        let addr = sale.deliveryAddress;
        try {
          const addrObj = JSON.parse(sale.deliveryAddress);
          addr = `${addrObj.street || ''}, ${addrObj.number || 'S/N'}`;
        } catch (e) { }
        finalMsg += `*Endereço de Entrega:* ${addr}\n`;
      }

      if (sale.sellerName) {
        finalMsg += `*O seu vendedor é:* ${sale.sellerName}\n`;
      }
      finalMsg += `\nAgradecemos a preferência!`;

      await sendToBoth('text', finalMsg);

      return true;
    } catch (error) {
      console.error("Erro no envio WhatsApp:", error);
      throw error;
    }
  },
  async sendSaleCancelled(sale: any) {
    try {
      const storeId = sale.storeId || sale.store_id;
      const settings = await supabaseService.getWhatsappSettings(storeId);
      if (!settings) return;

      let phone = sale.customerPhone || sale.customer_phone || '';
      if (!phone) return;
      phone = phone.replace(/\D/g, '');
      if (!phone.startsWith('55') && phone.length <= 11) phone = '55' + phone;

      const { api_url, api_key, instance_name } = settings;

      const cancelText = `*Aviso Importante: Seu Pedido foi Cancelado* ❌\n\n*Pedido:* ${sale.id}\n*Cliente:* ${sale.customerName || sale.customer_name}\n\nOlá! Infelizmente, informamos que o seu pedido acima foi cancelado no nosso sistema. Se isso foi um engano ou se precisar de ajuda, por favor entre em contato com nossa equipe.\n\nA Móveis LM agradece a compreensão!`;

      await fetch(`${api_url}/message/sendText/${instance_name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': api_key },
        body: JSON.stringify({ number: phone, text: cancelText })
      });
    } catch (err) {
      console.error("Erro ao enviar cancelamento via zap:", err);
    }
  },

  async sendSaleUpdated(sale: any) {
    try {
      const storeId = sale.storeId || sale.store_id;
      const settings = await supabaseService.getWhatsappSettings(storeId);
      if (!settings) return;

      let phone = sale.customerPhone || sale.customer_phone || '';
      if (!phone) return;
      phone = phone.replace(/\D/g, '');
      if (!phone.startsWith('55') && phone.length <= 11) phone = '55' + phone;

      const { api_url, api_key, instance_name } = settings;

      const publicLink = `https://lmmoveis.vercel.app/pedido/${sale.id}`;
      
      const introText = `*Atenção: O seu pedido foi atualizado!* 🔄\n\n*Pedido:* ${sale.id}\n*Data:* ${new Date(sale.date).toLocaleDateString('pt-BR')}\n*Cliente:* ${sale.customerName || sale.customer_name}\n\n*Nova Assinatura Necessária:*\nComo houve alterações no seu pedido, por favor acesse o link abaixo para conferir as novidades e assinar novamente:\n🔗 ${publicLink}`;

      await fetch(`${api_url}/message/sendText/${instance_name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': api_key },
        body: JSON.stringify({ number: phone, text: introText })
      });
    } catch (err) {
      console.error("Erro ao enviar atualização via zap:", err);
    }
  }
};
