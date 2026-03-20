import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Search, 
  Filter, 
  RefreshCw, 
  Eye, 
  Download, 
  Mail, 
  AlertCircle, 
  CheckCircle2, 
  Clock,
  ExternalLink,
  ChevronRight,
  Printer
} from 'lucide-react';
import { Sale, Product, Store } from '../types.ts';
import { supabaseService } from '../services/supabaseService.ts';
import { nfEmailService } from '../services/nfe/nfeService.ts';
import SaleReceipt from './SaleReceipt.tsx';

interface NFeManagementProps {
  sales: Sale[];
  products: Product[];
  stores: Store[];
  refreshData: () => Promise<void>;
}

const NFeManagement: React.FC<NFeManagementProps> = ({ sales, products, stores, refreshData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [nfeSales, setNfeSales] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  const fetchNFeSales = async () => {
    setIsLoading(true);
    try {
      const data = await supabaseService.getNFeSales();
      setNfeSales(data);
    } catch (error) {
      console.error("Erro ao carregar notas fiscais:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNFeSales();
  }, []);

  const filteredSales = nfeSales.filter(sale => {
    const matchesSearch = 
      sale.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.nfeNumber?.toString().includes(searchTerm) ||
      sale.nfeKey?.includes(searchTerm);
    
    const matchesStatus = statusFilter === 'all' || sale.nfeStatus === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'enviada': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'autorizada': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'rejeitada': return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      case 'cancelada': return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
      default: return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'enviada': return <Clock className="w-3.5 h-3.5" />;
      case 'autorizada': return <CheckCircle2 className="w-3.5 h-3.5" />;
      case 'rejeitada': return <AlertCircle className="w-3.5 h-3.5" />;
      default: return <Clock className="w-3.5 h-3.5" />;
    }
  };

  if (showReceipt && selectedSale) {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
        <button 
          onClick={() => setShowReceipt(false)}
          className="mb-6 flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold text-xs uppercase tracking-widest transition-colors"
        >
          ← Voltar para Gestão
        </button>
        <SaleReceipt 
          sale={selectedSale} 
          products={products} 
          stores={stores} 
          onClose={() => setShowReceipt(false)} 
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* ── HEADER & STATS ──────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Gestão de Notas Fiscais</h1>
          <p className="text-slate-500 font-medium mt-1">Monitore e gerencie todas as NF-e emitidas pelo sistema.</p>
        </div>
        <button 
          onClick={fetchNFeSales}
          disabled={isLoading}
          className="flex items-center gap-2 bg-white border border-slate-200 px-6 py-3 rounded-2xl font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Sincronizar
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="bg-blue-500/10 w-10 h-10 rounded-xl flex items-center justify-center mb-4">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Total Emitidas</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{nfeSales.length}</p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="bg-emerald-500/10 w-10 h-10 rounded-xl flex items-center justify-center mb-4">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Autorizadas</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{nfeSales.filter(s => s.nfeStatus?.toLowerCase() === 'autorizada').length}</p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="bg-rose-500/10 w-10 h-10 rounded-xl flex items-center justify-center mb-4">
            <AlertCircle className="w-5 h-5 text-rose-600" />
          </div>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Rejeitadas</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{nfeSales.filter(s => s.nfeStatus?.toLowerCase() === 'rejeitada').length}</p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="bg-amber-500/10 w-10 h-10 rounded-xl flex items-center justify-center mb-4">
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Pendente/Enviada</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{nfeSales.filter(s => s.nfeStatus?.toLowerCase() === 'enviada').length}</p>
        </div>
      </div>

      {/* ── FILTERS ────────────────────────────────────── */}
      <div className="bg-white p-4 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar por cliente, número ou chave..."
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none text-sm font-medium"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <select 
            className="bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">Todos os Status</option>
            <option value="Autorizada">Autorizada</option>
            <option value="Enviada">Pendente/Enviada</option>
            <option value="Rejeitada">Rejeitada</option>
            <option value="Cancelada">Cancelada</option>
          </select>
        </div>
      </div>

      {/* ── TABLE ──────────────────────────────────────── */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nota / Data</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-8 py-12 text-center text-slate-400 font-medium">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Carregando registros...
                  </td>
                </tr>
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-12 text-center text-slate-400 font-medium">
                    Nenhuma nota fiscal encontrada com os filtros selecionados.
                  </td>
                </tr>
              ) : filteredSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                      <span className="font-black text-slate-900 text-sm">Nº {sale.nfeNumber}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{new Date(sale.date).toLocaleDateString()}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-700 text-sm truncate max-w-[200px]">{sale.customerName}</span>
                      <span className="text-[10px] font-medium text-slate-400">{sale.customerCpf}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <span className="font-black text-slate-900 text-sm">
                      {sale.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex justify-center">
                      <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusColor(sale.nfeStatus)}`}>
                        {getStatusIcon(sale.nfeStatus)}
                        {sale.nfeStatus}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => {
                          const fullSale = sales.find(s => s.id === sale.id);
                          if (fullSale) {
                            setSelectedSale(fullSale);
                            setShowReceipt(true);
                          }
                        }}
                        className="p-2 hover:bg-white hover:shadow-md hover:text-blue-600 rounded-xl transition-all text-slate-400"
                        title="Ver Documento"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        className="p-2 hover:bg-white hover:shadow-md hover:text-blue-600 rounded-xl transition-all text-slate-400"
                        title="Imprimir DANFE"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      <button 
                        className="p-2 hover:bg-white hover:shadow-md hover:text-blue-600 rounded-xl transition-all text-slate-400"
                        title="Enviar por E-mail"
                      >
                        <Mail className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default NFeManagement;
