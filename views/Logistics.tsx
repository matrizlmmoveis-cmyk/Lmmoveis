import React, { useState, useRef, useEffect } from 'react';
import { Truck, MapPin, CheckCircle2, Navigation, Package, Camera, X, Check, Eraser, Phone, MessageSquare, Printer, History } from 'lucide-react';
import { OrderStatus, Sale, Employee, Product, Store } from '../types.ts';
import { supabaseService } from '../services/supabaseService';

interface LogisticsProps {
  user: Employee | { id: string, name: string, role: string, storeId?: string } | null;
  sales: Sale[];
  setSales: React.Dispatch<React.SetStateAction<Sale[]>>;
  products: Product[];
  stores: Store[];
  employees: Employee[];
  refreshData: (force?: boolean) => Promise<void>;
}

const Logistics: React.FC<LogisticsProps> = ({ user, sales = [], setSales, products = [], stores = [], employees = [], refreshData }) => {
  const [activeDeliveryId, setActiveDeliveryId] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Polling removido por solicitação do usuário para economizar dados
  const [photo, setPhoto] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); // Para assinatura
  const photoCanvasRef = useRef<HTMLCanvasElement>(null); // Para redimensionar foto
  const [isDrawing, setIsDrawing] = useState(false);

  // Entregas ativas (PENDING ou SHIPPED)
  const myDeliveries = (sales || []).filter(s =>
    (s.status === OrderStatus.PENDING || s.status === OrderStatus.SHIPPED) &&
    (user?.id === 'admin' || s.assignedDriverId === user?.id || (user && 'role' in user && user.role === 'GERENTE' && s.storeId === user.storeId))
  );

  // Histórico de entregas (DELIVERED, ASSEMBLY_PENDING, COMPLETED)
  const myHistory = (sales || []).filter(s =>
    (s.status === OrderStatus.DELIVERED || s.status === OrderStatus.COMPLETED || s.status === OrderStatus.ASSEMBLY_PENDING) &&
    (user?.id === 'admin' || s.assignedDriverId === user?.id || (user && 'role' in user && user.role === 'GERENTE' && s.storeId === user.storeId))
  ).sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

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
      const width = 320;
      const height = 240;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
        setPhoto(dataUrl);
        setShowCamera(false);
      }
    }
  };

  const calculateAmountToReceive = (sale: Sale) => {
    if (!sale.payments) return 0;
    return sale.payments
      .filter(p => p.method === 'Entrega' && (p.status === 'PENDENTE_ENTREGA' || p.status === 'AGUARDANDO_ACERTO'))
      .reduce((acc, p) => acc + p.amount, 0);
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

    const hasAssembly = (sale.items || []).some(item => item.assemblyRequired);
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
            .info-bar { font-size: 10px; display: flex; gap: 15px; margin-bottom: 15px; color: #444; font-weight: bold; text-transform: uppercase; }
            .to-receive { background: #fef3c7; border: 2px solid #f59e0b; padding: 10px; border-radius: 8px; margin-bottom: 15px; text-align: center; }
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
      const store = (stores || []).find(s => s.id === delivery.storeId);
      const seller = (employees || []).find(e => e.id === delivery.sellerId);
      const toReceive = calculateAmountToReceive(delivery);

      const itemsHtml = (delivery.items || []).map(item => {
        const p = products.find(prod => prod.id === item.productId);
        const itemStore = (stores || []).find(s => s.id === item.locationId);
        const itemStoreName = itemStore ? ` (${itemStore.name})` : '';
        return `<div class="item">• ${item.quantity}x ${p?.name || item.productId}${itemStoreName}</div>`;
      }).join('');

      return `
              <div class="stop">
                <div class="stop-header">
                  <div class="stop-number">PARADA ${index + 1}</div>
                  <div style="font-weight: bold">PEDIDO #${delivery.id}</div>
                </div>
                <div class="customer-name">${delivery.customerName}</div>
                <div class="address">📍 ${delivery.deliveryAddress}</div>
                
                <div class="info-bar">
                  <span>UNIDADE: ${store?.name || 'N/A'}</span>
                  <span>VENDEDOR: ${seller?.name || 'N/A'}</span>
                  <span>DATA VENDA: ${delivery.date ? new Date(delivery.date).toLocaleDateString('pt-BR') : 'N/A'}</span>
                </div>

                ${toReceive > 0 ? `
                  <div class="to-receive">
                    <div style="font-size: 10px; font-weight: bold; color: #b45309; text-transform: uppercase;">Valor a Receber na Entrega:</div>
                    <div style="font-size: 24px; font-weight: 900; color: #92400e;">R$ ${toReceive.toFixed(2)}</div>
                  </div>
                ` : ''}

                ${delivery.customerReference ? `
                  <div style="margin-bottom: 15px; padding: 10px; background: #f1f5f9; border-radius: 10px;">
                    <div style="font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase;">Ponto de Referência:</div>
                    <div style="font-size: 13px; font-weight: bold; color: #334155;">📍 ${delivery.customerReference}</div>
                  </div>
                ` : ''}

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

  // Agrupar entregas por Loja
  const groupedTasks = (stores || []).map(store => ({
    store,
    tasks: myDeliveries.filter(t => t.storeId === store.id)
  })).filter(g => g.tasks.length > 0);

  const DeliveryCard = ({ task, isHistory = false }: { task: Sale, isHistory?: boolean, key?: any }) => {
    const store = (stores || []).find(s => s.id === task.storeId);
    const seller = (employees || []).find(e => e.id === task.sellerId);
    const toReceive = calculateAmountToReceive(task);

    return (
      <div key={task.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1">
            <div className={`px-3 py-1 rounded-lg font-black text-[10px] uppercase inline-flex items-center gap-1 ${isHistory ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
              {isHistory ? <CheckCircle2 className="w-3 h-3" /> : <Package className="w-3 h-3" />}
              {isHistory ? 'Entrega Concluída' : 'Pendente de Entrega'}
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-400">PEDIDO</p>
            <p className="text-sm font-black text-slate-900">#{task.id}</p>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-black text-slate-900 uppercase leading-tight">{task.customerName}</h3>

          <div className="flex flex-col gap-1 mt-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span className="font-bold uppercase line-clamp-2">{task.deliveryAddress}</span>
            </div>
            {task.customerReference && (
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 bg-slate-50 p-2 rounded-xl border border-slate-100 italic">
                <span className="font-bold shrink-0">REF:</span>
                <span className="font-medium uppercase">{task.customerReference}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 mt-3">
            <div className="bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
              <p className="text-[8px] font-black text-slate-400 uppercase">Unidade</p>
              <p className="text-[10px] font-bold text-slate-700 uppercase">{store?.name || 'N/A'}</p>
            </div>
            <div className="bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
              <p className="text-[8px] font-black text-slate-400 uppercase">Vendedor</p>
              <p className="text-[10px] font-bold text-slate-700 uppercase">{seller?.name || 'N/A'}</p>
            </div>
            <div className="bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
              <p className="text-[8px] font-black text-slate-400 uppercase">Venda</p>
              <p className="text-[10px] font-bold text-slate-700 lowercase">{task.date ? new Date(task.date).toLocaleDateString('pt-BR') : 'N/A'}</p>
            </div>
          </div>
        </div>

        {!isHistory && toReceive > 0 && (
          <div className="mt-4 bg-amber-50 border-2 border-amber-200 p-4 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-amber-600 uppercase">VALOR A RECEBER</p>
              <p className="text-2xl font-black text-amber-900">R$ {toReceive.toFixed(2)}</p>
            </div>
            <div className="bg-amber-200 text-amber-700 p-2 rounded-xl">
              <span className="text-xs font-black uppercase">DINHEIRO/PIX/POS</span>
            </div>
          </div>
        )}

        {!isHistory && task.customerPhone && (
          <div className="flex items-center gap-3 mt-4 flex-wrap">
            <a
              href={`tel:${task.customerPhone}`}
              className="flex items-center gap-1.5 text-xs font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100 hover:bg-blue-100 transition-colors"
            >
              <Phone className="w-3.5 h-3.5" />
              {task.customerPhone}
            </a>
            <a
              href={`https://wa.me/55${task.customerPhone.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-black text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 hover:bg-emerald-100 transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              WhatsApp
            </a>
          </div>
        )}

        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase mb-2 flex items-center gap-1">
            <Package className="w-3 h-3" /> Conferência
          </p>
          <div className="space-y-1">
            {(task.items || []).map((item, i) => {
              const p = products.find(prod => prod.id === item.productId);
              const itemStore = (stores || []).find(s => s.id === item.locationId);
              const itemStoreName = itemStore ? ` (${itemStore.name})` : '';
              return (
                <div key={i} className="flex justify-between items-center text-xs font-bold text-slate-700 uppercase">
                  <span>• {item.quantity}x {p?.name || item.productId}{itemStoreName}</span>
                </div>
              );
            })}
          </div>
        </div>

        {task.deliveryObs && (
          <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100/50">
            <p className="text-[10px] font-black text-amber-600 uppercase mb-1">Observação:</p>
            <p className="text-xs font-bold text-amber-900 uppercase">{task.deliveryObs}</p>
          </div>
        )}

        {!isHistory && (
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button className="bg-slate-100 text-slate-900 py-4 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2">
              <Navigation className="w-4 h-4" /> Rota GPS
            </button>
            <button onClick={() => setActiveDeliveryId(task.id)} className="bg-emerald-600 text-white py-4 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 transition-all active:scale-95">
              <CheckCircle2 className="w-4 h-4" /> Baixar Entrega
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-right duration-500">
      <header className="bg-slate-900 p-6 rounded-[2rem] text-white shadow-xl">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight">Minha Rota</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-blue-400 text-xs font-bold uppercase">Setor: Entrega</p>
              <button
                onClick={() => refreshData(true)}
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
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`p-4 rounded-2xl transition-all ${showHistory ? 'bg-emerald-500 text-white shadow-lg' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
          >
            <History className="w-6 h-6" />
          </button>
        </div>
      </header>

      <div className="space-y-8 pb-20">
        {showHistory ? (
          <>
            <div className="flex items-center gap-3 px-1">
              <div className="h-px bg-slate-200 flex-1" />
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Histórico Concluído ({myHistory.length})</h2>
              <div className="h-px bg-slate-200 flex-1" />
            </div>
            {myHistory.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-[2rem] border border-slate-100 shadow-sm">
                <History className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-500 text-sm mt-1 uppercase font-bold">Nenhuma entrega no histórico.</p>
              </div>
            ) : (
              myHistory.map(task => <DeliveryCard key={task.id} task={task} isHistory />)
            )}
          </>
        ) : (
          groupedTasks.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-[2rem] border border-slate-100 shadow-sm">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
              <p className="text-slate-900 font-black text-xl">ROTA CONCLUÍDA!</p>
              <p className="text-slate-500 text-sm mt-1 uppercase font-bold">Nenhum pedido pendente para entrega hoje.</p>
            </div>
          ) : (
            groupedTasks.map(({ store, tasks }) => (
              <div key={store.id} className="space-y-4">
                <div className="flex items-center gap-3 px-1">
                  <div className="h-px bg-slate-200 flex-1" />
                  <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">{store.name} ({tasks.length})</h2>
                  <div className="h-px bg-slate-200 flex-1" />
                </div>
                <div className="space-y-4">
                  {tasks.map(task => <DeliveryCard key={task.id} task={task} />)}
                </div>
              </div>
            ))
          )
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
