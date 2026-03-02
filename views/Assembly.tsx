import React from 'react';
import { OrderStatus, Sale, Product, Employee } from '../types.ts';
import { supabaseService } from '../services/supabaseService';
import { Wrench, MapPin, CheckCircle, Clock } from 'lucide-react';

interface AssemblyProps {
  user: Employee | { id: string, name: string, role: string, storeId?: string } | null;
  sales: Sale[];
  setSales: React.Dispatch<React.SetStateAction<Sale[]>>;
  products: Product[];
  refreshData: (force?: boolean) => Promise<void>;
}

const Assembly: React.FC<AssemblyProps> = ({ user, sales, setSales, products, refreshData }) => {
  // Polling removido por solicitação do usuário para economizar dados
  // Filtrar ordens de montagem designadas (aparecem se estiverem em rota ou entregues)
  const myTasks = sales.filter(s =>
    s.assemblyRequired &&
    (s.status === OrderStatus.DELIVERED || s.status === OrderStatus.SHIPPED || s.status === OrderStatus.PENDING) &&
    (user?.id === 'admin' || s.assignedAssemblerId === user?.id || (user?.role === 'GERENTE' && s.storeId === user.storeId))
  );

  const calculateTotalAssembly = (sale: Sale) => {
    return sale.items.reduce((acc, item) => {
      const prod = products.find(p => p.id === item.productId);
      return acc + (prod?.assemblyPrice || 0) * item.quantity;
    }, 0);
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

  return (
    <div className="space-y-6 animate-in slide-in-from-left duration-500">
      <header className="bg-emerald-900 p-6 rounded-[2rem] text-white shadow-xl">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight">Agenda de Montagem</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-emerald-400 text-xs font-bold uppercase">Ganhos Estimados: R$ {myTasks.reduce((a, b) => a + calculateTotalAssembly(b), 0).toFixed(2)}</p>
              <button
                onClick={() => refreshData(true)}
                className="bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded text-[10px] font-black uppercase transition-colors flex items-center gap-1"
              >
                <Wrench className="w-3 h-3" /> Atualizar
              </button>
            </div>
          </div>
          <Wrench className="w-10 h-10 text-white/20" />
        </div>
      </header>

      <div className="space-y-4">
        {myTasks.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-[2rem] border border-slate-100 shadow-sm">
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
            <p className="text-slate-900 font-black text-xl uppercase">Tudo Montado!</p>
            <p className="text-slate-500 text-sm mt-1 uppercase font-bold">Nenhuma ordem liberada para montagem no momento.</p>
          </div>
        ) : (
          myTasks.map((task) => {
            const val = calculateTotalAssembly(task);
            return (
              <div key={task.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                <div className="flex justify-between items-start">
                  {task.status === OrderStatus.DELIVERED ? (
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
                    <MapPin className="w-3.5 h-3.5 text-blue-500" />
                    <span className="font-bold uppercase">{task.deliveryAddress}</span>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl">
                  {task.deliveryDate && (
                    <p className="text-xs font-black text-blue-600 uppercase mb-3">
                      Data da Entrega: {new Date(task.deliveryDate).toLocaleDateString('pt-BR')}
                    </p>
                  )}
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
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Assembly;
