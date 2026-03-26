
import React, { useState } from 'react';
import { Store, Employee } from '../types.ts';
import { Building2, Users, MapPin, Plus, UserPlus, Mail, Phone, X, Save, Settings, Warehouse, Store as StoreIcon2 } from 'lucide-react';
import { supabaseService } from '../services/supabaseService.ts';

interface StoresProps {
  stores: Store[];
  setStores: React.Dispatch<React.SetStateAction<Store[]>>;
  employees: Employee[];
}

const storeTypeLabels: Record<string, { label: string; badge: string; color: string; icon: React.ReactNode }> = {
  STORE_STOCK: { label: 'Loja / Ponto de Venda', badge: 'LOJA', color: 'bg-blue-100 text-blue-700', icon: <StoreIcon2 className="w-5 h-5" /> },
  CD: { label: 'CD Principal', badge: 'CD PRINCIPAL', color: 'bg-purple-100 text-purple-700', icon: <Warehouse className="w-5 h-5" /> },
  CD_LOJA: { label: 'CD da Loja', badge: 'CD LOJA', color: 'bg-amber-100 text-amber-700', icon: <Warehouse className="w-5 h-5" /> },
};

const Stores: React.FC<StoresProps> = ({ stores, setStores, employees }) => {
  const [tab, setTab] = useState<'stores' | 'sellers'>('stores');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);

  const [formData, setFormData] = useState<Partial<Store>>({
    name: '',
    location: '',
    phones: [''],
    type: 'STORE_STOCK',
    defaultDriverId: ''
  });

  const handleOpenModal = (store?: Store) => {
    if (store) {
      setEditingStore(store);
      setFormData(store);
    } else {
      setEditingStore(null);
      setFormData({ name: '', location: '', phones: [''], type: 'STORE_STOCK', defaultDriverId: '' });
    }
    setIsModalOpen(true);
  };

  const handleSaveStore = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingStore) {
        const updated = { ...editingStore, ...formData } as Store;
        await supabaseService.updateStore(editingStore.id, updated);
        setStores(stores.map(s => s.id === editingStore.id ? updated : s));
      } else {
        const newStore: Store = {
          id: `ST${Date.now()}`,
          name: formData.name || '',
          location: formData.location || '',
          phones: formData.phones || [],
          type: formData.type as Store['type'] || 'STORE_STOCK'
        };
        await supabaseService.createStore(newStore);
        setStores([...stores, newStore]);
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error("Erro ao salvar unidade:", err);
      alert("Erro ao salvar no banco de dados.");
    }
  };

  // Agrupar lojas por tipo para exibição organizada
  const storeGroups: { label: string; types: Store['type'][]; items: Store[] }[] = [
    { label: 'Lojas / Pontos de Venda', types: ['STORE_STOCK'], items: stores.filter(s => s.type === 'STORE_STOCK') },
    { label: 'CDs Principais', types: ['CD'], items: stores.filter(s => s.type === 'CD') },
    { label: 'CDs das Lojas', types: ['CD_LOJA'], items: stores.filter(s => s.type === 'CD_LOJA') },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Rede de Lojas</h1>
          <p className="text-slate-500">Gestão de unidades e equipe de vendas</p>
        </div>
        <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
          <button
            onClick={() => setTab('stores')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'stores' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Lojas
          </button>
          <button
            onClick={() => setTab('sellers')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'sellers' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Vendedores
          </button>
        </div>
      </header>

      {tab === 'stores' ? (
        <div className="space-y-8">
          {storeGroups.map(group => group.items.length > 0 && (
            <div key={group.label}>
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">{group.label}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.items.map((store) => {
                  const typeInfo = storeTypeLabels[store.type] || storeTypeLabels['STORE_STOCK'];
                  return (
                    <div key={store.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                      <div className="flex justify-between items-start mb-4">
                        <div className={`p-3 rounded-xl ${store.type === 'CD' || store.type === 'CD_LOJA' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                          {typeInfo.icon}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${typeInfo.color}`}>{typeInfo.badge}</span>
                          <button
                            onClick={() => handleOpenModal(store)}
                            className="p-2 opacity-0 group-hover:opacity-100 hover:bg-slate-100 rounded-lg transition-all text-slate-400 hover:text-blue-600"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 uppercase">{store.name}</h3>
                      <div className="flex items-start gap-2 text-slate-400 mt-2 mb-6 min-h-[40px]">
                        <MapPin className="w-4 h-4 shrink-0 mt-1" />
                        <span className="text-xs">{store.location || '—'}</span>
                      </div>

                      <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-slate-400" />
                          <span className="text-sm font-semibold text-slate-600">
                            {employees.filter(s => s.storeId === store.id && s.role === 'VENDEDOR').length} Vendedores
                          </span>
                        </div>
                        <span className="bg-emerald-50 text-emerald-600 text-[10px] font-bold px-2 py-1 rounded-lg">ATIVO</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Botão para adicionar */}
          <div>
            <button
              onClick={() => handleOpenModal()}
              className="border-2 border-dashed border-slate-200 p-6 rounded-2xl flex items-center justify-center gap-3 text-slate-400 hover:text-blue-500 hover:border-blue-200 transition-all hover:bg-blue-50/30 w-full"
            >
              <Plus className="w-8 h-8" />
              <span className="font-bold">Adicionar Unidade / CD</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h2 className="font-bold text-slate-900 uppercase">Equipe de Vendas</h2>
            <button
              onClick={() => alert("Para adicionar vendedores, acesse o menu 'Equipe' na barra lateral.")}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-blue-100"
            >
              <UserPlus className="w-4 h-4" />
              Novo Vendedor
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Vendedor</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Loja</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.filter(e => e.role === 'VENDEDOR').map(seller => (
                  <tr key={seller.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-900 text-sm uppercase">{seller.name}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-lg">
                        {stores.find(s => s.id === seller.storeId)?.name || 'LOJA DESCONHECIDA'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-blue-600 p-2"><Mail className="w-4 h-4" /></button>
                      <button className="text-slate-400 p-2 ml-2"><Phone className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Cadastro/Edição de Loja */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-black text-slate-900 uppercase">
                {editingStore ? 'Editar Unidade' : 'Cadastrar Unidade'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleSaveStore} className="p-6 space-y-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-1">Tipo de Unidade</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['STORE_STOCK', 'CD', 'CD_LOJA'] as const).map(type => {
                      const info = storeTypeLabels[type];
                      const isSelected = formData.type === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setFormData({ ...formData, type })}
                          className={`p-3 rounded-xl border-2 text-center transition-all ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                        >
                          <span className={`text-xs font-black block ${isSelected ? 'text-blue-700' : 'text-slate-500'}`}>{info.badge}</span>
                          <span className={`text-[10px] block mt-0.5 ${isSelected ? 'text-blue-500' : 'text-slate-400'}`}>{info.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-1">Nome da Unidade</label>
                  <input
                    required
                    type="text"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 transition-all outline-none font-bold uppercase"
                    placeholder="Ex: LOJA CENTRO"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-1">Endereço Completo</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 transition-all outline-none"
                    placeholder="Av. Exemplo, 123 - Centro"
                    value={formData.location}
                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                  />
                </div>
                <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Motorista Padrão (Entrega Automática)</label>
                <select
                  value={formData.defaultDriverId || ''}
                  onChange={(e) => setFormData({ ...formData, defaultDriverId: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="">Nenhum (Manual)</option>
                  {employees
                    .filter(emp => emp.role === 'MOTORISTA' && emp.active)
                    .map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))
                  }
                </select>
                <p className="text-xs text-slate-500 mt-1">Vendas desta unidade serão vinculadas automaticamente a este motorista.</p>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-400 uppercase mb-1">Telefone de Contato</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 transition-all outline-none"
                    placeholder="(00) 00000-0000"
                    value={formData.phones?.[0]}
                    onChange={e => setFormData({ ...formData, phones: [e.target.value] })}
                  />
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black shadow-xl shadow-blue-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  Salvar Unidade
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Stores;
