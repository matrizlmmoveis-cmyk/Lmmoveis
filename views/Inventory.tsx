
import React, { useState } from 'react';
import { Box, MapPin, MoveHorizontal, Search, Settings2, X, Plus, Minus, FileText } from 'lucide-react';
import { InventoryItem, Product, Store } from '../types.ts';
import { supabaseService } from '../services/supabaseService.ts';

interface InventoryProps {
  inventory: InventoryItem[];
  setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  products: Product[];
  stores: Store[];
}

const Inventory: React.FC<InventoryProps> = ({ inventory, setInventory, products, stores }) => {
  const [selectedStockType, setSelectedStockType] = useState<'CD' | 'STORE_STOCK'>('CD');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Adjustment Modal State
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustForm, setAdjustForm] = useState({
    productId: '',
    locationId: '',
    type: 'IN', // IN or OUT
    quantity: 1,
    reason: ''
  });
  const [isAdjusting, setIsAdjusting] = useState(false);

  const handleAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustForm.productId || !adjustForm.locationId || adjustForm.quantity <= 0) return;
    setIsAdjusting(true);

    try {
      const currentItem = inventory.find(i => i.productId === adjustForm.productId && i.locationId === adjustForm.locationId);
      const currentQty = currentItem?.quantity || 0;
      const newQty = adjustForm.type === 'IN' ? currentQty + adjustForm.quantity : Math.max(0, currentQty - adjustForm.quantity);
      const selectedStore = stores.find(s => s.id === adjustForm.locationId);
      const storeType = selectedStore?.type || 'STORE_STOCK';

      await supabaseService.updateInventory(adjustForm.productId, adjustForm.locationId, newQty, storeType);

      // Update local state
      let newInventory = [...inventory];
      if (currentItem) {
        newInventory = newInventory.map(i => i.productId === adjustForm.productId && i.locationId === adjustForm.locationId ? { ...i, quantity: newQty } : i);
      } else {
        newInventory.push({ productId: adjustForm.productId, locationId: adjustForm.locationId, quantity: newQty, type: storeType, lastUpdated: new Date().toISOString() } as InventoryItem);
      }
      setInventory(newInventory);
      setIsAdjustModalOpen(false);
      setAdjustForm({ productId: '', locationId: '', type: 'IN', quantity: 1, reason: '' });

    } catch (err) {
      console.error("Erro ao ajustar estoque", err);
      alert("Erro ao salvar ajuste. Tente novamente.");
    } finally {
      setIsAdjusting(false);
    }
  };

  const filteredProductsRaw = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

  // Calculate total stock for each product and sort descending
  const filteredProducts = filteredProductsRaw.map(product => {
    let totalStock = 0;
    if (selectedLocation === 'all') {
      const relevantStores = stores.filter(s => s.type === selectedStockType);
      relevantStores.forEach(loc => {
        const qty = inventory.find(i => i.productId === product.id && i.locationId === loc.id && i.type === selectedStockType)?.quantity || 0;
        totalStock += qty;
      });
    } else {
      const qty = inventory.find(i => i.productId === product.id && i.locationId === selectedLocation && i.type === selectedStockType)?.quantity || 0;
      totalStock = qty;
    }
    return { ...product, totalStock };
  }).sort((a, b) => b.totalStock - a.totalStock);

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Controle de Estoque</h1>
          <p className="text-slate-500">Gerencie o estoque de CDs e Lojas</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsAdjustModalOpen(true)}
            className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-800 transition-all shadow-lg"
          >
            <Settings2 className="w-4 h-4" />
            <span>Ajuste Avulso</span>
          </button>
          <button
            onClick={() => alert("Módulo de Entrada de Nota por XML em construção.")}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
          >
            Entrada de Nota
          </button>
        </div>
      </header>

      <div className="flex gap-4 mb-4">
        <button
          onClick={() => { setSelectedStockType('CD'); setSelectedLocation('all'); }}
          className={`shrink-0 px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${selectedStockType === 'CD' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'}`}
        >
          Estoque de CDs
        </button>
        <button
          onClick={() => { setSelectedStockType('STORE_STOCK'); setSelectedLocation('all'); }}
          className={`shrink-0 px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${selectedStockType === 'STORE_STOCK' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'}`}
        >
          Estoque de Lojas
        </button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedLocation('all')}
          className={`shrink-0 px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${selectedLocation === 'all' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'}`}
        >
          Todos
        </button>
        {stores.filter(s => s.type === selectedStockType).map(loc => (
          <button
            key={loc.id}
            onClick={() => setSelectedLocation(loc.id)}
            className={`shrink-0 flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${selectedLocation === loc.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'}`}
          >
            <MapPin className="w-4 h-4" />
            {loc.name}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Pesquisar produto no estoque..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 rounded-xl text-sm transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Produto / SKU</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Categoria</th>
                {selectedLocation === 'all' ? (
                  stores.filter(s => s.type === selectedStockType).map(loc => (
                    <th key={loc.id} className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-center">{loc.name}</th>
                  ))
                ) : (
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-center">Quantidade</th>
                )}
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map(product => {
                let totalStock = 0;
                return (
                  <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 rounded-lg">
                          <Box className="w-5 h-5 text-slate-500" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">{product.name}</p>
                          <p className="text-xs text-slate-500">{product.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded-md">{product.category}</span>
                    </td>

                    {selectedLocation === 'all' ? (
                      stores.filter(s => s.type === selectedStockType).map(loc => {
                        const qty = inventory.find(i => i.productId === product.id && i.locationId === loc.id && i.type === selectedStockType)?.quantity || 0;
                        totalStock += qty;
                        return (
                          <td key={loc.id} className="px-6 py-4 text-center">
                            <span className={`text-sm font-medium ${qty > 0 ? 'text-slate-900' : 'text-slate-300'}`}>{qty}</span>
                          </td>
                        );
                      })
                    ) : (
                      <td className="px-6 py-4 text-center">
                        {(() => {
                          const qty = inventory.find(i => i.productId === product.id && i.locationId === selectedLocation && i.type === selectedStockType)?.quantity || 0;
                          totalStock = qty;
                          return <span className={`text-sm font-semibold ${qty > 0 ? 'text-blue-600' : 'text-slate-300'}`}>{qty}</span>;
                        })()}
                      </td>
                    )}

                    <td className="px-6 py-4 text-right">
                      <span className={`text-sm font-bold ${totalStock < 5 ? 'text-red-500' : 'text-slate-900'}`}>
                        {totalStock} un
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE AJUSTE DE ESTOQUE */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-black text-slate-900 uppercase">Ajuste Manual de Estoque</h2>
              <button disabled={isAdjusting} onClick={() => setIsAdjustModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleAdjustmentSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setAdjustForm({ ...adjustForm, type: 'IN' })}
                  className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all ${adjustForm.type === 'IN' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-100 hover:border-slate-200 text-slate-500'}`}
                >
                  <Plus className={`w-8 h-8 ${adjustForm.type === 'IN' ? 'text-emerald-500' : 'text-slate-400'}`} />
                  <span className="font-bold">ENTRADA</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustForm({ ...adjustForm, type: 'OUT' })}
                  className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all ${adjustForm.type === 'OUT' ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-100 hover:border-slate-200 text-slate-500'}`}
                >
                  <Minus className={`w-8 h-8 ${adjustForm.type === 'OUT' ? 'text-red-500' : 'text-slate-400'}`} />
                  <span className="font-bold">SAÍDA</span>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-1">Produto</label>
                  <select
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-sm text-slate-700"
                    value={adjustForm.productId}
                    onChange={e => setAdjustForm({ ...adjustForm, productId: e.target.value })}
                  >
                    <option value="">Selecione o produto</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} - {p.sku}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-1">Local (CD ou Loja)</label>
                  <select
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-sm text-slate-700"
                    value={adjustForm.locationId}
                    onChange={e => setAdjustForm({ ...adjustForm, locationId: e.target.value })}
                  >
                    <option value="">Selecione o local destimo</option>
                    {stores.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase mb-1">Quantidade</label>
                    <input
                      required
                      type="number"
                      min="1"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-sm text-slate-700"
                      value={adjustForm.quantity}
                      onChange={e => setAdjustForm({ ...adjustForm, quantity: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase mb-1">Motivo do Ajuste</label>
                    <input
                      required
                      type="text"
                      placeholder="Ex: Contagem, Avaria..."
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm text-slate-700 uppercase"
                      value={adjustForm.reason}
                      onChange={e => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={isAdjusting}
                  className={`w-full py-4 rounded-2xl font-black shadow-xl transition-all flex items-center justify-center gap-2 ${isAdjusting ? 'bg-slate-400 cursor-not-allowed' :
                    adjustForm.type === 'IN' ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-100' :
                      'bg-red-600 hover:bg-red-700 text-white shadow-red-100'
                    }`}
                >
                  <FileText className="w-5 h-5" />
                  {isAdjusting ? 'Moficando...' : 'Confirmar Ajuste'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
