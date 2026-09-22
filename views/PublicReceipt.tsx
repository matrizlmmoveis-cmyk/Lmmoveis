import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../services/supabase';
import { getDirectImageUrl } from '../utils/imageUtils';
import SignatureCanvas from 'react-signature-canvas';
import { toPng } from 'html-to-image';

export const PublicReceipt: React.FC<{ id: string }> = ({ id }) => {
  const [sale, setSale] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const sigCanvas = useRef<SignatureCanvas>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSale();
  }, [id]);

  const fetchSale = async () => {
    try {
      setLoading(true);
      // Busca venda
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .select('*')
        .eq('id', id)
        .single();
      
      if (saleError) throw saleError;
      if (!saleData) throw new Error("Pedido não encontrado");

      // Busca itens e produtos
      const { data: itemsData } = await supabase
        .from('sale_items')
        .select('*, products(*)')
        .eq('sale_id', id);
        
      // Busca pagamentos
      const { data: paymentsData } = await supabase
        .from('sale_payments')
        .select('*')
        .eq('sale_id', id);

      setSale({
        ...saleData,
        items: itemsData || [],
        payments: paymentsData || []
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao carregar pedido');
    } finally {
      setLoading(false);
    }
  };

  const handleClearSignature = () => {
    sigCanvas.current?.clear();
  };

  const handleConfirm = async () => {
    if (sigCanvas.current?.isEmpty()) {
      alert("Por favor, assine o recibo antes de confirmar.");
      return;
    }

    try {
      setSaving(true);
      
      // Converte o canvas da assinatura para imagem na tela (para o print capturar bem)
      const dataURL = sigCanvas.current?.getCanvas().toDataURL('image/png');
      const sigImg = document.createElement('img');
      sigImg.src = dataURL!;
      sigImg.style.display = 'block';
      sigImg.style.margin = '0 auto';
      sigImg.style.maxHeight = '150px';
      
      const canvasContainer = document.getElementById('signature-container');
      if (canvasContainer) {
        canvasContainer.innerHTML = '';
        canvasContainer.appendChild(sigImg);
      }

      // Tira print da tela toda do recibo
      if (!receiptRef.current) throw new Error("Elemento do recibo não encontrado");
      
      const screenshotBase64 = await toPng(receiptRef.current, { pixelRatio: 2 });
      
      // Converte base64 para Blob
      const res = await fetch(screenshotBase64);
      const blob = await res.blob();
      
      // Upload para Supabase Storage
      const fileName = `receipt_${id}_${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, blob, { contentType: 'image/png' });
        
      if (uploadError) {
        console.error("Erro upload storage:", uploadError);
        throw new Error("Falha ao salvar a imagem do comprovante.");
      }
      
      const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(fileName);
      const publicUrl = urlData.publicUrl;

      // Salva URL no pedido
      const { error: updateError } = await supabase
        .from('sales')
        .update({ customer_signature_url: publicUrl })
        .eq('id', id);
        
      if (updateError) throw updateError;

      // Dispara envio do print via WhatsApp Evolution API (chamando a mesma lógica do backend/frontend)
      // Aqui faremos a chamada via fetch manual simulando o envio
      await sendPrintViaWhatsApp(publicUrl);

      setSuccess(true);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Erro ao processar assinatura');
    } finally {
      setSaving(false);
    }
  };

  const sendPrintViaWhatsApp = async (imageUrl: string) => {
    // Busca configs do WhatsApp do BD
    const { data: settings } = await supabase.from('whatsapp_settings').select('*').single();
    if (!settings) return;

    let phone = sale.customer_phone.replace(/\D/g, '');
    if (!phone.startsWith('55') && phone.length <= 11) phone = '55' + phone;

    const { api_url, api_key, instance_name } = settings;
    
    // Manda imagem
    await fetch(`${api_url}/message/sendMedia/${instance_name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': api_key },
      body: JSON.stringify({
        number: phone,
        mediatype: "image",
        caption: `Obrigado! Seu pedido Nº ${sale.id} foi assinado com sucesso. Segue a sua cópia do recibo.`,
        media: imageUrl
      })
    });
  };

  if (loading) return <div className="p-8 text-center">Carregando pedido...</div>;
  if (error) return <div className="p-8 text-center text-red-600">{error}</div>;
  if (success) return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-sm w-full">
        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">✓</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Pedido Assinado!</h2>
        <p className="text-gray-600 mb-6">Enviamos uma cópia do recibo assinado para o seu WhatsApp.</p>
        <p className="text-sm text-gray-400">A Móveis LM agradece a preferência!</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 p-2 sm:p-4 font-sans text-gray-800 flex justify-center">
      <div className="max-w-md w-full">
        {/* CONTEÚDO QUE SERÁ PRINTADO */}
        <div ref={receiptRef} className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
          
          {/* Header */}
          <div className="bg-emerald-600 text-white p-6 text-center">
            <h1 className="text-xl font-bold">Móveis LM</h1>
            <p className="opacity-90">Recibo de Venda - Nº {sale.id}</p>
          </div>

          <div className="p-6 space-y-6">
            {/* Info Cliente */}
            <div>
              <p className="text-sm text-gray-500">Cliente</p>
              <p className="font-semibold">{sale.customer_name}</p>
              <p className="text-sm text-gray-600">{new Date(sale.date).toLocaleDateString('pt-BR')}</p>
            </div>

            {/* Itens */}
            <div>
              <h3 className="font-bold border-b pb-2 mb-3">Itens do Pedido</h3>
              <div className="space-y-4">
                {sale.items.map((item: any, idx: number) => {
                  const p = item.products;
                  const rawUrl = p?.image_url || p?.image_url_2;
                  const imgUrl = rawUrl ? getDirectImageUrl(rawUrl) : null;
                  
                  return (
                    <div key={idx} className="flex gap-3 items-center">
                      {imgUrl && imgUrl.startsWith('http') ? (
                        <img src={imgUrl} className="w-12 h-12 rounded object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center text-xs text-gray-400">Sem foto</div>
                      )}
                      <div className="flex-1 text-sm">
                        <p className="font-semibold line-clamp-1">{p?.name || 'Produto'}</p>
                        <p className="text-gray-500">{item.quantity}x de R$ {item.price.toFixed(2)}</p>
                      </div>
                      <div className="font-bold text-sm">
                        R$ {(item.quantity * item.price).toFixed(2)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pagamentos */}
            <div>
              <h3 className="font-bold border-b pb-2 mb-3">Formas de Pagamento</h3>
              <div className="space-y-2">
                {sale.payments.map((p: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span>{p.method}</span>
                    <span className="font-semibold">R$ {p.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="bg-gray-50 rounded-lg p-4 flex justify-between items-center mt-4">
              <span className="font-bold text-gray-600">Total</span>
              <span className="text-2xl font-black text-emerald-600">R$ {sale.total.toFixed(2)}</span>
            </div>

            {/* Área de Assinatura */}
            <div className="pt-6 mt-6 border-t-2 border-dashed border-gray-300">
              <h3 className="text-center font-bold text-gray-800 mb-2">Assinatura do Cliente</h3>
              <p className="text-center text-xs text-gray-500 mb-4">Assine no quadro abaixo para confirmar o pedido</p>
              
              <div id="signature-container" className="border-2 border-gray-300 rounded-lg bg-gray-50 overflow-hidden relative" style={{ height: 150 }}>
                <SignatureCanvas 
                  ref={sigCanvas} 
                  penColor="black"
                  canvasProps={{ className: 'w-full h-full' }} 
                />
              </div>
            </div>

          </div>
        </div>

        {/* Botões de Ação (não aparecem no print) */}
        <div className="mt-6 flex flex-col gap-3 pb-8">
          <button 
            onClick={handleClearSignature}
            className="w-full py-3 bg-white text-gray-600 font-bold rounded-xl border border-gray-300"
          >
            Limpar Assinatura
          </button>
          <button 
            onClick={handleConfirm}
            disabled={saving}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-lg disabled:opacity-50"
          >
            {saving ? 'Processando...' : 'Confirmar e Assinar'}
          </button>
        </div>
      </div>
    </div>
  );
};
