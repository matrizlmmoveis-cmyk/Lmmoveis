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
    const [expandedSale, setExpandedSale] = useState<string | null>(null);
    const [stats, setStats] = useState({ pendente: 0, separado: 0, indisponivel: 0 });
    const [filterStore, setFilterStore] = useState('CD Norte');
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

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
          id, sale_id, product_id, quantity, price, dispatch_status,
          sales!inner(id, customer_name, store_id, created_at),
          products(name, sku, image_url)
        `)
                .eq('dispatch_status', 'PENDENTE')
                .order('sale_id');

            if (error) throw error;

            // Filtrar por loja (CD Norte) se necessário
            const filtered = (data || []).filter((item: any) => {
                if (filterStore === 'Todos') return true;
                const storeName = item.sales?.store_id
                    ? stores.find(s => s.id === item.sales?.store_id)?.name || ''
                    : '';
                return storeName.toLowerCase().includes('norte') || storeName.toLowerCase().includes('cd norte')
                    || item.sales?.store_id === filterStore;
            });

            setItems(filtered as unknown as SaleItem[]);

            // Stats totais
            const { data: statsData } = await supabase
                .from('sale_items')
                .select('dispatch_status');

            const counts = { pendente: 0, separado: 0, indisponivel: 0 };
            (statsData || []).forEach((r: any) => {
                if (r.dispatch_status === 'PENDENTE') counts.pendente++;
                else if (r.dispatch_status === 'SEPARADO') counts.separado++;
                else if (r.dispatch_status === 'INDISPONIVEL') counts.indisponivel++;
            });
            setStats(counts);
        } catch (err) {
            console.error('Erro ao carregar expedição:', err);
        } finally {
            if (!silent) setLoading(false);
        }
    }, [stores, filterStore]);

    useEffect(() => {
        loadItems();
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

    // Agrupar por venda
    const salesMap = new Map<string, SaleItem[]>();
    items.forEach(item => {
        const key = item.sale_id;
        if (!salesMap.has(key)) salesMap.set(key, []);
        salesMap.get(key)!.push(item);
    });

    const filteredSales = Array.from(salesMap.entries()).filter(([saleId, saleItems]) => {
        if (!search) return true;
        const s = search.toLowerCase();
        const sale = saleItems[0].sales;
        return (
            sale?.customer_name?.toLowerCase().includes(s) ||
            saleId.toLowerCase().includes(s) ||
            saleItems.some(i => i.products?.name?.toLowerCase().includes(s))
        );
    });

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
                    onClick={loadItems}
                    disabled={loading}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Atualizar
                </button>
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

            {/* Lista de vendas */}
            {loading ? (
                <div className="flex items-center justify-center p-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
                </div>
            ) : filteredSales.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl border border-slate-100">
                    <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
                    <h3 className="text-xl font-black text-slate-900">Tudo separado!</h3>
                    <p className="text-slate-500 mt-2">Não há itens pendentes de separação no momento.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredSales.map(([saleId, saleItems]) => {
                        const sale = saleItems[0].sales;
                        const isExpanded = expandedSale === saleId;
                        const quoteNum = saleId;
                        const totalItems = saleItems.reduce((a, b) => a + b.quantity, 0);

                        return (
                            <div key={saleId} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                                {/* Sale header */}
                                <button
                                    onClick={() => setExpandedSale(isExpanded ? null : saleId)}
                                    className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors text-left"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                                            <Package className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="font-black text-slate-900 text-sm">{sale?.customer_name || 'Cliente'}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-xs text-slate-500 font-medium">{quoteNum}</span>
                                                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">{saleItems.length} {saleItems.length === 1 ? 'item' : 'itens'} pendentes</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-1 text-slate-400 text-xs">
                                            <Clock className="w-3 h-3" />
                                            {new Date(sale?.created_at || '').toLocaleDateString('pt-BR')}
                                        </div>
                                        {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                                    </div>
                                </button>

                                {/* Items accordion */}
                                {isExpanded && (
                                    <div className="border-t border-slate-100 divide-y divide-slate-50">
                                        {saleItems.map(item => {
                                            const imgUrl = getImageUrl(item.products?.image_url);
                                            const isProcessing = processingId === item.id;
                                            return (
                                                <div key={item.id} className="flex items-center gap-4 p-4">
                                                    {/* Imagem */}
                                                    <div className="w-14 h-14 rounded-xl bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                                                        {imgUrl ? (
                                                            <img src={imgUrl} alt={item.products?.name} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                                        ) : (
                                                            <Package className="w-6 h-6 text-slate-400" />
                                                        )}
                                                    </div>

                                                    {/* Info */}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-slate-900 text-sm truncate">{item.products?.name || item.product_id}</p>
                                                        <p className="text-xs text-slate-400 mt-0.5">SKU: {item.products?.sku || '—'} · Qtd: <span className="font-bold text-slate-700">{item.quantity}</span></p>
                                                    </div>

                                                    {/* Ações */}
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <button
                                                            onClick={() => markSeparado(item)}
                                                            disabled={isProcessing}
                                                            className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-black transition-all active:scale-95 disabled:opacity-50 shadow-md shadow-emerald-500/20"
                                                        >
                                                            {isProcessing ? <div className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                                                            Separado
                                                        </button>
                                                        <button
                                                            onClick={() => markIndisponivel(item)}
                                                            disabled={isProcessing}
                                                            className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-black transition-all active:scale-95 disabled:opacity-50 shadow-md shadow-red-500/20"
                                                        >
                                                            {isProcessing ? <div className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                                                            Não Disponível
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default Expedicao;
