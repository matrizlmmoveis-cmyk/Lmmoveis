import React, { useState, useRef, useEffect } from 'react';
import { Truck, MapPin, CheckCircle2, Navigation, Package, Camera, X, Check, Eraser, Phone, MessageSquare, Printer } from 'lucide-react';
import { OrderStatus, Sale, Employee, Product, Store } from '../types.ts';
import { supabaseService } from '../services/supabaseService';

interface LogisticsProps {
  user: Employee | { id: string, name: string, role: string, storeId?: string } | null;
  sales: Sale[];
  setSales: React.Dispatch<React.SetStateAction<Sale[]>>;
  products: Product[];
  stores: Store[];
  refreshData: (force?: boolean) => Promise<void>;
}

const Logistics: React.FC<LogisticsProps> = ({ user, sales, setSales, products, stores, refreshData }) => {
  const [activeDeliveryId, setActiveDeliveryId] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);

  // Polling removido por solicitação do usuário para economizar dados
  const [photo, setPhoto] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); // Para assinatura
  const photoCanvasRef = useRef<HTMLCanvasElement>(null); // Para redimensionar foto
  const [isDrawing, setIsDrawing] = useState(false);

  const myDeliveries = sales.filter(s =>
    (s.status === OrderStatus.PENDING || s.status === OrderStatus.SHIPPED) &&
    (user?.id === 'admin' || s.assignedDriverId === user?.id || (user?.role === 'GERENTE' && s.storeId === user.storeId))
  );

  // Lógica da Câmera
  useEffect(() => {
    let stream: MediaStream | null = null;
    if (showCamera && videoRef.current) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(s => {
          stream = s;
          if (videoRef.current) videoRef.current.srcObject = s;
        })
        .catch(err => console.error("Erro câmera:", err));
    }
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, [showCamera]);

  const capturePhoto = () => {
    if (videoRef.current && photoCanvasRef.current) {
      const video = videoRef.current;
      const canvas = photoCanvasRef.current;
      // Resolução bem baixa como solicitado (ex: 320x240)
      const width = 320;
      const height = 240;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.5); // 0.5 qualidade
        setPhoto(dataUrl);
        setShowCamera(false);
      }
    }
  };

  // Lógica da Assinatura
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    draw(e);
  };

  const endDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.beginPath();
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'black';

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const clearSignature = () => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  const handleFinalizeDelivery = async () => {
    if (!activeDeliveryId) return;

    const sale = sales.find(s => s.id === activeDeliveryId);
    if (!sale) return;

    // Verificar se algum item da venda requer montagem
    const hasAssembly = sale.items.some(item => item.assemblyRequired);
    const nextStatus = hasAssembly ? OrderStatus.DELIVERED : OrderStatus.COMPLETED;

    const signatureData = canvasRef.current?.toDataURL();

    try {
      await supabaseService.updateSaleStatus(activeDeliveryId, nextStatus, {
        deliverySignature: signatureData,
        deliveryPhoto: photo || undefined
      });

      setSales(prev => prev.map(s =>
        s.id === activeDeliveryId
          ? { ...s, status: nextStatus, deliverySignature: signatureData, deliveryPhoto: photo || undefined }
          : s
      ));

      setActiveDeliveryId(null);
      setPhoto(null);
    } catch (err) {
      console.error("Erro ao baixar entrega:", err);
      alert("Erro ao salvar baixa no banco de dados.");
    }
  };

  const handlePrintRoute = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Rota de Entrega - Móveis LM</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #333; }
            .stop { border: 2px solid #333; border-radius: 15px; padding: 20px; margin-bottom: 20px; page-break-inside: avoid; }
            .stop-header { display: flex; justify-content: space-between; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 10px; }
            .stop-number { background: #000; color: #fff; padding: 5px 15px; border-radius: 5px; font-weight: bold; }
            .customer-name { font-size: 20px; font-weight: bold; text-transform: uppercase; margin: 10px 0; }
            .address { font-weight: bold; color: #555; margin-bottom: 15px; }
            .items { background: #f9f9f9; padding: 15px; border-radius: 10px; }
            .items-title { font-size: 10px; font-weight: bold; color: #999; text-transform: uppercase; margin-bottom: 5px; }
            .item { font-size: 14px; font-weight: bold; margin-bottom: 3px; }
            .obs { margin-top: 10px; padding: 10px; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 10px; }
            h1 { text-align: center; text-transform: uppercase; margin-bottom: 30px; }
          </style>
        </head>
        <body>
          <h1>Rota de Entrega - ${new Date().toLocaleDateString('pt-BR')}</h1>
          ${myDeliveries.map((delivery, index) => {
      const itemsHtml = delivery.items.map(item => {
        const p = products.find(prod => prod.id === item.productId);
        return `<div class="item">• ${item.quantity}x ${p?.name || item.productId}</div>`;
      }).join('');

      return `
              <div class="stop">
                <div class="stop-header">
                  <div class="stop-number">PARADA ${index + 1}</div>
                  <div style="font-weight: bold">PEDIDO #${delivery.id}</div>
                </div>
                <div class="customer-name">${delivery.customerName}</div>
                <div class="address">📍 ${delivery.deliveryAddress}</div>
                <div class="items">
                  <div class="items-title">Itens para entrega</div>
                  ${itemsHtml}
                </div>
                ${delivery.deliveryObs ? `
                  <div class="obs">
                    <div style="font-size: 10px; font-weight: bold; color: #d97706; text-transform: uppercase;">Observação:</div>
                    <div style="font-size: 12px; font-weight: bold;">${delivery.deliveryObs}</div>
                  </div>
                ` : ''}
              </div>
            `;
    }).join('')}
          <script>
            window.onload = function() { window.print(); window.close(); };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-right duration-500">
      <header className="bg-slate-900 p-6 rounded-[2rem] text-white shadow-xl">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight">Rota de Entrega</h1>
            <div class="flex items-center gap-2 mt-1">
              <p className="text-blue-400 text-xs font-bold uppercase">Status: Em Operação</p>
              <button
                onClick={() => refreshData('sales')}
                className="bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded text-[10px] font-black uppercase transition-colors flex items-center gap-1"
              >
                <Navigation className="w-3 h-3 rotate-90" /> Atualizar
              </button>
              <button
                onClick={handlePrintRoute}
                className="bg-white text-slate-900 hover:bg-slate-100 px-2 py-0.5 rounded text-[10px] font-black uppercase transition-colors flex items-center gap-1"
              >
                <Printer className="w-3 h-3" /> Imprimir
              </button>
            </div>
          </div>
          <Truck className="w-10 h-10 text-white/20" />
        </div>
        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="bg-white/10 p-4 rounded-2xl">
            <p className="text-[10px] font-black text-white/40 uppercase">Pendentes</p>
            <p className="text-2xl font-black">{myDeliveries.length}</p>
          </div>
          <div className="bg-white/10 p-4 rounded-2xl">
            <p className="text-[10px] font-black text-white/40 uppercase">Concluídas</p>
            <p className="text-2xl font-black">{sales.filter(s => s.status === OrderStatus.DELIVERED && (s.assignedDriverId === user?.id || (user?.role === 'GERENTE' && s.storeId === user.storeId))).length}</p>
          </div>
        </div>
      </header>

      <div className="space-y-4 pb-20">
        {myDeliveries.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-[2rem] border border-slate-100 shadow-sm">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
            <p className="text-slate-900 font-black text-xl">ROTA CONCLUÍDA!</p>
            <p className="text-slate-500 text-sm mt-1 uppercase font-bold">Nenhum pedido pendente no seu romaneio.</p>
          </div>
        ) : (
          myDeliveries.map((delivery, index) => (
            <div key={delivery.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
              <div className="flex justify-between items-start">
                <div className="bg-blue-50 px-3 py-1 rounded-lg text-blue-600 font-black text-[10px] uppercase">
                  Parada {index + 1}
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-slate-400">PEDIDO</p>
                  <p className="text-sm font-black text-slate-900">#{delivery.id}</p>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-black text-slate-900 uppercase leading-tight">{delivery.customerName}</h3>
                <div className="flex flex-col gap-2 mt-2">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <MapPin className="w-3.5 h-3.5 text-blue-500" />
                    <span className="font-bold uppercase">{delivery.deliveryAddress}</span>
                  </div>
                  {delivery.customerPhone && (
                    <div className="flex items-center gap-3 mt-1 underline-none">
                      <a
                        href={`tel:${delivery.customerPhone}`}
                        className="flex items-center gap-1.5 text-xs text-blue-600 font-bold hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors border border-blue-100"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        {delivery.customerPhone}
                      </a>
                      <a
                        href={`https://wa.me/${delivery.customerPhone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold hover:bg-emerald-50 px-2 py-1 rounded-lg transition-colors border border-emerald-100"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        WhatsApp
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-2 flex items-center gap-1">
                  <Package className="w-3 h-3" /> Conferência
                </p>
                <div className="space-y-1">
                  {delivery.items.map((item, i) => {
                    const p = products.find(prod => prod.id === item.productId);
                    const store = stores.find(s => s.id === item.locationId);
                    return (
                      <div key={i} className="flex justify-between items-center text-xs font-bold text-slate-700 uppercase">
                        <span>• {item.quantity}x {p?.name || item.productId}</span>
                        {store && (
                          <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded ml-2 shrink-0">
                            {store.name}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {delivery.deliveryObs && (
                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
                  <p className="text-[10px] font-black text-amber-600 uppercase mb-1">Observação:</p>
                  <p className="text-xs font-bold text-amber-900 uppercase">{delivery.deliveryObs}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button className="bg-slate-100 text-slate-900 py-4 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2">
                  <Navigation className="w-4 h-4" /> Rota GPS
                </button>
                <button onClick={() => setActiveDeliveryId(delivery.id)} className="bg-emerald-600 text-white py-4 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 transition-all active:scale-95">
                  <CheckCircle2 className="w-4 h-4" /> Baixar Entrega
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal de Baixa de Entrega */}
      {activeDeliveryId && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h2 className="text-xl font-black text-slate-900 uppercase">Comprovar Entrega</h2>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pedido #{activeDeliveryId}</p>
              </div>
              <button onClick={() => setActiveDeliveryId(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400"><X className="w-6 h-6" /></button>
            </div>

            <div className="p-6 space-y-6">
              {/* Seção de Foto */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">1. Foto do Local/Comprovante</label>
                {!photo ? (
                  <button
                    onClick={() => setShowCamera(true)}
                    className="w-full h-40 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all"
                  >
                    <Camera className="w-8 h-8" />
                    <span className="font-bold text-xs uppercase">Abrir Câmera</span>
                  </button>
                ) : (
                  <div className="relative h-40 rounded-3xl overflow-hidden border-2 border-emerald-500">
                    <img src={photo} className="w-full h-full object-cover" />
                    <button onClick={() => setPhoto(null)} className="absolute top-2 right-2 bg-white/90 p-2 rounded-full text-red-500 shadow-lg"><X className="w-4 h-4" /></button>
                    <div className="absolute bottom-2 left-2 bg-emerald-500 text-white text-[8px] font-black px-2 py-1 rounded">CAPTURA OK (320px)</div>
                  </div>
                )}
              </div>

              {/* Seção de Assinatura */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">2. Assinatura do Recebedor</label>
                  <button onClick={clearSignature} className="text-red-500 flex items-center gap-1 text-[10px] font-black uppercase"><Eraser className="w-3 h-3" /> Limpar</button>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-3xl overflow-hidden touch-none">
                  <canvas
                    ref={canvasRef}
                    width={400}
                    height={180}
                    className="w-full bg-white cursor-crosshair"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={endDrawing}
                    onMouseOut={endDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={endDrawing}
                  />
                </div>
              </div>

              <button
                onClick={handleFinalizeDelivery}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-3xl font-black uppercase tracking-widest text-sm shadow-xl shadow-blue-500/20 transition-all active:scale-95 flex items-center justify-center gap-3"
              >
                <Check className="w-6 h-6" /> Finalizar e Baixar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tela de Câmera Fullscreen */}
      {showCamera && (
        <div className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center">
          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
          <div className="absolute bottom-10 flex gap-6">
            <button onClick={() => setShowCamera(false)} className="bg-white/20 p-5 rounded-full text-white backdrop-blur-md"><X className="w-8 h-8" /></button>
            <button onClick={capturePhoto} className="bg-white p-5 rounded-full text-blue-600 shadow-2xl shadow-blue-500/50"><Camera className="w-8 h-8" /></button>
          </div>
          <div className="absolute top-10 text-white font-black text-xs uppercase tracking-widest bg-black/40 px-4 py-2 rounded-full border border-white/20">Modo de Baixa Resolução Ativado</div>
          <canvas ref={photoCanvasRef} className="hidden" />
        </div>
      )}
    </div>
  );
};

export default Logistics;
