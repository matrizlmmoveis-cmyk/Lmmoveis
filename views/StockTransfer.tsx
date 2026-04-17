
import React, { useState } from 'react';
import { 
  ArrowLeftRight, 
  Search, 
  Plus, 
  Trash2, 
  Box, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  MapPin,
  ChevronRight,
  TrendingUp,
  Package
} from 'lucide-react';
import { Product, Store, InventoryItem, Employee } from '../types.ts';
import { supabaseService } from '../services/supabaseService.ts';

interface StockTransferProps {
  user: Employee | any;
  products: Product[];
  inventory: InventoryItem[];
  stores: Store[];
  employees: Employee[];
  refreshData: (scope?: any) => Promise<void>;
}

const StockTransfer: React.FC<StockTransferProps> = ({ user, products, inventory, stores, employees, refreshData }) => {
  const [originId, setOriginId] = useState<string>(() => {
    if (user.username === 'Master' || user.role === 'ADMIN') {
      const norte = stores.find(s => s.type === 'CD' && s.name.toLowerCase().includes('norte'));
      return norte?.id || '';
    }
    return user.storeId || '';
  });
  const [destId, setDestId] = useState<string>('');
  const [productSearch, setProductSearch] = useState('');
  const [transferItems, setTransferItems] = useState<{ productId: string, quantity: number }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const isMaster = user.username === 'Master' || user.role === 'ADMIN';

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(productSearch.toLowerCase()) || 
    (p.sku || '').toLowerCase().includes(productSearch.toLowerCase())
  ).slice(0, 10);

  const handleAddItem = (product: Product) => {
    if (transferItems.find(item => item.productId === product.id)) return;
    setTransferItems([...transferItems, { productId: product.id, quantity: 1 }]);
  };

  const handleRemoveItem = (productId: string) => {
    setTransferItems(transferItems.filter(item => item.productId !== productId));
  };

  const handleUpdateQty = (productId: string, qty: number) => {
    setTransferItems(transferItems.map(item => 
      item.productId === productId ? { ...item, quantity: Math.max(1, qty) } : item
    ));
  };

  const executeTransfer = async () => {
    if (!originId || !destId || transferItems.length === 0) return;
    setIsSubmitting(true);

    try {
      // Validar saldos antes de transferir
      for (const item of transferItems) {
        const stock = inventory.find(i => i.productId === item.productId && i.locationId === originId)?.quantity || 0;
        if (item.quantity > stock) {
          const pName = products.find(p => p.id === item.productId)?.name;
          alert(`Saldo insuficiente para ${pName} na origem. Disponível: ${stock} UN`);
          setIsSubmitting(false);
          return;
        }
      }

      await supabaseService.executeStockTransfer(originId, destId, transferItems, user.name);
      setSuccess(true);
      setTransferItems([]);
      setDestId('');
      refreshData('inventory');
      
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Erro na transferência:", err);
      alert("Erro ao executar transferência.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const originStore = stores.find(s => s.id === originId);
  const destStore = stores.find(s => s.id === destId);

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Transferência de Estoque</h1>
          <p className="text-slate-500 italic">Movimentação interna entre unidades</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* CONFIGURAÇÃO BARRA LATERAL */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4" /> Configuração
            </h3>

            {/* ORIGEM */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Origem</label>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-3">
                <div className="bg-emerald-100 p-2 rounded-xl">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{originStore?.name || 'Selecione Origem'}</p>
                  <p className="text-[10px] text-slate-500 uppercase font-medium">{originStore?.type || 'N/A'}</p>
                </div>
              </div>
              {!isMaster && (
                <p className="text-[9px] text-slate-400 ml-1 mt-1">Sua loja de cadastro está fixa como origem.</p>
              )}
            </div>

            <div className="flex justify-center -my-2 relative z-10">
              <div className="bg-white p-2 rounded-full border border-slate-100 shadow-sm text-slate-300">
                <TrendingUp className="w-5 h-5 rotate-90" />
              </div>
            </div>

            {/* DESTINO */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Destino</label>
              <select 
                className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-sm focus:border-blue-500 transition-all"
                value={destId}
                onChange={e => setDestId(e.target.value)}
              >
                <option value="">Selecione o destino...</option>
                {stores.filter(s => s.id !== originId).map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.type})</option>
                ))}
              </select>
            </div>

            {success && (
              <div className="bg-emerald-50 text-emerald-600 p-4 rounded-2xl flex items-center gap-3 text-xs font-bold border border-emerald-100 animate-in zoom-in-95">
                <CheckCircle2 className="w-5 h-5" />
                Transferência realizada com sucesso!
              </div>
            )}

            <button
              onClick={executeTransfer}
              disabled={isSubmitting || !destId || transferItems.length === 0}
              className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-slate-200 transition-all hover:bg-slate-800 disabled:bg-slate-200 disabled:shadow-none flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowLeftRight className="w-5 h-5" />}
              Finalizar Transferência
            </button>
          </div>
        </div>

        {/* BUSCA E ITENS */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm h-full flex flex-col min-h-[500px]">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-6">
              <Box className="w-4 h-4" /> Seleção de Produtos
            </h3>

            {/* BUSCA */}
            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar produto por nome ou SKU..." 
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 rounded-2xl text-sm transition-all"
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
              />
              {productSearch && (
                <div className="absolute z-20 w-full mt-2 bg-white border border-slate-100 rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-top-2">
                  {filteredProducts.map(p => {
                    const stock = inventory.find(i => i.productId === p.id && i.locationId === originId)?.quantity || 0;
                    return (
                      <button
                        key={p.id}
                        onClick={() => { handleAddItem(p); setProductSearch(''); }}
                        className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors"
                      >
                        <div>
                          <p className="font-bold text-sm text-slate-900 uppercase">{p.name}</p>
                          <p className="text-[10px] text-slate-400 font-medium">SKU: {p.sku || 'N/A'}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase">Saldo Origem</p>
                            <p className={`text-xs font-black ${stock > 0 ? 'text-emerald-600' : 'text-red-400'}`}>{stock} UN</p>
                          </div>
                          <div className="bg-blue-50 p-2 rounded-xl text-blue-600">
                            <Plus className="w-4 h-4" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  {filteredProducts.length === 0 && (
                    <div className="p-6 text-center text-slate-400">Nenhum produto encontrado</div>
                  )}
                </div>
              )}
            </div>

            <div className="flex-1 space-y-4">
              {transferItems.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40 space-y-4">
                  <div className="bg-slate-100 p-8 rounded-[2.5rem]">
                    <Package className="w-12 h-12 text-slate-300" />
                  </div>
                  <div>
                    <p className="font-black uppercase text-xs">Lista vazia</p>
                    <p className="text-[10px] font-medium max-w-[200px] mt-1 mx-auto">Adicione produtos na busca acima para iniciar a transferência.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between items-center px-2 mb-2">
                    <span className="text-[9px] font-black text-slate-400 uppercase">Resumo da Transferência</span>
                    <span className="text-[9px] font-black text-blue-600 uppercase bg-blue-50 px-2 py-1 rounded-lg">
                      {transferItems.length} Itens
                    </span>
                  </div>
                  {transferItems.map(item => {
                    const product = products.find(p => p.id === item.productId);
                    const stock = inventory.find(i => i.productId === item.productId && i.locationId === originId)?.quantity || 0;
                    
                    return (
                      <div key={item.productId} className="bg-slate-50 p-4 rounded-3xl border border-slate-100 flex items-center justify-between gap-4 animate-in slide-in-from-right-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-extrabold text-xs text-slate-800 uppercase truncate">{product?.name}</p>
                          <p className="text-[9px] text-slate-400 font-bold mt-0.5">Disponível em {originStore?.name}: <span className="text-slate-900">{stock} UN</span></p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden">
                            <button 
                              onClick={() => handleUpdateQty(item.productId, item.quantity - 1)}
                              className="px-3 py-2 hover:bg-slate-50 transition-colors"
                            >-</button>
                            <input 
                              type="number" 
                              className="w-12 text-center text-xs font-black outline-none bg-transparent"
                              value={item.quantity}
                              onChange={e => handleUpdateQty(item.productId, parseInt(e.target.value) || 1)}
                            />
                            <button 
                              onClick={() => handleUpdateQty(item.productId, item.quantity + 1)}
                              className="px-3 py-2 hover:bg-slate-50 transition-colors"
                            >+</button>
                          </div>
                          <button 
                            onClick={() => handleRemoveItem(item.productId)}
                            className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockTransfer;
