
import React, { useState } from 'react';
import { Truck, Wrench, Plus, Trash2, Printer, Search, User, ClipboardList, CheckCircle2, AlertCircle } from 'lucide-react';
import { OrderStatus, Sale, Employee } from '../types.ts';
import { supabaseService } from '../services/supabaseService.ts';

interface RomaneiosProps {
  sales: Sale[];
  setSales: React.Dispatch<React.SetStateAction<Sale[]>>;
  employees: Employee[];
}

const Romaneios: React.FC<RomaneiosProps> = ({ sales, setSales, employees: allEmployees }) => {
  // ... existing states ...
  const [type, setType] = useState<'entrega' | 'montagem'>('entrega');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [saleInput, setSaleInput] = useState('');
  const [batchSales, setBatchSales] = useState<Sale[]>([]);
  const [error, setError] = useState('');
  const [showPrint, setShowPrint] = useState(false);

  const employees = allEmployees.filter(e => type === 'entrega' ? e.role === 'MOTORISTA' : e.role === 'MONTADOR');

  const handleAddSale = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const ids = saleInput.split(/[\s,]+/).filter(id => id.trim() !== '');
    const foundSales: Sale[] = [];
    const notFound: string[] = [];

    ids.forEach(id => {
      const sale = sales.find(s => s.id === id);
      if (sale) {
        if (batchSales.find(bs => bs.id === id)) {
          // Skip
        } else {
          foundSales.push(sale);
        }
      } else {
        notFound.push(id);
      }
    });

    if (notFound.length > 0) {
      setError(`Código(s) de venda não encontrado(s): ${notFound.join(', ')}`);
    }

    setBatchSales([...batchSales, ...foundSales]);
    setSaleInput('');
  };

  const removeSale = (id: string) => {
    setBatchSales(batchSales.filter(s => s.id !== id));
  };

  const handleFinalize = async () => {
    if (!selectedEmployeeId) {
      setError('Por favor, selecione um responsável (Motorista/Montador).');
      return;
    }
    if (batchSales.length === 0) {
      setError('Adicione pelo menos um código de venda ao lote.');
      return;
    }

    try {
      // Persistir as atribuições no Supabase
      const batchIds = batchSales.map(bs => bs.id);

      const promises = batchIds.map(id => {
        if (type === 'entrega') {
          return supabaseService.updateSale(id, { assignedDriverId: selectedEmployeeId, status: OrderStatus.SHIPPED });
        } else {
          return supabaseService.updateSale(id, { assignedAssemblerId: selectedEmployeeId });
        }
      });

      await Promise.all(promises);

      // Atualizar estado local
      setSales(prevSales => prevSales.map(s => {
        if (batchIds.includes(s.id)) {
          if (type === 'entrega') {
            return { ...s, assignedDriverId: selectedEmployeeId, status: OrderStatus.SHIPPED };
          } else {
            return { ...s, assignedAssemblerId: selectedEmployeeId };
          }
        }
        return s;
      }));

      setShowPrint(true);
    } catch (err) {
      console.error("Erro ao salvar romaneio:", err);
      setError("Erro ao salvar atribuições no banco de dados.");
    }
  };

  if (showPrint) {
    const emp = allEmployees.find(e => e.id === selectedEmployeeId);
    return (
      <div className="max-w-4xl mx-auto p-8 bg-white shadow-xl min-h-screen animate-in zoom-in-95 duration-300">
        <div className="no-print flex justify-between items-center mb-8 bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <button onClick={() => setShowPrint(false)} className="text-slate-600 font-bold uppercase text-xs hover:underline">Voltar e Editar</button>
          <button onClick={() => window.print()} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-100">
            <Printer className="w-4 h-4" /> Imprimir Romaneio
          </button>
        </div>

        <div className="border-4 border-black p-6 font-mono-receipt text-black">
          <div className="text-center border-b-2 border-black pb-4 mb-4">
            <h1 className="text-2xl font-black uppercase">Móveis LM - Romaneio de {type === 'entrega' ? 'Entrega' : 'Montagem'}</h1>
            <p className="text-sm font-bold mt-1">Gerado em: {new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR')}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6 border-b-2 border-black pb-4">
            <div>
              <p className="text-[10px] font-black uppercase">Responsável Designado:</p>
              <p className="text-lg font-black uppercase">{emp?.name}</p>
              <p className="text-xs font-bold uppercase">{emp?.role}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase">Volume de Pedidos:</p>
              <p className="text-lg font-black">{batchSales.length} ITENS</p>
            </div>
          </div>

          <table className="w-full text-left border-collapse mb-8">
            <thead>
              <tr className="border-b-2 border-black text-xs font-black uppercase">
                <th className="py-2 w-16">Cod.</th>
                <th className="py-2">Cliente / Destino</th>
                <th className="py-2 w-24 text-right">Assinatura</th>
              </tr>
            </thead>
            <tbody>
              {batchSales.map(sale => (
                <tr key={sale.id} className="border-b border-black text-[11px] h-20">
                  <td className="py-2 font-black text-lg align-top">{sale.id}</td>
                  <td className="py-2 pr-4 align-top">
                    <p className="font-black uppercase text-sm">{sale.customerName}</p>
                    <p className="uppercase font-bold">{sale.deliveryAddress}</p>
                    <p className="italic text-[9px] mt-1">Obs: {sale.deliveryObs}</p>
                  </td>
                  <td className="py-2 border-l border-black align-bottom text-[8px] text-center">CLIENTE</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="grid grid-cols-2 gap-8 mt-12">
            <div className="text-center">
              <div className="border-t border-black pt-2 text-[10px] font-bold uppercase">Assinatura: {emp?.name}</div>
            </div>
            <div className="text-center">
              <div className="border-t border-black pt-2 text-[10px] font-bold uppercase">Conferente: Móveis LM</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-tight">Painel de Romaneios</h1>
        <p className="text-slate-500 font-medium">Criação de carga em lote por código de venda</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-5">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">1. Selecionar Operação</label>
              <div className="flex bg-slate-100 p-1 rounded-2xl">
                <button
                  onClick={() => { setType('entrega'); setBatchSales([]); setSelectedEmployeeId(''); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all ${type === 'entrega' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-50'}`}
                >
                  <Truck className="w-4 h-4" /> ENTREGAS
                </button>
                <button
                  onClick={() => { setType('montagem'); setBatchSales([]); setSelectedEmployeeId(''); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all ${type === 'montagem' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}
                >
                  <Wrench className="w-4 h-4" /> MONTAGENS
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">2. Escolher Responsável</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select
                  className="w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:border-blue-500 transition-all uppercase"
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                >
                  <option value="">Selecione o {type === 'entrega' ? 'Motorista' : 'Montador'}</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <form onSubmit={handleAddSale}>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">3. Digitar Código(s) da Venda</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ex: 101, 102"
                  className="flex-1 px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-blue-600 outline-none focus:border-blue-500 transition-all"
                  value={saleInput}
                  onChange={(e) => setSaleInput(e.target.value)}
                />
                <button
                  type="submit"
                  className="bg-slate-900 text-white px-6 rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg active:scale-95"
                >
                  <Plus className="w-6 h-6" />
                </button>
              </div>
              <p className="text-[9px] text-slate-400 mt-2 italic font-bold uppercase tracking-tighter">Separe múltiplos códigos por vírgula ou espaço.</p>
            </form>

            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-2xl flex items-center gap-3 text-xs font-bold border border-red-100 animate-in shake duration-300">
                <AlertCircle className="w-5 h-5 shrink-0" />
                {error}
              </div>
            )}
          </div>

          <button
            onClick={handleFinalize}
            className={`w-full py-5 rounded-[2.5rem] font-black uppercase tracking-widest text-sm shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 ${type === 'entrega' ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-emerald-600 text-white shadow-emerald-200'}`}
          >
            <ClipboardList className="w-5 h-5" />
            Lançar Romaneio em Lote
          </button>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm min-h-[500px] flex flex-col">
            <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50 rounded-t-[2rem]">
              <h3 className="font-black text-slate-900 uppercase text-xs tracking-widest flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Pedidos no Lote ({batchSales.length})
              </h3>
              {batchSales.length > 0 && (
                <button onClick={() => setBatchSales([])} className="text-red-500 font-bold text-[10px] uppercase hover:underline">Limpar Lote</button>
              )}
            </div>

            <div className="flex-1 p-6">
              {batchSales.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4 opacity-50 py-20">
                  <ClipboardList className="w-20 h-20 stroke-[1px]" />
                  <p className="font-black uppercase text-xs">Aguardando inclusão de códigos de venda...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {batchSales.map(sale => (
                    <div key={sale.id} className="bg-slate-50 p-5 rounded-[1.5rem] border border-slate-200 relative group animate-in slide-in-from-right-2 duration-300">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-black">#{sale.id}</span>
                        <span className="text-[10px] font-black text-slate-500 uppercase truncate flex-1">{sale.customerName}</span>
                      </div>
                      <p className="text-[10px] text-slate-600 font-bold uppercase line-clamp-2 leading-relaxed">{sale.deliveryAddress}</p>
                      <button
                        onClick={() => removeSale(sale.id)}
                        className="absolute -top-2 -right-2 bg-white text-red-500 p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all border border-slate-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Romaneios;
