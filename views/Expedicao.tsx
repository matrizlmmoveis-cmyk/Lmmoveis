import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase.ts';
import { CheckCircle, XCircle, Package, RefreshCw, Search, AlertTriangle, ChevronDown, ChevronUp, Clock } from 'lucide-react';

interface SaleItem {
    id: string;
    sale_id: string;
    product_id: string;
    product_name?: string;
    quantity: number;
    price: number;
    dispatch_status: string;
    sales?: {
        id: string;
        customer_name: string;
        store_id: string;
        created_at: string;
    };
    products?: {
        name: string;
        sku: string;
        image_url?: string;
    };
}

interface ExpedicaoProps {
    user: any;
    stores: any[];
}

const DRIVE_PREFIX = 'https://drive.google.com/drive/folders/1V6M5rwQDy-1W4ZSmbIhR_x9zjsfS3ha3/';

const getImageUrl = (imageUrl?: string) => {
    if (!imageUrl) return null;
    if (imageUrl.startsWith('http')) return imageUrl;
    return DRIVE_PREFIX + imageUrl;
};

const Expedicao: React.FC<ExpedicaoProps> = ({ user, stores }) => {
    const [items, setItems] = useState<SaleItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [search, setSearch] = useState('');

    const [stats, setStats] = useState({ pendente: 0, separado: 0, indisponivel: 0 });
    const [filterStore, setFilterStore] = useState('Todos');
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [activeTab, setActiveTab] = useState<'SEPARACAO' | 'DEVOLUCOES'>('SEPARACAO');
    const [devolutionItems, setDevolutionItems] = useState<any[]>([]);
    const [devReturnModal, setDevReturnModal] = useState<{ itemId: string; productName: string; qty: number; locationId: string } | null>(null);

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const loadItems = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            // Buscar itens pendentes de vendas do CD Norte
            const { data, error } = await supabase
                .from('sale_items')
                .select(`
          id, sale_id, product_id, quantity, price, dispatch_status, location_id,
          sales!inner(id, customer_name, store_id, created_at),
          products(name, sku, image_url)
        `)
                .eq('dispatch_status', 'PENDENTE')
                .order('sale_id');

            if (error) throw error;

            // Filtrar pelo CD do item (location_id), não pela loja que vendeu
            const filtered = (data || []).filter((item: any) => {
                if (filterStore === 'Todos') return true;
                if (item.location_id === filterStore) return true;
                // fallback: comparar pelo nome
                const locationName = stores.find(s => s.id === item.location_id)?.name || '';
                return locationName.toLowerCase().includes('norte') || locationName.toLowerCase().includes('cd norte');
            });

            setItems(filtered as unknown as SaleItem[]);

            // Stats filtrados pelo CD (para consistência com a lista)
            const { data: statsData } = await supabase
                .from('sale_items')
                .select('dispatch_status, location_id');

            const counts = { pendente: 0, separado: 0, indisponivel: 0 };
            (statsData || []).forEach((r: any) => {
                const matchesFilter = filterStore === 'Todos' || r.location_id === filterStore || (
                    stores.find(s => s.id === r.location_id)?.name.toLowerCase().includes('norte') &&
                    (filterStore.toLowerCase().includes('norte') || filterStore.toLowerCase().includes('cd norte'))
                );

                if (matchesFilter) {
                    if (r.dispatch_status === 'PENDENTE') counts.pendente++;
                    else if (r.dispatch_status === 'SEPARADO') counts.separado++;
                    else if (r.dispatch_status === 'INDISPONIVEL') counts.indisponivel++;
                }
            });
            setStats(counts);
        } catch (err) {
            console.error('Erro ao carregar expedição:', err);
        } finally {
            if (!silent) setLoading(false);
        }
    }, [stores, filterStore]);

    const loadDevolutions = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('sale_items')
                .select(`id, sale_id, product_id, quantity, price, dispatch_status,
          sales!inner(id, customer_name, store_id),
          products(name, sku)`)
                .eq('dispatch_status', 'DEVOLVER');
            if (error) throw error;
            setDevolutionItems(data || []);
        } catch (err) {
            console.error('Erro ao carregar devoluções:', err);
        }
    }, []);

    useEffect(() => {
        loadItems();
        loadDevolutions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Auto-refresh inteligente (apenas para Conferente e em primeiro plano)
    useEffect(() => {
        if (user?.role !== 'CONFERENTE') return;

        let intervalId: NodeJS.Timeout;

        const startInterval = () => {
            intervalId = setInterval(() => {
                if (document.visibilityState === 'visible') {
                    loadItems(true); // Atualiza silenciosamente sem recarregar a tela (sem spinner)
                }
            }, 30000); // 30 segundos
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                loadItems(true);
                startInterval();
            } else {
                clearInterval(intervalId);
            }
        };

        if (document.visibilityState === 'visible') {
            startInterval();
        }

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(intervalId);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [user?.role, loadItems]);

    const markSeparado = async (item: SaleItem) => {
        setProcessingId(item.id);
        try {
            const { error } = await supabase
                .from('sale_items')
                .update({ dispatch_status: 'SEPARADO' })
                .eq('id', item.id);

            if (error) throw error;
            setItems(prev => prev.filter(i => i.id !== item.id));
            showToast(`✅ ${item.products?.name || 'Item'} marcado como separado!`);
        } catch (err) {
            showToast('Erro ao atualizar item.', 'error');
        } finally {
            setProcessingId(null);
        }
    };

    const markIndisponivel = async (item: SaleItem) => {
        setProcessingId(item.id);
        try {
            // Marcar item como indisponível
            const { error: updateError } = await supabase
                .from('sale_items')
                .update({ dispatch_status: 'INDISPONIVEL' })
                .eq('id', item.id);

            if (updateError) throw updateError;

            // Criar tarefa para o supervisor
            const storeId = item.sales?.store_id || '';
            const { error: taskError } = await supabase
                .from('tasks')
                .insert({
                    title: `Item Indisponível: ${item.products?.name || 'Produto'}`,
                    description: `Item não encontrado no estoque durante expedição.\n\nVenda: ${item.sale_id}\nCliente: ${item.sales?.customer_name || 'N/D'}\nProduto: ${item.products?.name || item.product_id}\nSKU: ${item.products?.sku || ''}\nQuantidade: ${item.quantity}`,
                    type: 'ESTOQUE',
                    status: 'ABERTA',
                    priority: 'ALTA',
                    created_by: user?.name || 'Conferente',
                    assigned_to: 'SUPERVISOR',
                    store_id: storeId,
                    sale_id: item.sale_id,
                    sale_item_id: item.id,
                    product_id: item.product_id,
                    product_name: item.products?.name || '',
                });

            if (taskError) throw taskError;

            setItems(prev => prev.filter(i => i.id !== item.id));
            showToast(`⚠️ Tarefa criada para o supervisor!`);
        } catch (err) {
            console.error(err);
            showToast('Erro ao criar tarefa.', 'error');
        } finally {
            setProcessingId(null);
        }
    };

    // Agrupar itens por Unidade (CD/Loja)
    const unitsMap = new Map<string, SaleItem[]>();
    items.forEach(item => {
        const key = item.location_id || 'Indefinido';
        if (!unitsMap.has(key)) unitsMap.set(key, []);
        unitsMap.get(key)!.push(item);
    });

    // Filtrar e preparar dados para renderização
    const filteredUnits = Array.from(unitsMap.entries()).map(([unitId, unitItems]) => {
        const filteredItems = unitItems.filter(item => {
            if (!search) return true;
            const s = search.toLowerCase();
            return (
                item.sales?.customer_name?.toLowerCase().includes(s) ||
                item.sale_id.toLowerCase().includes(s) ||
                item.products?.name?.toLowerCase().includes(s) ||
                item.products?.sku?.toLowerCase().includes(s)
            );
        });
        return { unitId, items: filteredItems };
    }).filter(u => u.items.length > 0);

    return (
        <div className="space-y-6 relative">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-6 right-6 z-50 px-6 py-3 rounded-2xl text-white font-bold shadow-2xl transition-all animate-bounce text-sm ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-900">📦 Expedição</h1>
                    <p className="text-slate-500 text-sm mt-0.5">Separação de itens para entrega — CD Norte</p>
                </div>
                <button
                    onClick={() => { loadItems(); loadDevolutions(); }}
                    disabled={loading}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Atualizar
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 p-1.5 bg-slate-200/50 rounded-2xl">
                <button onClick={() => setActiveTab('SEPARACAO')} className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTab === 'SEPARACAO' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>📦 Separação ({stats.pendente} pendentes)</button>
                <button onClick={() => setActiveTab('DEVOLUCOES')} className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTab === 'DEVOLUCOES' ? 'bg-white text-red-700 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>↩️ Devoluções ({devolutionItems.length})</button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
                    <p className="text-2xl font-black text-amber-700">{stats.pendente}</p>
                    <p className="text-xs font-bold text-amber-600 uppercase tracking-wide mt-1">Pendentes</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
                    <p className="text-2xl font-black text-emerald-700">{stats.separado}</p>
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide mt-1">Separados</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
                    <p className="text-2xl font-black text-red-700">{stats.indisponivel}</p>
                    <p className="text-xs font-bold text-red-600 uppercase tracking-wide mt-1">Indisponíveis</p>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                    type="text"
                    placeholder="Buscar por cliente, produto ou número da venda..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            {/* Lista existente de separação OU listagem de devoluções */}
            {activeTab === 'SEPARACAO' ? (
                loading ? (
                    <div className="flex items-center justify-center p-20">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
                    </div>
                ) : filteredUnits.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-3xl border border-slate-100">
                        <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
                        <h3 className="text-xl font-black text-slate-900">Tudo separado!</h3>
                        <p className="text-slate-500 mt-2">Não há itens pendentes de separação no momento.</p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {filteredUnits.map(({ unitId, items: unitItems }) => {
                            const unitName = stores.find(s => s.id === unitId)?.name || 'CD Indefinido';
                            return (
                                <div key={unitId} className="space-y-4">
                                    <div className="flex items-center gap-3 px-1">
                                        <div className="h-px bg-slate-200 flex-1" />
                                        <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">{unitName} ({unitItems.length})</h2>
                                        <div className="h-px bg-slate-200 flex-1" />
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                                        {unitItems.map(item => {
                                            const imgUrl = getImageUrl(item.products?.image_url);
                                            const isProcessing = processingId === item.id;
                                            return (
                                                <div key={item.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 flex flex-col gap-4 hover:shadow-md transition-shadow relative overflow-hidden group">
                                                    {/* Background icon decoration */}
                                                    <Package className="absolute -right-4 -bottom-4 w-24 h-24 text-slate-50 opacity-[0.03] group-hover:scale-110 transition-transform" />

                                                    <div className="flex gap-4">
                                                        <div className="w-16 h-16 rounded-2xl bg-slate-50 overflow-hidden shrink-0 flex items-center justify-center border border-slate-100">
                                                            {imgUrl ? (
                                                                <img src={imgUrl} alt={item.products?.name} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <Package className="w-7 h-7 text-slate-300" />
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex justify-between items-start gap-2">
                                                                <p className="text-[10px] font-black text-blue-600 uppercase tracking-wider">{item.sale_id}</p>
                                                                <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold">
                                                                    {new Date(item.sales?.created_at || '').toLocaleDateString('pt-BR')}
                                                                </span>
                                                            </div>
                                                            <h3 className="font-black text-slate-900 text-sm leading-tight mt-1 truncate">{item.products?.name}</h3>
                                                            <p className="font-bold text-slate-500 text-xs mt-1 truncate">👤 {item.sales?.customer_name}</p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-between text-xs pt-3 border-t border-slate-50">
                                                        <div className="flex items-center gap-2">
                                                            <span className="bg-amber-50 text-amber-700 font-black px-3 py-1.5 rounded-xl border border-amber-100 text-base">
                                                                {item.quantity}x
                                                            </span>
                                                            <div>
                                                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">Quantidade</p>
                                                                <p className="text-[10px] text-slate-500 font-medium">SKU: {item.products?.sku || '-'}</p>
                                                            </div>
                                                        </div>

                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => markIndisponivel(item)}
                                                                disabled={isProcessing}
                                                                title="Indisponível"
                                                                className="w-10 h-10 flex items-center justify-center bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"
                                                            >
                                                                <XCircle className="w-5 h-5" />
                                                            </button>
                                                            <button
                                                                onClick={() => markSeparado(item)}
                                                                disabled={isProcessing}
                                                                className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-2xl text-xs font-black hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                                                            >
                                                                {isProcessing ? <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                                                SEPARADO
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )
            ) : (
                /* DEVOLUÇÕES TAB */
                devolutionItems.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-3xl border border-slate-100">
                        <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
                        <h3 className="text-xl font-black text-slate-900">Sem devoluções pendentes</h3>
                        <p className="text-slate-500 mt-2">Nenhum item para retornar ao armazém.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {devolutionItems.map((item: any) => (
                            <div key={item.id} className="bg-white border-2 border-orange-200 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
                                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center shrink-0">
                                    <Package className="w-5 h-5 text-orange-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-black text-slate-800 text-sm truncate">{item.products?.name || item.product_id}</p>
                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                        <span className="text-xs text-slate-500">Venda: {item.sale_id}</span>
                                        <span className="text-xs text-slate-500">· Cliente: {item.sales?.customer_name || 'N/D'}</span>
                                        <span className="text-xs font-bold text-orange-700">Qtd a devolver: {item.quantity}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setDevReturnModal({ itemId: item.id, productName: item.products?.name || item.product_id, qty: item.quantity, locationId: stores[0]?.id || '' })}
                                    className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-xs font-black shrink-0"
                                >
                                    ↩️ Confirmar Devolução
                                </button>
                            </div>
                        ))}
                    </div>
                )
            )}

            {/* Modal de confirmar devolução ao CD */}
            {devReturnModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
                        <div className="px-6 py-4 bg-orange-50 border-b border-orange-100 flex justify-between items-center">
                            <div>
                                <h2 className="text-base font-black text-orange-800 uppercase">↩️ Devolver ao Armazém</h2>
                                <p className="text-[10px] text-orange-600">{devReturnModal.productName} · Qtd: {devReturnModal.qty}</p>
                            </div>
                            <button onClick={() => setDevReturnModal(null)} className="p-2 hover:bg-orange-100 rounded-full"><XCircle className="w-4 h-4 text-orange-400" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase mb-2">Devolver para o CD / Loja</label>
                                <select
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-sm"
                                    value={devReturnModal.locationId}
                                    onChange={e => setDevReturnModal({ ...devReturnModal, locationId: e.target.value })}
                                >
                                    <option value="">Selecione o CD destino</option>
                                    {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setDevReturnModal(null)} className="flex-1 py-3 text-slate-500 font-bold uppercase text-xs border border-slate-200 rounded-2xl hover:bg-slate-50">Cancelar</button>
                                <button
                                    disabled={!devReturnModal.locationId}
                                    onClick={async () => {
                                        if (!devReturnModal.locationId) return;
                                        try {
                                            const { supabaseService } = await import('../services/supabaseService.ts');
                                            await supabaseService.confirmExpeditionReturn(devReturnModal.itemId, devReturnModal.locationId);
                                            setDevolutionItems(prev => prev.filter((i: any) => i.id !== devReturnModal.itemId));
                                            setDevReturnModal(null);
                                            showToast('✅ Devolução confirmada! Estoque atualizado.');
                                        } catch { showToast('Erro ao confirmar devolução.', 'error'); }
                                    }}
                                    className="flex-1 py-3 bg-orange-600 text-white rounded-2xl font-black uppercase text-xs hover:bg-orange-700 disabled:opacity-50"
                                >
                                    Confirmar Devolução
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Expedicao;

