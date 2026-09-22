import React, { useState, useEffect } from 'react';
import { MessageSquare, Save, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { supabaseService } from '../services/supabaseService.ts';

const ConfigWhats: React.FC = () => {
  const [apiUrl, setApiUrl] = useState('https://evolution-api-d8bj-production.up.railway.app');
  const [apiKey, setApiKey] = useState('046ac732c84e016dcb525f29e7e947766b4aa33d047b362aea84e07b8528097d');
  const [instanceName, setInstanceName] = useState('lm-moveis');
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null);
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await supabaseService.getWhatsappSettings();
        if (data && data.api_url) {
          setApiUrl(data.api_url);
          setApiKey(data.api_key || '');
          setInstanceName(data.instance_name || '');
        }
      } catch (error) {
        console.error('Erro ao carregar configurações do WhatsApp', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);
    try {
      await supabaseService.saveWhatsappSettings({
        api_url: apiUrl,
        api_key: apiKey,
        instance_name: instanceName
      });
      setStatusMessage({ type: 'success', text: 'Configurações salvas com sucesso!' });
    } catch (error) {
      console.error('Erro ao salvar:', error);
      setStatusMessage({ type: 'error', text: 'Erro ao salvar as configurações. Verifique os dados.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateQR = async () => {
    if (!apiUrl || !apiKey || !instanceName) {
      setStatusMessage({ type: 'error', text: 'Preencha todos os campos e salve antes de gerar o QR Code.' });
      return;
    }
    setIsGeneratingQR(true);
    setStatusMessage(null);
    setQrCodeBase64(null);
    try {
      const response = await fetch(`${apiUrl}/instance/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey
        },
        body: JSON.stringify({
          instanceName: instanceName,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS"
        })
      });
      
      const data = await response.json();
      
      let base64Image = '';
      if (data.qrcode && data.qrcode.base64) {
        base64Image = data.qrcode.base64;
      } else if (data.base64) {
        base64Image = data.base64;
      } else if (data.hash && data.hash.qrcode) {
        // Fallback for some versions
      }
      
      if (base64Image) {
        if (!base64Image.startsWith('data:image')) {
            // Some versions return raw base64 without prefix
            // It's usually safe if it already has data:image, but if not we can add it, though evolution API usually returns the full data URL.
        }
        setQrCodeBase64(base64Image);
        setStatusMessage({ type: 'success', text: 'QR Code gerado! Escaneie com seu WhatsApp (Aparelhos Conectados).' });
      } else if (data.instance && data.instance.status === 'open') {
        setStatusMessage({ type: 'success', text: 'Esta instância já está conectada ao WhatsApp!' });
      } else {
        // Se a instância já existe, tentar o endpoint de connect
        const connectResponse = await fetch(`${apiUrl}/instance/connect/${instanceName}`, {
          method: 'GET',
          headers: {
            'apikey': apiKey
          }
        });
        const connectData = await connectResponse.json();
        if (connectData.base64) {
          setQrCodeBase64(connectData.base64);
          setStatusMessage({ type: 'success', text: 'QR Code gerado! Escaneie com seu WhatsApp.' });
        } else if (connectData.instance && connectData.instance.state === 'open') {
          setStatusMessage({ type: 'success', text: 'Esta instância já está conectada ao WhatsApp!' });
        } else {
          setStatusMessage({ type: 'error', text: 'Não foi possível gerar o QR Code. Tente reiniciar a API.' });
        }
      }
    } catch (error) {
      console.error('Erro ao gerar QR Code:', error);
      setStatusMessage({ type: 'error', text: 'Erro de conexão com a API para gerar o QR Code.' });
    } finally {
      setIsGeneratingQR(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-emerald-100 p-3 rounded-xl">
          <MessageSquare className="w-6 h-6 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Configuração WhatsApp</h1>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Evolution API</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <form onSubmit={handleSave} className="space-y-6">
          
          {statusMessage && (
            <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-bold animate-in fade-in zoom-in duration-300 ${
              statusMessage.type === 'success' 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {statusMessage.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              {statusMessage.text}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 md:col-span-2">
              <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">URL da API (Evolution)</label>
              <input
                type="url"
                required
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="Ex: https://sua-api.com"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
              />
              <p className="text-[10px] text-slate-400 font-medium">URL base onde a Evolution API está rodando, sem barra no final.</p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">Global API Key</label>
              <input
                type="password"
                required
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Insira a API Key"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">Nome da Instância</label>
              <input
                type="text"
                required
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
                placeholder="Ex: evolution-api-production"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between gap-4">
            <button
              type="button"
              onClick={handleGenerateQR}
              disabled={isGeneratingQR || !apiUrl || !apiKey || !instanceName}
              className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-6 py-3 rounded-xl font-black uppercase tracking-wider text-sm transition-all shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isGeneratingQR ? <Loader2 className="w-5 h-5 animate-spin" /> : <MessageSquare className="w-5 h-5" />}
              Parear WhatsApp (QR Code)
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-black uppercase tracking-wider text-sm transition-all shadow-lg shadow-emerald-200 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Salvar Configurações
            </button>
          </div>
        </form>

        {qrCodeBase64 && (
          <div className="mt-8 pt-8 border-t border-slate-100 flex flex-col items-center animate-in fade-in zoom-in duration-300">
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-2">QR Code de Pareamento</h3>
            <p className="text-sm font-bold text-slate-500 mb-6 text-center max-w-md">
              Abra o WhatsApp no seu celular, vá em <span className="text-slate-800">Dispositivos Conectados</span> {'>'} <span className="text-slate-800">Conectar um aparelho</span> e aponte a câmera para o QR Code abaixo.
            </p>
            <div className="bg-white p-4 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
              <img src={qrCodeBase64} alt="QR Code WhatsApp" className="w-64 h-64 object-contain" />
            </div>
            <p className="mt-4 text-xs font-bold text-emerald-600 bg-emerald-50 px-4 py-2 rounded-full">
              Instância: {instanceName}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConfigWhats;
