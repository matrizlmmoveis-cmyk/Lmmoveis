import React, { useState, useEffect } from 'react';
import { Product, Store, InventoryItem, Employee, Supplier, ProductImage } from '../types.ts';
import { X, Package, Search, Filter, DollarSign, Edit2, Loader2, Save, MapPin, RefreshCw } from 'lucide-react';
import { supabaseService } from '../services/supabaseService.ts';
import { CATEGORIES } from '../constants.tsx';
import { getDirectImageUrl } from '../utils/imageUtils.ts';

interface ProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product | null;
    isEditMode: boolean;
    setIsEditMode: (val: boolean) => void;
    isCreationMode: boolean;
    user: any;
    stores: Store[];
    suppliers: Supplier[];
    inventory: InventoryItem[];
    refreshData: (force?: boolean) => Promise<void>;
    onOpenImage: (url: string) => void;
}

const FALLBACK_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%23f1f5f9'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='60' fill='%23cbd5e1'%3E📦%3C/text%3E%3C/svg%3E";

const ProductModal: React.FC<ProductModalProps> = ({
    isOpen,
    onClose,
    product,
    isEditMode,
    setIsEditMode,
    isCreationMode,
    user,
    stores,
    suppliers,
    inventory,
    refreshData,
    onOpenImage
}) => {
    const [editForm, setEditForm] = useState<Partial<Product>>({});
    const [movements, setMovements] = useState<any[]>([]);
    const [isLoadingMovements, setIsLoadingMovements] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'details' | 'history'>('details');
    const [isManualCategory, setIsManualCategory] = useState(false);

    useEffect(() => {
        if (product) {
            setEditForm({ ...product });
            // Detectar se a categoria é personalizada
            const isCustom = product.category && !CATEGORIES.includes(product.category);
            setIsManualCategory(!!isCustom);
            
            if (!isCreationMode) {
                loadMovements(product.id);
            }
            setActiveTab('details');
        }
    }, [product, isCreationMode]);

    if (!isOpen || !product) return null;

    const canEdit = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR' || user?.name === 'Lucas' || user?.username === 'Master';

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
        if (!editForm.name || !editForm.sku) {
            alert('Nome e SKU são obrigatórios!');
            return;
        }
        setIsSaving(true);
        try {
            if (isCreationMode) {
                await supabaseService.createProduct(editForm as Product);
                alert('Produto criado com sucesso!');
            } else {
                await supabaseService.updateProduct(product.id, editForm);
                alert('Produto atualizado com sucesso!');
            }
            await refreshData(true);
            onClose();
        } catch (err: any) {
            console.error('Erro ao salvar produto:', err);
            const msg = err.message || err.details || 'Erro desconhecido';
            alert(`Erro ao salvar produto: ${msg}`);
        } finally {
            setIsSaving(false);
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

    const getStockForStore = (productId: string, storeId: string) => {
        const item = inventory.find(i => i.productId === productId && i.locationId === storeId);
        return item ? item.quantity : 0;
    };

    return (
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
                                {isCreationMode ? 'Cadastro Inicial' : `SKU: ${product.sku}`}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
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
                                    const rawUrl = editForm.images?.[0]?.url || editForm.imageUrl || FALLBACK_IMG;
                                    onOpenImage(getDirectImageUrl(rawUrl));
                                }}
                            >
                                <img src={getDirectImageUrl(editForm.images?.[0]?.url || editForm.imageUrl || FALLBACK_IMG)} alt="" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-slate-900/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Search className="w-6 h-6 text-white" />
                                </div>
                            </div>
                            {(editForm.imageUrl2 || (editForm.images?.length ?? 0) > 1) && (
                                <div 
                                    className="aspect-square bg-slate-100 rounded-3xl overflow-hidden border border-slate-200 shadow-inner cursor-zoom-in relative group"
                                    onClick={() => {
                                        const rawUrl = editForm.imageUrl2 || editForm.images?.[1]?.url || FALLBACK_IMG;
                                        onOpenImage(getDirectImageUrl(rawUrl));
                                    }}
                                >
                                    <img
                                        src={getDirectImageUrl(editForm.imageUrl2 || editForm.images?.[1]?.url || FALLBACK_IMG)}
                                        className="w-full h-full object-cover"
                                        alt=""
                                        onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMG; }}
                                    />
                                    <div className="absolute inset-0 bg-slate-900/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Search className="w-6 h-6 text-white" />
                                    </div>
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
                                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Código NF-e (Numeral)</label>
                                            <input
                                                type="number"
                                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:border-blue-500 outline-none transition-all"
                                                value={editForm.productCode || ''}
                                                placeholder={isCreationMode ? '(Automático)' : 'Ex: 100'}
                                                onChange={e => setEditForm({ ...editForm, productCode: parseInt(e.target.value) || undefined })}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Categoria</label>
                                            {!isManualCategory ? (
                                                <select
                                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold uppercase text-sm focus:border-blue-500 outline-none transition-all text-slate-700"
                                                    value={editForm.category || ''}
                                                    onChange={e => {
                                                        if (e.target.value === 'ADD_NEW') {
                                                            setIsManualCategory(true);
                                                            setEditForm({ ...editForm, category: '' });
                                                        } else {
                                                            setEditForm({ ...editForm, category: e.target.value });
                                                        }
                                                    }}
                                                >
                                                    <option value="">Selecione...</option>
                                                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                                    <option value="ADD_NEW" className="text-blue-600 font-black">+ ADICIONAR NOVA...</option>
                                                </select>
                                            ) : (
                                                <div className="flex gap-2">
                                                    <input
                                                        autoFocus
                                                        type="text"
                                                        className="flex-1 px-4 py-3 bg-white border-2 border-blue-500 rounded-xl font-bold uppercase text-sm outline-none shadow-sm"
                                                        value={editForm.category || ''}
                                                        onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                                                        placeholder="Digite a nova categoria..."
                                                    />
                                                    <button 
                                                        type="button" 
                                                        onClick={() => setIsManualCategory(false)}
                                                        className="px-4 py-3 bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-all"
                                                        title="Voltar para lista"
                                                    >
                                                        <RefreshCw className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )}
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
                                    {(user?.role === 'ADMIN' || user?.username === 'Master') && (
                                        <div className="pt-2 flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                                            <div>
                                                <p className="text-xs font-black text-slate-900 uppercase">Produto para Atacado</p>
                                                <p className="text-[10px] font-medium text-slate-500">Exibir no catálogo de logistas</p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input type="checkbox" className="sr-only peer" checked={editForm.isWholesale === true} onChange={e => setEditForm(prev => ({ ...prev, isWholesale: e.target.checked }))} />
                                                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                            </label>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <h3 className="text-2xl font-black text-slate-900 uppercase leading-tight italic">{product.name}</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {product.active === false && (
                                                <div className="inline-flex px-3 py-1 bg-red-50 text-red-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-red-100">
                                                    INATIVO
                                                </div>
                                            )}
                                            <div className="inline-flex px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-100">
                                                {product.category}
                                            </div>
                                            <div className="inline-flex px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-200">
                                                Fornecedor: {getSupplierName(product.supplierId)}
                                            </div>
                                            {product.productCode && (
                                                <div className="inline-flex px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                                                    Cód. NF-e: {product.productCode}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {product.description && (
                                        <div className="pt-2">
                                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                <Filter className="w-3 h-3" /> Descrição do Produto
                                            </h3>
                                            <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-600 text-sm font-medium leading-relaxed uppercase">
                                                {product.description}
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
                                <p className="text-2xl font-black text-blue-700 italic">{formatCurrencyBRL(product.price || 0)}</p>
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
                                <p className="text-2xl font-black text-emerald-700 italic">{formatCurrencyBRL(product.assemblyPrice || 0)}</p>
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
                                    {(user?.role === 'ADMIN' || user?.username === 'Master') ? formatCurrencyBRL(product.costPrice || 0) : '*****'}
                                </p>
                            )}
                        </div>
                        <div className="p-5 bg-slate-50 border border-slate-100 rounded-[2rem] space-y-1">
                            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                <Package className="w-3 h-3 text-blue-400" /> Preço Atacado
                            </div>
                            {isEditMode ? (
                                <input
                                    type="text"
                                    className="w-full bg-transparent text-xl font-black text-slate-900 outline-none"
                                    value={formatCurrencyBRL(editForm.wholesalePrice || 0)}
                                    onChange={e => handleCurrencyChange(e, (num) => setEditForm({ ...editForm, wholesalePrice: num }))}
                                />
                            ) : (
                                <p className="text-2xl font-black text-slate-900 italic">{formatCurrencyBRL(product.wholesalePrice || 0)}</p>
                            )}
                        </div>
                    </div>

                    {/* Tabs */}
                    {!isCreationMode && (
                        <>
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
                                <div className="space-y-4">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-1">
                                        <MapPin className="w-4 h-4" /> Distribuição de Estoque
                                    </h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {stores.map(store => {
                                            const stock = getStockForStore(product.id, store.id);
                                            return (
                                                <div key={store.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col items-center text-center">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase truncate w-full">{store.name}</span>
                                                    <span className={`text-lg font-black mt-1 ${stock > 0 ? 'text-slate-900' : 'text-slate-300'}`}>{stock} UN</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
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
                        </>
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
                            onClick={onClose}
                            className="px-8 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-2xl transition-all uppercase text-xs tracking-widest"
                        >
                            Fechar
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProductModal;
