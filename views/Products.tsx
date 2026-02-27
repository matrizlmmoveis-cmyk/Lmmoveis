import React, { useState, useMemo } from 'react';
import { Product, Store, InventoryItem, Employee } from '../types.ts';
import { Search, Box, Filter, ChevronDown } from 'lucide-react';

interface ProductsProps {
    user: Employee | any;
    products: Product[];
    inventory: InventoryItem[];
    stores: Store[];
    employees: Employee[];
}

const FALLBACK_IMG = 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?q=80&w=500&auto=format&fit=crop';
const INITIAL_PAGE_SIZE = 50;

const Products: React.FC<ProductsProps> = ({ user, products, inventory, stores, employees }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [displayCount, setDisplayCount] = useState(INITIAL_PAGE_SIZE);

    // Otimização: Indexar inventário por ProdutoID e StoreID para busca O(1)
    const stockMap = useMemo(() => {
        const map: Record<string, Record<string, number>> = {};
        (inventory || []).forEach(item => {
            if (!map[item.productId]) map[item.productId] = {};
            map[item.productId][item.locationId] = item.quantity || 0;
        });
        return map;
    }, [inventory]);

    // Otimização: Calcular categorias únicas uma única vez
    const categories = useMemo(() =>
        Array.from(new Set((products || []).map(p => p.category || 'Sem Categoria'))).sort()
        , [products]);

    // Otimização: Filtragem memorizada
    const filteredProducts = useMemo(() => {
        return (products || []).filter(p => {
            const matchesSearch = !searchTerm ||
                (p.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                (p.sku?.toLowerCase() || '').includes(searchTerm.toLowerCase());
            const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
            return matchesSearch && matchesCategory;
        });
    }, [products, searchTerm, categoryFilter]);

    const getStockForStore = (productId: string, storeId: string) => {
        return stockMap[productId]?.[storeId] || 0;
    };

    const getTotalStock = (productId: string) => {
        const productStocks = stockMap[productId];
        if (!productStocks) return 0;
        return Object.values(productStocks).reduce((acc: number, curr: number) => acc + curr, 0);
    };

    const visibleProducts = filteredProducts.slice(0, displayCount);

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Consulta de Produtos</h1>
                    <p className="text-slate-500 text-sm">Catálogo otimizado ({filteredProducts.length} itens)</p>
                </div>
            </header>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por nome ou SKU..."
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 rounded-xl text-sm transition-all outline-none"
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setDisplayCount(INITIAL_PAGE_SIZE);
                            }}
                        />
                    </div>
                    <div className="flex gap-2">
                        <div className="relative">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <select
                                className="pl-10 pr-8 py-2 bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 rounded-xl text-sm transition-all outline-none appearance-none font-bold text-slate-600 uppercase"
                                value={categoryFilter}
                                onChange={(e) => {
                                    setCategoryFilter(e.target.value);
                                    setDisplayCount(INITIAL_PAGE_SIZE);
                                }}
                            >
                                <option value="all">TODAS AS CATEGORIAS</option>
                                {(categories as string[]).map(cat => (
                                    <option key={cat} value={cat}>{cat.toUpperCase()}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse table-fixed">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-20">Foto</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-auto">Produto / Saldos</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-24 text-center">Total</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-32 text-right">Preço</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-28 text-right">Montagem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {visibleProducts.map((product) => (
                                <tr key={product.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-6 py-3">
                                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                                            <img
                                                src={product.images?.[0]?.url || product.imageUrl || FALLBACK_IMG}
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                                alt=""
                                                onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMG; }}
                                            />
                                        </div>
                                    </td>
                                    <td className="px-6 py-3">
                                        <p className="font-bold text-slate-900 text-sm uppercase leading-tight truncate">{product.name || 'S/N'}</p>
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                                            <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-1 py-0.5 rounded uppercase shrink-0">SKU: {product.sku || 'N/A'}</span>

                                            {/* Saldos por Loja como texto compacto */}
                                            {(stores || []).map(store => {
                                                const stock = getStockForStore(product.id, store.id);
                                                if (stock === 0) return null;
                                                return (
                                                    <span key={store.id} className="text-[9px] font-bold text-slate-500 uppercase whitespace-nowrap">
                                                        {store.name}: <span className="text-slate-900 font-black">{stock}un</span>
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </td>
                                    <td className="px-6 py-3 text-center">
                                        <div className={`inline-flex px-2 py-1 rounded-lg border font-black text-xs ${(getTotalStock(product.id) as number) > 0 ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-red-50 border-red-100 text-red-600'}`}>
                                            {getTotalStock(product.id)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-3 text-right">
                                        <p className="text-sm font-black text-slate-900">R$ {(product.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                    </td>
                                    <td className="px-6 py-3 text-right">
                                        <p className="text-xs font-bold text-emerald-600">R$ {(product.assemblyPrice || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {displayCount < filteredProducts.length && (
                    <div className="p-6 text-center bg-slate-50/50 border-t border-slate-100">
                        <button
                            onClick={() => setDisplayCount(prev => prev + 100)}
                            className="bg-white border border-slate-200 text-slate-600 px-6 py-2.5 rounded-xl text-xs font-black uppercase shadow-sm hover:bg-slate-50 transition-all inline-flex items-center gap-2"
                        >
                            Ver mais produtos <ChevronDown className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {filteredProducts.length === 0 && (
                    <div className="px-6 py-12 text-center text-slate-400 font-bold uppercase text-sm">Nenhum produto encontrado</div>
                )}
            </div>
        </div>
    );
};

export default Products;
