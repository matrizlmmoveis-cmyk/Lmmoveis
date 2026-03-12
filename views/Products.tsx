import React, { useState, useMemo } from 'react';
import { Product, Store, InventoryItem, Employee, ProductImage, Supplier } from '../types.ts';
import { Search, Box, Filter, ChevronDown, X, Edit2, Loader2, Save, MapPin, Package, DollarSign, RefreshCw } from 'lucide-react';
import { supabaseService } from '../services/supabaseService.ts';
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
    const [editForm, setEditForm] = useState<Partial<Product>>({});
    const [movements, setMovements] = useState<any[]>([]);
    const [isLoadingMovements, setIsLoadingMovements] = useState(false);
    const [activeTab, setActiveTab] = useState<'details' | 'history'>('details');
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
        setEditForm({ ...product });
        setIsEditMode(false);
        setIsCreationMode(false);
        setActiveTab('details');
        loadMovements(product.id);
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
            setEditForm(newProduct);
            setIsEditMode(true);
            setIsCreationMode(true);
            setActiveTab('details');
            setMovements([]);
        } catch (err) {
            console.error('Erro ao preparar novo produto:', err);
        } finally {
            setIsSaving(false);
        }
    };

    const loadMovements = async (productId: string) => {
        setIsLoadingMovements(true);
        try {
            const data = await supabaseService.getProductMovements(productId);
            setMovements(data);
        } catch (err) {
            console.error('Erro ao carregar movimentos:', err);
        } finally {
            setIsLoadingMovements(false);
        }
    };

    const handleSave = async () => {
        if (!selectedProduct || !editForm.name || !editForm.sku) {
            alert('Nome e SKU são obrigatórios!');
            return;
        }
        setIsSaving(true);
        try {
            if (isCreationMode) {
                await supabaseService.createProduct(editForm as Product);
                alert('Produto criado com sucesso!');
            } else {
                await supabaseService.updateProduct(selectedProduct.id, editForm);
                alert('Produto atualizado com sucesso!');
            }
            await refreshData(true);
            setSelectedProduct(null);
            setIsEditMode(false);
            setIsCreationMode(false);
        } catch (err: any) {
            console.error('Erro ao salvar produto:', err);
            const msg = err.message || err.details || 'Erro desconhecido';
            alert(`Erro ao salvar produto: ${msg}`);
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

    const formatCurrencyBRL = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(value);
    };

    const handleCurrencyChange = (e: React.ChangeEvent<HTMLInputElement>, callback: (num: number) => void) => {
        const value = e.target.value.replace(/\D/g, '');
        const numberValue = value ? parseInt(value) / 100 : 0;
        callback(numberValue);
    };

    const getSupplierName = (id?: string) => {
        if (!id) return 'Não Definido';
        const s = suppliers.find(sup => sup.id === id);
        return s ? s.name : 'Não Definido';
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
            {selectedProduct && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100">
                                    <Package className="w-6 h-6 text-blue-600" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tight leading-none">
                                        {isCreationMode ? 'Novo Produto' : (isEditMode ? 'Editar Produto' : 'Detalhes do Produto')}
                                    </h2>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">
                                        {isCreationMode ? 'Cadastro Inicial' : `SKU: ${selectedProduct.sku}`}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedProduct(null)}
                                className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                            >
                                <X className="w-6 h-6 text-slate-400" />
                            </button>
                        </div>

                        <div className="overflow-y-auto p-8 space-y-8 flex-1">
                            {/* Main Info Section */}
                            <div className="flex flex-col md:flex-row gap-8">
                                <div className="w-full md:w-48 space-y-2 shrink-0">
                                    <div
                                        className="w-32 h-32 rounded-3xl bg-slate-50 border-2 border-slate-100 flex items-center justify-center overflow-hidden cursor-zoom-in relative group"
                                        onClick={() => {
                                            const imgUrl = selectedProduct.images?.[0]?.url || selectedProduct.imageUrl || FALLBACK_IMG;
                                            setFullScreenImage(imgUrl);
                                        }}
                                    >
                                        <img src={selectedProduct.images?.[0]?.url || selectedProduct.imageUrl || FALLBACK_IMG} alt="" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-slate-900/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Search className="w-6 h-6 text-white" />
                                        </div>
                                    </div>
                                    {(selectedProduct.imageUrl2 || (selectedProduct.images?.length ?? 0) > 1) && (
                                        <div className="aspect-square bg-slate-100 rounded-3xl overflow-hidden border border-slate-200 shadow-inner">
                                            <img
                                                src={selectedProduct.imageUrl2 || selectedProduct.images?.[1]?.url || FALLBACK_IMG}
                                                className="w-full h-full object-cover"
                                                alt=""
                                                onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMG; }}
                                            />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 space-y-4">
                                    {isEditMode ? (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Nome do Produto</label>
                                                <input
                                                    type="text"
                                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold uppercase text-sm focus:border-blue-500 outline-none transition-all"
                                                    value={editForm.name}
                                                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">SKU</label>
                                                    <input
                                                        type="text"
                                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:border-blue-500 outline-none transition-all"
                                                        value={editForm.sku}
                                                        onChange={e => setEditForm({ ...editForm, sku: e.target.value })}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Categoria</label>
                                                    <select
                                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-black uppercase text-sm focus:border-blue-500 outline-none transition-all"
                                                        value={editForm.category}
                                                        onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                                                    >
                                                        {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Link Imagem 1</label>
                                                    <input
                                                        type="text"
                                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs focus:border-blue-500 outline-none transition-all"
                                                        value={editForm.imageUrl || ''}
                                                        onChange={e => setEditForm({ ...editForm, imageUrl: e.target.value })}
                                                        placeholder="URL da Imagem..."
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Link Imagem 2</label>
                                                    <input
                                                        type="text"
                                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs focus:border-blue-500 outline-none transition-all"
                                                        value={editForm.imageUrl2 || ''}
                                                        onChange={e => setEditForm({ ...editForm, imageUrl2: e.target.value })}
                                                        placeholder="URL da Imagem..."
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Fornecedor</label>
                                                <select
                                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:border-blue-500 outline-none transition-all"
                                                    value={editForm.supplierId || ''}
                                                    onChange={e => setEditForm({ ...editForm, supplierId: e.target.value })}
                                                >
                                                    <option value="">Selecione um fornecedor...</option>
                                                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="pt-2">
                                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Descrição</label>
                                                <textarea
                                                    rows={3}
                                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-sm focus:border-blue-500 outline-none transition-all uppercase"
                                                    value={editForm.description || ''}
                                                    onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                                                    placeholder="Descrição do produto..."
                                                />
                                            </div>
                                            {(user?.role === 'SUPERVISOR' || user?.role === 'ADMIN' || user?.username === 'Master') && (
                                                <div className="pt-2 flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                                                    <div>
                                                        <p className="text-xs font-black text-slate-900 uppercase">Produto Ativo</p>
                                                        <p className="text-[10px] font-medium text-slate-500">Exibir produto para vendas</p>
                                                    </div>
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input type="checkbox" className="sr-only peer" checked={editForm.active !== false} onChange={e => setEditForm(prev => ({ ...prev, active: e.target.checked }))} />
                                                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                                    </label>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <h3 className="text-2xl font-black text-slate-900 uppercase leading-tight italic">{selectedProduct.name}</h3>
                                                <div className="flex flex-wrap gap-2">
                                                    {selectedProduct.active === false && (
                                                        <div className="inline-flex px-3 py-1 bg-red-50 text-red-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-red-100">
                                                            INATIVO
                                                        </div>
                                                    )}
                                                    <div className="inline-flex px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-100">
                                                        {selectedProduct.category}
                                                    </div>
                                                    <div className="inline-flex px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-200">
                                                        Fornecedor: {getSupplierName(selectedProduct.supplierId)}
                                                    </div>
                                                </div>
                                            </div>
                                            {selectedProduct.description && (
                                                <div className="pt-2">
                                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                        <Filter className="w-3 h-3" /> Descrição do Produto
                                                    </h3>
                                                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-600 text-sm font-medium leading-relaxed uppercase">
                                                        {selectedProduct.description}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Prices Section */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="p-5 bg-blue-50/50 border border-blue-100 rounded-[2rem] space-y-1">
                                    <div className="flex items-center gap-2 text-[10px] font-black text-blue-400 uppercase tracking-widest">
                                        <DollarSign className="w-3 h-3" /> Preço Venda
                                    </div>
                                    {isEditMode ? (
                                        <input
                                            type="text"
                                            className="w-full bg-transparent text-xl font-black text-blue-700 outline-none"
                                            value={formatCurrencyBRL(editForm.price || 0)}
                                            onChange={e => handleCurrencyChange(e, (num) => setEditForm({ ...editForm, price: num }))}
                                        />
                                    ) : (
                                        <p className="text-2xl font-black text-blue-700 italic">{formatCurrencyBRL(selectedProduct.price || 0)}</p>
                                    )}
                                </div>
                                <div className="p-5 bg-emerald-50/50 border border-emerald-100 rounded-[2rem] space-y-1">
                                    <div className="flex items-center gap-2 text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                                        <Edit2 className="w-3 h-3" /> Montagem
                                    </div>
                                    {isEditMode ? (
                                        <input
                                            type="text"
                                            className="w-full bg-transparent text-xl font-black text-emerald-700 outline-none"
                                            value={formatCurrencyBRL(editForm.assemblyPrice || 0)}
                                            onChange={e => handleCurrencyChange(e, (num) => setEditForm({ ...editForm, assemblyPrice: num }))}
                                        />
                                    ) : (
                                        <p className="text-2xl font-black text-emerald-700 italic">{formatCurrencyBRL(selectedProduct.assemblyPrice || 0)}</p>
                                    )}
                                </div>
                                <div className="p-5 bg-red-50/50 border border-red-100 rounded-[2rem] space-y-1">
                                    <div className="flex items-center gap-2 text-[10px] font-black text-red-400 uppercase tracking-widest">
                                        <DollarSign className="w-3 h-3" /> Custo
                                    </div>
                                    {isEditMode ? (
                                        <input
                                            type="text"
                                            className="w-full bg-transparent text-xl font-black text-red-700 outline-none"
                                            value={formatCurrencyBRL(editForm.costPrice || 0)}
                                            onChange={e => handleCurrencyChange(e, (num) => setEditForm({ ...editForm, costPrice: num }))}
                                        />
                                    ) : (
                                        <p className="text-2xl font-black text-red-700 italic">
                                            {(user?.role === 'ADMIN' || user?.username === 'Master') ? formatCurrencyBRL(selectedProduct.costPrice || 0) : '*****'}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Tabs */}
                            <div className="flex border-b border-slate-100">
                                <button
                                    onClick={() => setActiveTab('details')}
                                    className={`px-6 py-3 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'details' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                                >
                                    Informações
                                </button>
                                <button
                                    onClick={() => setActiveTab('history')}
                                    className={`px-6 py-3 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'history' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                                >
                                    Histórico de Movimentação
                                </button>
                            </div>

                            {activeTab === 'details' ? (
                                <>
                                    {/* Stock Detail */}
                                    <div className="space-y-4">
                                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-1">
                                            <MapPin className="w-4 h-4" /> Distribuição de Estoque
                                        </h3>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            {stores.map(store => {
                                                const stock = getStockForStore(selectedProduct.id, store.id);
                                                return (
                                                    <div key={store.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col items-center text-center">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase truncate w-full">{store.name}</span>
                                                        <span className={`text-lg font-black mt-1 ${stock > 0 ? 'text-slate-900' : 'text-slate-300'}`}>{stock} UN</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="space-y-4">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-1">
                                        <RefreshCw className="w-4 h-4" /> Histórico Recente
                                    </h3>

                                    {isLoadingMovements ? (
                                        <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
                                    ) : movements.length === 0 ? (
                                        <div className="p-10 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200 text-slate-400 font-bold uppercase text-xs">
                                            Nenhuma movimentação registrada
                                        </div>
                                    ) : (
                                        <div className="overflow-hidden border border-slate-100 rounded-2xl">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-slate-50">
                                                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase">Data</th>
                                                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase">Tipo</th>
                                                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase">Qtd</th>
                                                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase">Local</th>
                                                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase">Motivo/Ref</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 bg-white">
                                                    {movements.map((mov) => (
                                                        <tr key={mov.id} className="text-xs">
                                                            <td className="px-4 py-3 text-slate-500 font-medium">
                                                                {new Date(mov.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <span className={`font-black px-2 py-0.5 rounded-full text-[9px] uppercase ${mov.type === 'ENTRADA' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                                    {mov.type}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 font-black text-slate-900">{mov.quantity}</td>
                                                            <td className="px-4 py-3 text-slate-600 font-bold">{stores.find(s => s.id === mov.locationId)?.name || mov.locationId}</td>
                                                            <td className="px-4 py-3">
                                                                <p className="font-black text-slate-700 uppercase">{mov.reason}</p>
                                                                {mov.referenceId && <p className="text-[9px] text-slate-400 font-bold">Ref: {mov.referenceId}</p>}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex gap-3 justify-end shrink-0">
                            {canEdit && (
                                <>
                                    {isEditMode ? (
                                        <>
                                            <button
                                                onClick={() => setIsEditMode(false)}
                                                className="px-6 py-3 border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold rounded-2xl transition-all uppercase text-xs tracking-widest"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                onClick={handleSave}
                                                disabled={isSaving}
                                                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black rounded-2xl shadow-xl shadow-blue-500/20 transition-all flex items-center gap-2 uppercase text-xs tracking-widest"
                                            >
                                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                                {isCreationMode ? 'Cadastrar Produto' : 'Salvar Alterações'}
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            onClick={() => setIsEditMode(true)}
                                            className="px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-2xl shadow-xl transition-all flex items-center gap-2 uppercase text-xs tracking-widest"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                            Editar Produto
                                        </button>
                                    )}
                                </>
                            )}
                            {!isEditMode && (
                                <button
                                    onClick={() => setSelectedProduct(null)}
                                    className="px-8 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-2xl transition-all uppercase text-xs tracking-widest"
                                >
                                    Fechar
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

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
