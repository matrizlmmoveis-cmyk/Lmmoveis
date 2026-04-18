import React, { useState, useEffect } from 'react';
import { Truck, Wrench, Plus, Trash2, Printer, Search, User, ClipboardList, CheckCircle2, AlertCircle, History, ArrowLeft, Calendar, Package, Phone, MapPin, MessageSquare, RefreshCw } from 'lucide-react';
import { OrderStatus, Sale, Employee, Romaneio, Product, Store } from '../types.ts';
import { supabaseService } from '../services/supabaseService.ts';

interface RomaneiosProps {
  user: Employee | null;
  sales: Sale[];
  setSales: React.Dispatch<React.SetStateAction<Sale[]>>;
  employees: Employee[];
  products: Product[];
  stores: Store[];
  refreshData: (force?: boolean) => Promise<void>;
}

const Romaneios: React.FC<RomaneiosProps> = ({ user, sales, setSales, employees: allEmployees, products, stores, refreshData }) => {
  const [view, setView] = useState<'create' | 'history'>('create');
  const [romaneios, setRomaneios] = useState<Romaneio[]>([]);
  const [type, setType] = useState<'entrega' | 'montagem'>('entrega');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [saleInput, setSaleInput] = useState('');
  const [batchSales, setBatchSales] = useState<Sale[]>([]);
  const [error, setError] = useState('');
  const [showPrint, setShowPrint] = useState(false);
  const [filterEmployeeId, setFilterEmployeeId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedRomaneioIds, setSelectedRomaneioIds] = useState<string[]>([]);

  useEffect(() => {
    loadRomaneios();
  }, []);

  const loadRomaneios = async () => {
    try {
      const data = await supabaseService.getRomaneios();
      setRomaneios(data);
    } catch (err) {
      console.error("Erro ao carregar romaneios:", err);
    }
  };

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
        } else if (type === 'montagem' && !sale.assemblyRequired) {
          notFound.push(`${id} (Não exige montagem)`);
        } else {
          foundSales.push(sale);
        }
      } else {
        notFound.push(id);
      }
    });

    if (notFound.length > 0) {
      setError(`Código(s) inválido(s) ou não encontrado(s): ${notFound.join(', ')}`);
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
      const batchIds = batchSales.map(bs => bs.id);

      const promises = batchIds.map(id => {
        if (type === 'entrega') {
          return supabaseService.updateSale(id, { assignedDriverId: selectedEmployeeId, status: OrderStatus.AWAITING_LOAD });
        } else {
          return supabaseService.updateSale(id, { assignedAssemblerId: selectedEmployeeId });
        }
      });

      await Promise.all(promises);

      await supabaseService.createRomaneio({
        type,
        employeeId: selectedEmployeeId,
        saleIds: batchIds,
        status: 'ATIVO'
      });

      setSales(prevSales => prevSales.map(s => {
        if (batchIds.includes(s.id)) {
          if (type === 'entrega') {
            return { ...s, assignedDriverId: selectedEmployeeId, status: OrderStatus.AWAITING_LOAD };
          } else {
            return { ...s, assignedAssemblerId: selectedEmployeeId };
          }
        }
        return s;
      }));

      loadRomaneios();
      setShowPrint(true);
    } catch (err) {
      console.error("Erro ao salvar romaneio:", err);
      setError("Erro ao salvar atribuições no banco de dados.");
    }
  };

  const handleDeleteRomaneio = async (romaneio: Romaneio) => {
    if (!window.confirm("Deseja realmente excluir este romaneio? As vendas associadas voltarão ao status pendente.")) return;

    try {
      await supabaseService.deleteRomaneio(romaneio.id, romaneio.saleIds, romaneio.type);
      setRomaneios(prev => prev.filter(r => r.id !== romaneio.id));
      await refreshData('sales');
      alert("Romaneio excluído com sucesso!");
    } catch (err) {
      console.error("Erro ao excluir romaneio:", err);
      alert("Erro ao excluir romaneio.");
    }
  };

  const formatAddress = (addr: any): string => {
    if (!addr) return 'Endereço não informado';
    try {
      let parsed = typeof addr === 'string' ? JSON.parse(addr) : addr;
      if (typeof parsed === 'string') parsed = JSON.parse(parsed); // Double encoding case
      
      if (!parsed || typeof parsed !== 'object') return addr;
      
      const parts = [];
      const getVal = (obj: any, keys: string[]) => {
        for (const k of keys) {
          if (obj[k]) return obj[k];
        }
        return '';
      };

      const street = getVal(parsed, ['STREET', 'Street', 'street']);
      const number = getVal(parsed, ['NUMBER', 'Number', 'number']);
      const neighborhood = getVal(parsed, ['NEIGHBORHOOD', 'Neighborhood', 'neighborhood']);
      const city = getVal(parsed, ['CITY', 'City', 'city']);
      const state = getVal(parsed, ['STATE', 'State', 'state']);

      if (street) parts.push(street.trim());
      if (number) parts.push(number.trim());
      if (neighborhood) parts.push(neighborhood.trim());
      if (city) parts.push(city.trim());
      if (state) parts.push(state.trim());
      
      return parts.length > 0 ? parts.join(', ') : (typeof addr === 'string' ? addr : JSON.stringify(addr));
    } catch {
      return typeof addr === 'string' ? addr : JSON.stringify(addr);
    }
  };

  const handleOpenBatchPrint = () => {
    const selectedRomaneios = romaneios.filter(r => selectedRomaneioIds.includes(r.id));
    if (selectedRomaneios.length === 0) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Por favor, permita pop-ups para imprimir.");
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Impressão em Lote - Móveis LM</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            body { font-family: 'Inter', sans-serif; margin: 0; padding: 15px; font-size: 11.5px; color: #000; background: #fff; }
            .no-print-btn { background: #1e293b; color: #fff; border: none; padding: 10px 25px; border-radius: 12px; font-weight: 900; font-size: 13px; cursor: pointer; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
            .no-print-btn:hover { background: #0f172a; }
            @media print { .no-print-btn { display: none; } body { padding: 0; } }
            table { width: 100%; border-collapse: collapse; }
            .border-container { border-top: 2px solid #000; border-left: 2px solid #000; border-right: 2px solid #000; }
            .row { border-bottom: 2px solid #000; display: flex; gap: 10px; padding: 6px; page-break-inside: avoid; align-items: stretch; }
            .col-info { width: 75px; border-right: 1.5px solid #000; padding-right: 6px; flex-shrink: 0; }
            .col-sales { flex: 1.1; border-right: 1.5px solid #000; padding-right: 6px; min-width: 0; }
            .col-products { flex: 1.4; border-right: 1.5px solid #000; padding-right: 6px; flex-shrink: 0; }
            .col-sigs { width: 120px; display: flex; flex-direction: column; justify-content: space-around; padding: 2px 0; flex-shrink: 0; }
            .font-black { font-weight: 900; }
            .font-bold { font-weight: 700; }
            .uppercase { text-transform: uppercase; }
            .text-7 { font-size: 8.5px; }
            .text-6 { font-size: 7px; }
            .text-8 { font-size: 10.5px; }
            .opacity-40 { opacity: 0.5; }
            .underline { text-decoration: underline; }
            .sig-box { border-bottom: 1px solid #ccc; height: 22px; display: flex; align-items: center; justify-content: center; }
            .footer { margin-top: 10px; text-align: right; font-size: 7.5px; font-weight: 900; font-style: italic; opacity: 0.4; }
            .truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .item-row { border-bottom: 1px solid #f1f5f9; }
            .item-row:last-child { border-bottom: none; }
          </style>
        </head>
        <body>
          <button class="no-print-btn" onclick="window.print()">🖨️ Iniciar Impressão</button>
          <div class="border-container">
            ${selectedRomaneios.map(r => {
              const emp = allEmployees.find(e => e.id === r.employeeId);
              const romaneioSales = sales.filter(s => r.saleIds.includes(s.id));
              return `
                <div class="row">
                  <div class="col-info">
                    <div class="font-black" style="font-size: 9px;">CARGA ${r.id}</div>
                    <div class="font-black uppercase" style="font-size: 11px; line-height: 1;">${r.type === 'entrega' ? 'ENT' : 'MONT'}</div>
                    <div class="font-bold uppercase opacity-40 truncate" style="font-size: 7.5px; margin-top: 3px;">${emp?.name || '—'}</div>
                  </div>
                  <div class="col-sales">
                    ${romaneioSales.map(sale => `
                      <div style="margin-bottom: 5px; border-bottom: 1px dashed #eee; padding-bottom: 3px;">
                        <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 5px;">
                          <span class="font-black underline text-8">#${sale.id}</span>
                          <span class="font-black uppercase text-8 truncate" style="flex: 1;">${sale.customerName}</span>
                        </div>
                        <div class="font-bold uppercase text-7 truncate" style="font-style: italic; opacity: 0.8;">${formatAddress(sale.deliveryAddress)}</div>
                        <div class="text-7 uppercase" style="display: flex; gap: 7px; margin-top: 2px;">
                          ${sale.customerPhone ? `<span class="font-bold">📞 ${sale.customerPhone}</span>` : ''}
                          ${sale.deliveryObs ? `<span class="font-black" style="color: #1e40af;">OBS: ${sale.deliveryObs}</span>` : ''}
                        </div>
                      </div>
                    `).join('')}
                  </div>
                  <div class="col-products">
                    <table class="text-7">
                      <thead>
                        <tr style="border-bottom: 1.5px solid #000;">
                          <th style="text-align: left; width: 22px;">Q</th>
                          <th style="text-align: left;">PRODUTO</th>
                          <th style="text-align: right; width: 65px;">ORIGEM</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${romaneioSales.flatMap(s => s.items).map(item => {
                          const prod = products.find(p => p.id === item.productId);
                          const storeName = stores.find(st => st.id === item.locationId)?.name || item.locationId || '—';
                          return `
                            <tr class="item-row font-bold">
                              <td class="font-black" style="font-size: 10px;">${item.quantity}x</td>
                              <td class="uppercase truncate" style="max-width: 160px; font-size: 9px;">${prod?.name || item.productId}</td>
                              <td style="text-align: right;" class="font-black opacity-40 uppercase">${storeName}</td>
                            </tr>
                          `;
                        }).join('')}
                      </tbody>
                    </table>
                  </div>
                  <div class="col-sigs">
                    <div class="sig-box">
                      <span class="text-6 font-black uppercase opacity-40">ASSINATURA CLIENTE</span>
                    </div>
                    <div class="sig-box">
                      <span class="text-6 font-black uppercase opacity-40">CONFERÊNCIA LM</span>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
          <div class="footer uppercase">
            Móveis LM — Gerado em: ${new Date().toLocaleString('pt-BR')} — Romaneios: ${selectedRomaneios.length} — Itens: ${selectedRomaneios.reduce((acc, r) => acc + sales.filter(s => r.saleIds.includes(s.id)).reduce((a, s) => a + s.items.reduce((q, i) => q + i.quantity, 0), 0), 0)} UN
          </div>
          <script>
            // Auto-trigger print if requested? User might prefer to click.
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  if (showPrint) {
    const emp = allEmployees.find(e => e.id === selectedEmployeeId);
    const isEntrega = type === 'entrega';
    return (
      <div className="max-w-4xl mx-auto p-8 bg-white shadow-xl min-h-screen animate-in zoom-in-95 duration-300">
        <div className="no-print flex justify-between items-center mb-8 bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <button onClick={() => setShowPrint(false)} className="text-slate-600 font-bold uppercase text-xs hover:underline">Voltar e Editar</button>
          <button onClick={() => window.print()} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-100">
            <Printer className="w-4 h-4" /> Imprimir Romaneio
          </button>
        </div>

        <div className="border-4 border-black p-6 font-mono text-black print:border-2">
          <div className="text-center border-b-2 border-black pb-4 mb-4">
            <h1 className="text-2xl font-black uppercase">Móveis LM — Romaneio de {isEntrega ? 'Entrega' : 'Montagem'}</h1>
            <p className="text-sm font-bold mt-1">Gerado em: {new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR')}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6 border-b-2 border-black pb-4">
            <div>
              <p className="text-[10px] font-black uppercase">{isEntrega ? 'Motorista' : 'Montador'} Responsável:</p>
              <p className="text-lg font-black uppercase">{emp?.name}</p>
              <p className="text-xs font-bold uppercase">{emp?.role}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase">Total de Pedidos:</p>
              <p className="text-lg font-black">{batchSales.length} PEDIDO{batchSales.length !== 1 ? 'S' : ''}</p>
              <p className="text-[10px] font-black uppercase mt-1">Itens Totais:</p>
              <p className="text-base font-black">{batchSales.reduce((acc, s) => acc + s.items.reduce((a, i) => a + i.quantity, 0), 0)} UN</p>
            </div>
          </div>

          <div className="space-y-6">
            {batchSales.map((sale, idx) => (
              <div key={sale.id} className="border-2 border-black">
                <div className={`px-4 py-2 flex items-center justify-between ${isEntrega ? 'bg-gray-100' : 'bg-gray-50'}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-black">#{sale.id}</span>
                    <span className="text-sm font-black uppercase">{idx + 1}º PEDIDO</span>
                  </div>
                  {sale.assemblyRequired && <span className="text-[9px] font-black border border-black px-2 py-0.5 uppercase">Exige Montagem</span>}
                </div>

                <div className="p-4 grid grid-cols-1 gap-3">
                  <div className="border-b border-dashed border-gray-400 pb-3">
                    <p className="text-[9px] font-black uppercase mb-1">Cliente / {isEntrega ? 'Destino' : 'Local'}</p>
                    <p className="text-base font-black uppercase">{sale.customerName}</p>
                    {isEntrega && (
                      <>
                        <p className="text-xs font-bold uppercase mt-0.5">{formatAddress(sale.deliveryAddress)}</p>
                        {sale.customerPhone && <p className="text-xs font-bold mt-0.5">📞 {sale.customerPhone}</p>}
                        {sale.customerCpf && <p className="text-[10px] text-gray-600 font-bold mt-0.5">CPF: {sale.customerCpf}</p>}
                        {sale.deliveryObs && (
                          <div className="mt-1 bg-gray-100 border border-gray-300 rounded px-2 py-1">
                            <p className="text-[9px] font-black uppercase">Obs da Venda:</p>
                            <p className="text-[10px] font-bold italic">{sale.deliveryObs}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div>
                    <p className="text-[9px] font-black uppercase mb-1">Itens do Pedido</p>
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-gray-400">
                          <th className="text-left text-[9px] font-black uppercase py-1 pr-2">Qtd</th>
                          <th className="text-left text-[9px] font-black uppercase py-1">Produto</th>
                          {isEntrega && <th className="text-right text-[9px] font-black uppercase py-1">Local Orig.</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {sale.items.map((item, iIdx) => {
                          const prod = products.find(p => p.id === item.productId);
                          return (
                            <tr key={iIdx} className="border-b border-dashed border-gray-200">
                              <td className="py-1 pr-2 font-black text-sm align-top">{item.quantity}x</td>
                              <td className="py-1 font-bold text-[11px] uppercase align-top">{prod?.name || item.productId}</td>
                              {isEntrega && (
                                <td className="py-1 pl-2 text-[9px] font-bold text-gray-500 text-right align-top">{item.locationId || '—'}</td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {isEntrega && (
                    <div className="mt-2 pt-2 border-t border-dashed border-gray-400">
                      <div className="h-10 border-b border-black mt-4"></div>
                      <p className="text-[8px] font-black uppercase text-center mt-1">Assinatura do Cliente</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

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
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-tight">Painel de Romaneios</h1>
          <p className="text-slate-500 font-medium">Criação de carga em lote por código de venda</p>
        </div>
        <button
          onClick={() => setView(view === 'create' ? 'history' : 'create')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all font-bold text-xs uppercase ${view === 'create' ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-blue-600 text-white shadow-lg'}`}
        >
          {view === 'create' ? (
            <><History className="w-4 h-4" /> Histórico</>
          ) : (
            <><Plus className="w-4 h-4" /> Novo Romaneio</>
          )}
        </button>
      </header>

      {view === 'history' ? (
        <div className="space-y-4 animate-in slide-in-from-right-4 duration-500">
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block tracking-widest pl-2">Filtrar por Responsável</label>
              <select
                className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-blue-500 transition-all uppercase"
                value={filterEmployeeId}
                onChange={(e) => setFilterEmployeeId(e.target.value)}
              >
                <option value="">Todos os Responsáveis</option>
                {allEmployees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block tracking-widest pl-2">Filtrar por Status</label>
              <select
                className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-blue-500 transition-all uppercase"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">Todos os Status</option>
                <option value="ATIVO">Ativo</option>
                <option value="CONCLUIDO">Concluído</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              {(filterEmployeeId || filterStatus) && (
                <button
                  onClick={() => { setFilterEmployeeId(''); setFilterStatus(''); }}
                  className="h-10 px-4 text-[10px] font-black uppercase text-red-500 hover:bg-red-50 rounded-xl transition-all"
                >
                  Limpar Filtros
                </button>
              )}
              {selectedRomaneioIds.length > 0 && (
                <button
                  onClick={handleOpenBatchPrint}
                  className="h-10 px-6 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-blue-100 flex items-center gap-2 hover:bg-blue-700 transition-all"
                >
                  <Printer className="w-4 h-4" /> Abrir em HTML ({selectedRomaneioIds.length})
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h3 className="font-black text-slate-900 uppercase text-xs tracking-widest flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-500" />
                Histórico de Cargas Lançadas
              </h3>
              <button
                onClick={() => { loadRomaneios(); refreshData('sales'); }}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50 transition-all"
              >
                <RefreshCw className="w-3 h-3" /> Atualizar Tudo
              </button>
            </div>
            
            {/* Lógica de cálculo dinâmico de status e filtragem */}
            {(() => {
              const getRomaneioStatus = (r: Romaneio) => {
                if (r.status === 'CONCLUIDO') return 'CONCLUIDO';
                const romSales = sales.filter(s => r.saleIds.includes(s.id));
                if (romSales.length === 0) return r.status || 'ATIVO';
                const allFinished = romSales.every(s => {
                  if (r.type === 'entrega') {
                    return ['Entregue - Aguardando Montagem', 'Montagem Pendente', 'Entregue', 'Finalizado', 'Cancelada'].includes(s.status);
                  }
                  return ['Entregue', 'Finalizado', 'Cancelada'].includes(s.status);
                });
                return allFinished ? 'CONCLUIDO' : 'ATIVO';
              };

              const filteredRows = romaneios.filter(r => {
                const currentStatus = getRomaneioStatus(r);
                const matchesEmp = !filterEmployeeId || r.employeeId === filterEmployeeId;
                const matchesStatus = !filterStatus || currentStatus === filterStatus;
                return matchesEmp && matchesStatus;
              });

              const isAllFilteredSelected = filteredRows.length > 0 && filteredRows.every(r => selectedRomaneioIds.includes(r.id));

              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase font-black text-slate-400">
                        <th className="px-6 py-4 w-10">
                          <input
                            type="checkbox"
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            checked={isAllFilteredSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                const newIds = Array.from(new Set([...selectedRomaneioIds, ...filteredRows.map(r => r.id)]));
                                setSelectedRomaneioIds(newIds);
                              } else {
                                const remainingIds = selectedRomaneioIds.filter(id => !filteredRows.some(r => r.id === id));
                                setSelectedRomaneioIds(remainingIds);
                              }
                            }}
                          />
                        </th>
                        <th className="px-6 py-4">Data / Hora</th>
                        <th className="px-6 py-4">Tipo / Status</th>
                        <th className="px-6 py-4">Responsável</th>
                        <th className="px-6 py-4">Volumes</th>
                        <th className="px-6 py-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {romaneios.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-20 text-center">
                            <p className="text-slate-400 font-bold uppercase text-xs">Nenhum romaneio encontrado no histórico.</p>
                          </td>
                        </tr>
                      ) : (
                        filteredRows.map(r => {
                          const emp = allEmployees.find(e => e.id === r.employeeId);
                          const isSelected = selectedRomaneioIds.includes(r.id);
                          const currentStatus = getRomaneioStatus(r);
                          return (
                            <tr key={r.id} className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}>
                                <td className="px-6 py-4">
                                  <input
                                    type="checkbox"
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedRomaneioIds([...selectedRomaneioIds, r.id]);
                                      } else {
                                        setSelectedRomaneioIds(selectedRomaneioIds.filter(id => id !== r.id));
                                      }
                                    }}
                                  />
                                </td>
                                <td className="px-6 py-4">
                                  <p className="text-sm font-bold text-slate-700">{new Date(r.createdAt!).toLocaleDateString('pt-BR')}</p>
                                  <p className="text-[10px] text-slate-400 font-bold">{new Date(r.createdAt!).toLocaleTimeString('pt-BR')}</p>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex flex-col gap-1">
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase w-fit ${r.type === 'entrega' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>{r.type}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase w-fit ${currentStatus === 'ATIVO' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>{currentStatus}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <p className="text-sm font-bold text-slate-700 uppercase">{emp?.name || 'Não identificado'}</p>
                                  <p className="text-[10px] text-slate-400 font-bold uppercase">{emp?.role}</p>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex -space-x-2">
                                    {r.saleIds.slice(0, 5).map((id, i) => (
                                      <div key={i} className="w-7 h-7 bg-slate-100 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-black text-slate-600 shadow-sm">#{id}</div>
                                    ))}
                                    {r.saleIds.length > 5 && (
                                      <div className="w-7 h-7 bg-blue-600 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-black text-white shadow-sm">+{r.saleIds.length - 5}</div>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      onClick={() => {
                                        const romaneioSales = sales.filter(s => r.saleIds.includes(s.id));
                                        setType(r.type);
                                        setSelectedEmployeeId(r.employeeId);
                                        setBatchSales(romaneioSales);
                                        setShowPrint(true);
                                      }}
                                      className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-200 transition-all flex items-center gap-2"
                                    >
                                      <Printer className="w-3 h-3" /> Re-imprimir
                                    </button>
                                    {(user?.username === 'Master' || user?.role === 'SUPERVISOR' || user?.role === 'ADMIN') && (
                                      <button
                                        onClick={() => handleDeleteRomaneio(r)}
                                        className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-600 hover:text-white transition-all flex items-center gap-2"
                                      >
                                        <Trash2 className="w-3 h-3" /> Excluir
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                      )}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-5">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">1. Selecionar Operação</label>
                <div className="flex bg-slate-100 p-1 rounded-2xl">
                  <button
                    onClick={() => { setType('entrega'); setBatchSales([]); setSelectedEmployeeId(''); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all ${type === 'entrega' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
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
                  <button type="submit" className="bg-slate-900 text-white px-6 rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg active:scale-95">
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
                        <p className="text-[10px] text-slate-600 font-bold uppercase line-clamp-2 leading-relaxed">{formatAddress(sale.deliveryAddress)}</p>
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
      )}
    </div>
  );
};

export default Romaneios;
