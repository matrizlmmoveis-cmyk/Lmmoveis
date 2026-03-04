import React, { useState } from 'react';
import { OrderStatus, Sale, Product, Employee } from '../types.ts';
import { supabaseService } from '../services/supabaseService';
import { Wrench, MapPin, CheckCircle, Clock, Printer, Phone, History } from 'lucide-react';

interface AssemblyProps {
  user: Employee | { id: string, name: string, role: string, storeId?: string } | null;
  sales: Sale[];
  setSales: React.Dispatch<React.SetStateAction<Sale[]>>;
  products: Product[];
  refreshData: (force?: boolean) => Promise<void>;
}

const Assembly: React.FC<AssemblyProps> = ({ user, sales, setSales, products, refreshData }) => {
  const [showHistory, setShowHistory] = useState(false);

  // Tarefas pendentes (aguardando entrega ou liberadas para montagem)
  const myTasks = sales.filter(s =>
    s.assemblyRequired &&
    (s.status === OrderStatus.DELIVERED || s.status === OrderStatus.SHIPPED || s.status === OrderStatus.PENDING) &&
    (user?.id === 'admin' || s.assignedAssemblerId === user?.id || (user?.role === 'GERENTE' && s.storeId === user.storeId))
  );

  // Histórico: montagens concluídas
  const myHistory = sales.filter(s =>
    s.assemblyRequired &&
    s.status === OrderStatus.COMPLETED &&
    (user?.id === 'admin' || s.assignedAssemblerId === user?.id || (user?.role === 'GERENTE' && s.storeId === user.storeId))
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const calculateTotalAssembly = (sale: Sale) => {
    return sale.items.reduce((acc, item) => {
      const prod = products.find(p => p.id === item.productId);
      return acc + (prod?.assemblyPrice || 0) * item.quantity;
    }, 0);
  };

  // Formata telefone para WhatsApp com +55
  const formatWhatsApp = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    return `https://wa.me/55${digits}`;
  };

  const handleComplete = async (id: string) => {
    try {
      await supabaseService.updateSaleStatus(id, OrderStatus.COMPLETED);
      setSales(prev => prev.map(s =>
        s.id === id ? { ...s, status: OrderStatus.COMPLETED } : s
      ));
    } catch (err) {
      console.error("Erro ao concluir montagem:", err);
      alert("Erro ao salvar no banco de dados.");
    }
  };

  const handlePrintAgenda = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Agenda de Montagem - Móveis LM</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #333; }
            .task { border: 2px solid #059669; border-radius: 15px; padding: 20px; margin-bottom: 20px; page-break-inside: avoid; }
            .task-header { display: flex; justify-content: space-between; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 10px; }
            .status { background: #ecfdf5; color: #059669; padding: 5px 10px; border-radius: 5px; font-weight: bold; font-size: 10px; text-transform: uppercase; }
            .customer-name { font-size: 20px; font-weight: bold; text-transform: uppercase; margin: 10px 0; }
            .address { font-weight: bold; color: #555; margin-bottom: 8px; }
            .phone { color: #0284c7; font-weight: bold; margin-bottom: 15px; }
            .dates { font-size: 11px; color: #666; margin-bottom: 10px; }
            .items { background: #f9f9f9; padding: 15px; border-radius: 10px; }
            .items-title { font-size: 10px; font-weight: bold; color: #999; text-transform: uppercase; margin-bottom: 5px; }
            .item { font-size: 14px; font-weight: bold; margin-bottom: 3px; display: flex; justify-content: space-between; }
            h1 { text-align: center; text-transform: uppercase; margin-bottom: 30px; color: #064e3b; }
          </style>
        </head>
        <body>
          <h1>Agenda de Montagem - ${new Date().toLocaleDateString('pt-BR')}</h1>
          ${myTasks.map((task) => {
      const itemsHtml = task.items.map(item => {
        const p = products.find(prod => prod.id === item.productId);
        return `<div class="item"><span>• ${item.quantity}x ${p?.name || item.productId}</span></div>`;
      }).join('');

      return `
              <div class="task">
                <div class="task-header">
                  <div class="status">${task.status === OrderStatus.DELIVERED ? 'LIBERADO P/ MONTAGEM' : 'AGUARDANDO ENTREGA'}</div>
                  <div style="font-weight: bold">PEDIDO #${task.id}</div>
                </div>
                <div class="customer-name">${task.customerName}</div>
                <div class="address">📍 ${task.deliveryAddress}</div>
                ${task.customerPhone ? `<div class="phone">📞 ${task.customerPhone}</div>` : ''}
                <div class="dates">
                  Venda: ${new Date(task.date).toLocaleDateString('pt-BR')}
                  ${task.deliveryDate ? ` | Entrega: ${new Date(task.deliveryDate).toLocaleDateString('pt-BR')}` : ''}
                </div>
                <div class="items">
                  <div class="items-title">Produtos para Montar</div>
                  ${itemsHtml}
                </div>
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

  const TaskCard = ({ task }: { task: Sale }) => {
    const val = calculateTotalAssembly(task);
    const isCompleted = task.status === OrderStatus.COMPLETED;
    return (
      <div key={task.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
        <div className="flex justify-between items-start">
          {isCompleted ? (
            <div className="bg-emerald-50 px-3 py-1 rounded-lg text-emerald-600 font-black text-[10px] uppercase flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Montagem Concluída
            </div>
          ) : task.status === OrderStatus.DELIVERED ? (
            <div className="bg-amber-50 px-3 py-1 rounded-lg text-amber-600 font-black text-[10px] uppercase flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Liberado p/ Montagem
            </div>
          ) : (
            <div className="bg-slate-100 px-3 py-1 rounded-lg text-slate-500 font-black text-[10px] uppercase flex items-center gap-1">
              <Clock className="w-3 h-3" /> Aguardando Entrega
            </div>
          )}
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-400">COMISSÃO</p>
            <p className="text-sm font-black text-emerald-600">R$ {val.toFixed(2)}</p>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-black text-slate-900 uppercase leading-tight">{task.customerName}</h3>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-2">
            <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="font-bold uppercase">{task.deliveryAddress}</span>
          </div>

          {/* Telefone e WhatsApp */}
          {task.customerPhone && (
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <a
                href={`tel:${task.customerPhone}`}
                className="flex items-center gap-1.5 text-xs font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100 hover:bg-blue-100 transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                {task.customerPhone}
              </a>
              <a
                href={formatWhatsApp(task.customerPhone)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-black text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 hover:bg-emerald-100 transition-colors"
              >
                {/* WhatsApp icon SVG */}
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                WhatsApp
              </a>
            </div>
          )}

          {/* Datas */}
          <div className="flex flex-wrap gap-3 mt-2">
            <span className="text-[10px] font-black text-slate-500 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
              📅 Venda: {new Date(task.date).toLocaleDateString('pt-BR')}
            </span>
            {task.deliveryDate && (
              <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100">
                🚚 Entrega: {new Date(task.deliveryDate).toLocaleDateString('pt-BR')}
              </span>
            )}
          </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-2xl">
          <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Produtos para Montar:</p>
          {task.items.map((item, i) => {
            const p = products.find(prod => prod.id === item.productId);
            return (
              <div key={i} className="flex justify-between items-center text-xs font-bold text-slate-700 uppercase mb-1">
                <span>• {item.quantity}x {p?.name || item.productId}</span>
                <span className="text-slate-400">R$ {(p?.assemblyPrice || 0).toFixed(2)} un</span>
              </div>
            );
          })}
        </div>

        {!isCompleted && (
          <button
            onClick={() => handleComplete(task.id)}
            disabled={task.status !== OrderStatus.DELIVERED}
            className={`w-full py-4 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 ${task.status === OrderStatus.DELIVERED
              ? 'bg-blue-600 text-white shadow-blue-100'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              }`}
          >
            <CheckCircle className="w-4 h-4" />
            {task.status === OrderStatus.DELIVERED ? 'Concluir Montagem' : 'Aguardando Entrega'}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-left duration-500">
      <header className="bg-emerald-900 p-6 rounded-[2rem] text-white shadow-xl">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight">Agenda de Montagem</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-emerald-400 text-xs font-bold uppercase">Ganhos Estimados: R$ {myTasks.reduce((a, b) => a + calculateTotalAssembly(b), 0).toFixed(2)}</p>
              <button
                onClick={() => refreshData('sales')}
                className="bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded text-[10px] font-black uppercase transition-colors flex items-center gap-1"
              >
                <Wrench className="w-3 h-3" /> Atualizar
              </button>
              <button
                onClick={handlePrintAgenda}
                className="bg-white text-emerald-900 hover:bg-emerald-50 px-2 py-0.5 rounded text-[10px] font-black uppercase transition-colors flex items-center gap-1"
              >
                <Printer className="w-3 h-3" /> Imprimir Agenda
              </button>
              <button
                onClick={() => setShowHistory(v => !v)}
                className="bg-emerald-700 hover:bg-emerald-600 px-2 py-0.5 rounded text-[10px] font-black uppercase transition-colors flex items-center gap-1"
              >
                <History className="w-3 h-3" /> Histórico ({myHistory.length})
              </button>
            </div>
          </div>
          <Wrench className="w-10 h-10 text-white/20" />
        </div>
      </header>

      {/* Lista de tarefas pendentes */}
      <div className="space-y-4">
        {myTasks.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-[2rem] border border-slate-100 shadow-sm">
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
            <p className="text-slate-900 font-black text-xl uppercase">Tudo Montado!</p>
            <p className="text-slate-500 text-sm mt-1 uppercase font-bold">Nenhuma ordem liberada para montagem no momento.</p>
          </div>
        ) : (
          myTasks.map((task) => <TaskCard key={task.id} task={task} />)
        )}
      </div>

      {/* Histórico de montagens concluídas */}
      {showHistory && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <History className="w-5 h-5 text-slate-400" />
            <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest">Histórico de Montagens Concluídas</h2>
          </div>
          {myHistory.length === 0 ? (
            <p className="text-xs text-slate-400 font-bold text-center py-6">Nenhuma montagem concluída ainda.</p>
          ) : (
            myHistory.map((task) => <TaskCard key={task.id} task={task} />)
          )}
        </div>
      )}
    </div>
  );
};

export default Assembly;
