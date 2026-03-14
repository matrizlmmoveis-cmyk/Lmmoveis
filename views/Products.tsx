import React, { useState, useMemo } from 'react';
import { Product, Store, InventoryItem, Employee, ProductImage, Supplier } from '../types.ts';
import { Search, Box, Filter, ChevronDown, X, Edit2, Loader2, Save, MapPin, Package, DollarSign, RefreshCw } from 'lucide-react';
import { supabaseService } from '../services/supabaseService.ts';
import ProductModal from '../components/ProductModal.tsx';
import { CATEGORIES } from '../constants.tsx';

interface ProductsProps {
    user: Employee | any;
    products: Product[];
    inventory: InventoryItem[];
    stores: Store[];
    employees: Employee[];
    suppliers: Supplier[];
    refreshData: (force?: boolean) => Promise<void>;
}

const FALLBACK_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%23f1f5f9'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='60' fill='%23cbd5e1'%3E📦%3C/text%3E%3C/svg%3E";
const INITIAL_PAGE_SIZE = 50;

const Products: React.FC<ProductsProps> = ({ user, products, inventory, stores, employees, suppliers, refreshData }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [displayCount, setDisplayCount] = useState(INITIAL_PAGE_SIZE);

    // Modal State
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [isCreationMode, setIsCreationMode] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);

    const canEdit = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR' || user?.name === 'Lucas' || user?.username === 'Master';

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

    const openProductModal = (product: Product) => {
        setSelectedProduct(product);
        setIsEditMode(false);
        setIsCreationMode(false);
    };

    const handleNewProduct = async () => {
        setIsSaving(true);
        try {
            const nextId = await supabaseService.getNextProductId();
            const newProduct: Product = {
                id: nextId,
                name: '',
                category: categories[0] || CATEGORIES[0] || 'Geral',
                price: 0,
                costPrice: 0,
                assemblyPrice: 0,
                sku: nextId,
                active: true,
                images: []
            };
            setSelectedProduct(newProduct);
            setIsEditMode(true);
            setIsCreationMode(true);
        } catch (err) {
            console.error('Erro ao preparar novo produto:', err);
        } finally {
            setIsSaving(false);
        }
    };


    const handleToggleActiveList = async (e: React.MouseEvent, product: Product) => {
        e.stopPropagation();
        if (!canEdit) return;
        try {
            const newActiveState = product.active === false ? true : false;
            await supabaseService.updateProduct(product.id, { active: newActiveState });
            await refreshData(true);
        } catch (err: any) {
            console.error('Erro ao alterar status do produto:', err);
            alert(`Erro ao alterar status: ${err.message || 'Erro desconhecido'}`);
        }
    };


    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Consulta de Produtos</h1>
                    <p className="text-slate-500 text-sm">Catálogo otimizado ({filteredProducts.length} itens)</p>
                </div>
                {canEdit && (
                    <button
                        onClick={handleNewProduct}
                        className="flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-sm font-black uppercase tracking-widest transition-all shadow-xl shadow-slate-200"
                    >
                        <Box className="w-4 h-4" />
                        Novo Produto
                    </button>
                )}
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
                                <tr
                                    key={product.id}
                                    className="hover:bg-blue-50/50 transition-colors group cursor-pointer"
                                    onClick={() => openProductModal(product)}
                                >
                                    <td className="px-6 py-3">
                                        <div
                                            className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 cursor-zoom-in"
                                            onClick={(e) => {
                                                e.stopPropagation(); // Evita abrir o modal do produto
                                                const imgUrl = product.images?.[0]?.url || product.imageUrl || FALLBACK_IMG;
                                                setFullScreenImage(imgUrl);
                                            }}
                                        >
                                            <img
                                                src={product.images?.[0]?.url || product.imageUrl || FALLBACK_IMG}
                                                loading="lazy"
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                                alt=""
                                                onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMG; }}
                                            />
                                        </div>
                                    </td>
                                    <td className="px-6 py-3">
                                        <div className="flex items-start gap-3">
                                            {canEdit && (
                                                <button
                                                    onClick={(e) => handleToggleActiveList(e, product)}
                                                    className={`mt-0.5 w-8 h-4 rounded-full flex items-center transition-colors shrink-0 px-0.5 ${product.active !== false ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                                    title={product.active !== false ? 'Desativar Produto' : 'Ativar Produto'}
                                                >
                                                    <div className={`w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform ${product.active !== false ? 'translate-x-4' : 'translate-x-0'}`} />
                                                </button>
                                            )}
                                            <div className="min-w-0">
                                                <p className="font-bold text-slate-900 text-sm uppercase leading-tight truncate">{product.name || 'S/N'}</p>
                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                                                    {product.active === false && (
                                                        <span className="text-[9px] font-black text-red-600 bg-red-50 border border-red-100 px-1 py-0.5 rounded uppercase shrink-0">INATIVO</span>
                                                    )}
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
                                            </div>
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

            {/* PRODUCT DETAIL / EDIT MODAL */}
            <ProductModal
                isOpen={!!selectedProduct}
                onClose={() => setSelectedProduct(null)}
                product={selectedProduct}
                isEditMode={isEditMode}
                setIsEditMode={setIsEditMode}
                isCreationMode={isCreationMode}
                user={user}
                stores={stores}
                suppliers={suppliers}
                inventory={inventory}
                refreshData={refreshData}
                onOpenImage={(url) => setFullScreenImage(url)}
            />

            {/* FULL SCREEN IMAGE LIGHTBOX */}
            {fullScreenImage && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setFullScreenImage(null)}
                >
                    <button
                        className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white"
                        onClick={(e) => { e.stopPropagation(); setFullScreenImage(null); }}
                    >
                        <X className="w-6 h-6" />
                    </button>
                    <img
                        src={fullScreenImage}
                        alt="Imagem em tela cheia"
                        className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()} // Impede fechar ao clicar na imagem
                    />
                </div>
            )}
        </div>
    );
};

export default Products;
