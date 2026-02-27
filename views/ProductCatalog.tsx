
import React, { useState, useRef, useCallback } from 'react';
import { PRODUCTS as INITIAL_PRODUCTS, INITIAL_INVENTORY, STORES, SUPPLIERS, CATEGORIES } from '../constants.tsx';
import { Product, ProductImage, Supplier, Employee, InventoryItem, Store, OrderStatus } from '../types.ts';
import { Search, Plus, X, Truck, Box, ShoppingCart, Trash2, CheckCircle2, Edit2, ImagePlus, Loader2, AlertCircle, Upload } from 'lucide-react';
import { useCart } from '../components/CartContext.tsx';
import { supabaseService } from '../services/supabaseService';
import { compressImage, formatFileSize } from '../services/imageCompressor';

interface ProductCatalogProps {
  user: Employee | { id: 'admin', name: 'Lucas', role: 'ADMIN', storeId?: string } | null;
  inventory: InventoryItem[];
  stores: Store[];
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
}

const FALLBACK_IMG = 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?q=80&w=500&auto=format&fit=crop';

const ProductCatalog: React.FC<ProductCatalogProps> = ({ user, inventory, stores, products, setProducts }) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>(SUPPLIERS);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');

  // EDIÇÃO
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editImages, setEditImages] = useState<ProductImage[]>([]);
  const [editLoadingImages, setEditLoadingImages] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<{ file: File; preview: string; compressing: boolean; uploading: boolean; done: boolean; error?: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newProduct, setNewProduct] = useState({
    name: '',
    sku: '',
    category: CATEGORIES[0],
    price: '',
    costPrice: '',
    assemblyPrice: '',
    imageUrl: '',
    supplierId: ''
  });

  const { cart, addToCart, removeFromCart, clearCart, totalItems, totalPrice } = useCart();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [orderConfirmed, setOrderConfirmed] = useState(false);

  const isAdmin = user?.role === 'ADMIN' || user?.name === 'Lucas' || (user as any)?.username === 'Master';

  const filteredProducts = (products || []).filter(p =>
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ========================
  // NOVO PRODUTO
  // ========================
  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const product: Product = {
      id: `P${products.length + 1}`,
      name: newProduct.name,
      sku: newProduct.sku,
      category: newProduct.category,
      price: parseFloat(newProduct.price),
      costPrice: parseFloat(newProduct.costPrice) || 0,
      assemblyPrice: parseFloat(newProduct.assemblyPrice) || 0,
      supplierId: newProduct.supplierId || undefined
    };
    setProducts([product, ...products]);
    setIsModalOpen(false);
    setNewProduct({ name: '', sku: '', category: CATEGORIES[0], price: '', costPrice: '', assemblyPrice: '', imageUrl: '', supplierId: '' });
  };

  const handleAddSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplierName.trim()) return;
    const supplier: Supplier = {
      id: `S${suppliers.length + 1}`,
      name: newSupplierName.toUpperCase(),
      active: true
    };
    setSuppliers([...suppliers, supplier]);
    setNewSupplierName('');
    setIsSupplierModalOpen(false);
  };

  // ========================
  // EDIÇÃO DE PRODUTO
  // ========================
  const openEdit = async (product: Product) => {
    setEditingProduct({ ...product });
    setUploadQueue([]);
    setEditLoadingImages(true);
    try {
      const imgs = await supabaseService.getProductImages(product.id);
      setEditImages(imgs);
    } catch (e) {
      setEditImages([]);
    } finally {
      setEditLoadingImages(false);
    }
  };

  const handleEditSave = async () => {
    if (!editingProduct) return;
    setEditSaving(true);
    try {
      await supabaseService.updateProduct(editingProduct.id, {
        name: editingProduct.name,
        sku: editingProduct.sku,
        category: editingProduct.category,
        price: editingProduct.price,
        costPrice: editingProduct.costPrice,
        assemblyPrice: editingProduct.assemblyPrice,
        supplierId: editingProduct.supplierId,
      });
      setProducts(prev => prev.map(p => p.id === editingProduct.id ? { ...editingProduct, images: editImages } : p));
      setEditingProduct(null);
      setEditImages([]);
      setUploadQueue([]);
    } catch (err) {
      alert('Erro ao salvar produto.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteImage = async (img: ProductImage) => {
    try {
      await supabaseService.deleteProductImage(img.id, img.storagePath);
      setEditImages(prev => prev.filter(i => i.id !== img.id));
    } catch (e) {
      alert('Erro ao remover imagem.');
    }
  };

  const handleFilesSelected = useCallback(async (files: FileList | null) => {
    if (!files || !editingProduct) return;
    const arr = Array.from(files);
    const newQueue = arr.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      compressing: true,
      uploading: false,
      done: false,
    }));
    setUploadQueue(prev => [...prev, ...newQueue]);

    for (let i = 0; i < arr.length; i++) {
      const originalFile = arr[i];
      const queueIndex = uploadQueue.length + i;

      try {
        // Compress
        const compressed = await compressImage(originalFile, { maxWidthOrHeight: 1200, quality: 0.75 });
        setUploadQueue(prev => prev.map((q, idx) => idx === queueIndex ? { ...q, compressing: false, uploading: true, file: compressed } : q));

        // Upload
        const uploaded = await supabaseService.uploadProductImage(compressed, editingProduct.id);
        setEditImages(prev => [...prev, uploaded]);
        setUploadQueue(prev => prev.map((q, idx) => idx === queueIndex ? { ...q, uploading: false, done: true } : q));
      } catch (err: any) {
        setUploadQueue(prev => prev.map((q, idx) => idx === queueIndex ? { ...q, compressing: false, uploading: false, error: 'Falha no upload' } : q));
      }
    }
  }, [editingProduct, uploadQueue.length]);

  // Função para obter a imagem principal do produto
  const getProductImage = (product: Product): string => {
    if (product.images && product.images.length > 0) return product.images[0].url;
    if (product.imageUrl) return product.imageUrl;
    return FALLBACK_IMG;
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Catálogo de Produtos</h1>
          <p className="text-slate-500">Gestão de preços de venda e montagem</p>
        </div>
        <div className="flex gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Busca..." className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          {user && (
            <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 font-bold shadow-lg shadow-blue-100"><Plus className="w-5 h-5" /> Novo</button>
          )}

        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredProducts.map((product) => {
          const imgSrc = getProductImage(product);
          return (
            <div key={product.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl transition-all overflow-hidden group">
              <div className="relative h-48 bg-slate-100">
                <img
                  src={imgSrc}
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMG; }}
                />
                <div className="absolute bottom-2 right-2 bg-emerald-600 text-white text-[9px] font-black px-2 py-1 rounded-lg shadow-lg">
                  MONTAGEM: R$ {(product.assemblyPrice || 0).toFixed(2)}
                </div>
                {isAdmin && (
                  <>
                    <div className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-sm text-white text-[9px] font-black px-2 py-1 rounded-lg">
                      CUSTO: R$ {(product.costPrice || 0).toFixed(2)}
                    </div>
                    <button
                      onClick={() => openEdit(product)}
                      className="absolute top-2 right-2 bg-blue-600/90 backdrop-blur-sm text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-700"
                      title="Editar produto"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <h3 className="font-bold text-slate-900 uppercase text-xs truncate flex-1">{product.name}</h3>
                  <span className="bg-slate-100 text-slate-500 text-[9px] font-black px-1.5 py-0.5 rounded uppercase">{product.category}</span>
                </div>
                <p className="text-blue-600 font-black text-lg leading-none">R$ {(product.price || 0).toFixed(2)}</p>
                <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase">
                  <span>SKU: {product.sku}</span>
                  {product.supplierId && (
                    <span className="flex items-center gap-1"><Truck className="w-3 h-3" /> {suppliers.find(s => s.id === product.supplierId)?.name}</span>
                  )}
                </div>

                {user && (
                  <div className="pt-3 border-t border-slate-50 space-y-2">
                    <div className="flex justify-between items-center bg-blue-50/50 p-2 rounded-lg">
                      <span className="text-[9px] font-black text-blue-600 uppercase flex items-center gap-1">
                        <Box className="w-3 h-3" /> Saldo Total
                      </span>
                      <span className="text-sm font-black text-blue-700">
                        {(inventory || []).filter(i => i.productId === product.id).reduce((acc, curr) => acc + (curr.quantity || 0), 0)} UN
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 px-1">
                      {(inventory || []).filter(i => i.productId === product.id).map((stock, idx) => {
                        const storeName = (stores || []).find(s => s.id === stock.locationId)?.name || stock.locationId;
                        return (
                          <div key={idx} className="flex flex-col">
                            <span className="text-[8px] text-slate-400 font-bold truncate">{storeName}</span>
                            <span className="text-[10px] text-slate-700 font-black">{stock.quantity || 0} UN</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}


              </div>
            </div>
          );
        })}
      </div>

      {/* ======================== MODAL DE EDIÇÃO ======================== */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[95vh]">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-lg font-black text-slate-900 uppercase">Editar Produto</h2>
                <p className="text-xs text-slate-400 font-medium">SKU: {editingProduct.sku}</p>
              </div>
              <button onClick={() => { setEditingProduct(null); setUploadQueue([]); }} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {/* GALERIA DE IMAGENS */}
              <div className="p-6 border-b border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Fotos do Produto</h3>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all"
                  >
                    <ImagePlus className="w-4 h-4" />
                    Adicionar Fotos
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={e => handleFilesSelected(e.target.files)}
                  />
                </div>

                {editLoadingImages ? (
                  <div className="flex items-center justify-center h-24 text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {/* Imagens já salvas */}
                    {editImages.map((img) => (
                      <div key={img.id} className="relative group/img aspect-square rounded-2xl overflow-hidden border-2 border-slate-100">
                        <img src={img.url} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                          <button
                            onClick={() => handleDeleteImage(img)}
                            className="bg-red-600 text-white p-2 rounded-xl hover:bg-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Fila de upload */}
                    {uploadQueue.map((item, idx) => (
                      <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border-2 border-blue-200 bg-slate-50">
                        <img src={item.preview} alt="" className="w-full h-full object-cover opacity-50" />
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                          {item.compressing && (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                              <span className="text-[9px] font-black text-blue-600 uppercase">Comprimindo</span>
                            </>
                          )}
                          {item.uploading && (
                            <>
                              <Upload className="w-5 h-5 text-emerald-600 animate-bounce" />
                              <span className="text-[9px] font-black text-emerald-600 uppercase">Enviando</span>
                            </>
                          )}
                          {item.done && (
                            <>
                              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                              <span className="text-[9px] font-black text-emerald-600 uppercase">Salvo!</span>
                            </>
                          )}
                          {item.error && (
                            <>
                              <AlertCircle className="w-5 h-5 text-red-500" />
                              <span className="text-[9px] font-black text-red-500 uppercase">Erro</span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Botão de adicionar inline */}
                    {editImages.length === 0 && uploadQueue.length === 0 && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-square rounded-2xl border-2 border-dashed border-slate-200 hover:border-blue-400 flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-blue-500 transition-all"
                      >
                        <ImagePlus className="w-8 h-8" />
                        <span className="text-[9px] font-black uppercase">Adicionar</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* CAMPOS DE EDIÇÃO */}
              <div className="p-6 grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-black text-slate-400 uppercase mb-1">Nome</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none uppercase font-bold text-sm focus:border-blue-500"
                    value={editingProduct.name}
                    onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-1">SKU</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-sm focus:border-blue-500"
                    value={editingProduct.sku}
                    onChange={e => setEditingProduct({ ...editingProduct, sku: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-1">Categoria</label>
                  <select
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-sm focus:border-blue-500"
                    value={editingProduct.category}
                    onChange={e => setEditingProduct({ ...editingProduct, category: e.target.value })}
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-1">Preço Venda (R$)</label>
                  <input
                    type="number" step="0.01"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-sm focus:border-blue-500"
                    value={editingProduct.price}
                    onChange={e => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-1">Preço Montagem (R$)</label>
                  <input
                    type="number" step="0.01"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-sm text-emerald-600 focus:border-blue-500"
                    value={editingProduct.assemblyPrice}
                    onChange={e => setEditingProduct({ ...editingProduct, assemblyPrice: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-1">Custo (R$)</label>
                  <input
                    type="number" step="0.01"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-sm text-red-600 focus:border-blue-500"
                    value={editingProduct.costPrice}
                    onChange={e => setEditingProduct({ ...editingProduct, costPrice: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-1">Fornecedor</label>
                  <select
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-sm focus:border-blue-500"
                    value={editingProduct.supplierId || ''}
                    onChange={e => setEditingProduct({ ...editingProduct, supplierId: e.target.value || undefined })}
                  >
                    <option value="">Sem fornecedor</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* FOOTER */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex gap-3 justify-end shrink-0">
              <button
                onClick={() => { setEditingProduct(null); setUploadQueue([]); }}
                className="px-6 py-2.5 border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleEditSave}
                disabled={editSaving}
                className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
              >
                {editSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DO CARRINHO */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-end md:p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md h-full md:h-[90vh] md:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShoppingCart className="w-6 h-6 text-slate-900" />
                <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tight">Meu Carrinho</h2>
              </div>
              <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="w-6 h-6 text-slate-400" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                  <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center"><ShoppingCart className="w-10 h-10" /></div>
                  <p className="font-bold uppercase text-xs">Seu carrinho está vazio</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="flex gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <img src={getProductImage(item)} className="w-16 h-16 rounded-xl object-cover shrink-0" alt="" onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMG; }} />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[10px] font-black text-slate-900 uppercase truncate">{item.name}</h4>
                      <p className="text-blue-600 font-bold text-xs">R$ {item.price.toFixed(2)}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded-full font-bold">QTD: {item.quantity}</span>
                        <button onClick={() => removeFromCart(item.id)} className="text-red-500 hover:text-red-600 p-1"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-6 bg-slate-50 border-t border-slate-100 space-y-4">
                <div className="flex justify-between items-center text-slate-900">
                  <span className="font-bold uppercase text-xs">Total</span>
                  <span className="text-2xl font-black italic">R$ {totalPrice.toFixed(2)}</span>
                </div>
                <button
                  onClick={() => { setIsCartOpen(false); setIsCheckoutOpen(true); }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black shadow-xl shadow-blue-500/20 transition-all uppercase tracking-widest"
                >
                  Finalizar Pedido
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL DE CHECKOUT */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-[2.50rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {orderConfirmed ? (
              <div className="p-10 text-center space-y-6">
                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto animate-bounce">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Pedido Reservado!</h2>
                <p className="text-slate-500 font-medium">Seu pedido foi encaminhado para a unidade <span className="font-bold text-slate-900">{stores.find(s => s.id === selectedStoreId)?.name}</span>. Dirija-se à loja para pagamento e retirada.</p>
                <button
                  onClick={() => { setIsCheckoutOpen(false); setOrderConfirmed(false); clearCart(); }}
                  className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl"
                >
                  Voltar ao Início
                </button>
              </div>
            ) : (
              <div className="p-8 space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-black text-slate-900 italic uppercase">Escolha a Unidade para Retirada</h2>
                  <button onClick={() => setIsCheckoutOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="w-6 h-6 text-slate-400" /></button>
                </div>

                <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2">
                  {stores.map(store => (
                    <button key={store.id} onClick={() => setSelectedStoreId(store.id)}
                      className={`w-full p-5 rounded-2xl border-2 text-left transition-all ${selectedStoreId === store.id ? 'border-blue-600 bg-blue-50 shadow-inner' : 'border-slate-100 hover:border-slate-300'}`}
                    >
                      <div className="flex justify-between items-center">
                        <p className="font-extrabold text-slate-900 uppercase">{store.name}</p>
                        {selectedStoreId === store.id && <div className="w-5 h-5 bg-blue-600 rounded-full border-4 border-white"></div>}
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-1 uppercase">{store.location}</p>
                    </button>
                  ))}
                </div>

                <div className="pt-6 border-t border-slate-100 space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 font-bold uppercase">Total a pagar na loja</span>
                    <span className="text-slate-900 font-black">R$ {totalPrice.toFixed(2)}</span>
                  </div>
                  <button
                    disabled={!selectedStoreId}
                    onClick={async () => {
                      const newSale = {
                        id: `V${Date.now()}`,
                        customerName: 'VISITANTE',
                        customerCpf: '',
                        customerPhone: '',
                        customerEmail: '',
                        customerReference: 'CHECKOUT SITE',
                        storeId: selectedStoreId,
                        sellerId: 'ADMIN',
                        total: totalPrice,
                        status: OrderStatus.PENDING,
                        items: cart.map(item => ({
                          productId: item.id,
                          quantity: item.quantity,
                          price: item.price,
                          discount: 0,
                          originalPrice: item.price,
                          assemblyRequired: false
                        })),
                        payments: [{ method: 'LOJA', amount: totalPrice }],
                        createdAt: new Date().toISOString(),
                        assemblyRequired: false
                      };
                      try {
                        await supabaseService.createSale(newSale as any);
                        setOrderConfirmed(true);
                        clearCart();
                      } catch (err) {
                        alert("Erro ao finalizar pedido.");
                      }
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20 transition-all active:scale-95"
                  >
                    Confirmar Reserva
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL NOVO PRODUTO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-black text-slate-900 uppercase">Cadastrar Produto</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <form onSubmit={handleAddProduct} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-black text-slate-400 uppercase mb-1">Nome do Produto</label>
                  <input required type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none uppercase font-bold text-sm" value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} />
                </div>
                <div><label className="block text-xs font-black text-slate-400 uppercase mb-1">SKU</label><input required type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none" value={newProduct.sku} onChange={e => setNewProduct({ ...newProduct, sku: e.target.value })} /></div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-1">Categoria</label>
                  <select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-sm" value={newProduct.category} onChange={e => setNewProduct({ ...newProduct, category: e.target.value })}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-1">Fornecedor</label>
                  <div className="flex gap-2">
                    <select className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-sm" value={newProduct.supplierId} onChange={e => setNewProduct({ ...newProduct, supplierId: e.target.value })}>
                      <option value="">Selecione...</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <button type="button" onClick={() => setIsSupplierModalOpen(true)} className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 transition-colors"><Plus className="w-5 h-5" /></button>
                  </div>
                </div>
                <div><label className="block text-xs font-black text-slate-400 uppercase mb-1">Venda (R$)</label><input required type="number" step="0.01" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold" value={newProduct.price} onChange={e => setNewProduct({ ...newProduct, price: e.target.value })} /></div>
                <div><label className="block text-xs font-black text-slate-400 uppercase mb-1">Custo (R$)</label><input type="number" step="0.01" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-red-600" value={newProduct.costPrice} onChange={e => setNewProduct({ ...newProduct, costPrice: e.target.value })} /></div>
                <div><label className="block text-xs font-black text-slate-400 uppercase mb-1">Montagem (R$)</label><input type="number" step="0.01" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-emerald-600" value={newProduct.assemblyPrice} onChange={e => setNewProduct({ ...newProduct, assemblyPrice: e.target.value })} /></div>
              </div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black shadow-xl transition-all">SALVAR PRODUTO</button>
            </form>
          </div>
        </div>
      )}

      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-sm font-black text-slate-900 uppercase">Novo Fornecedor</h2>
              <button onClick={() => setIsSupplierModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <form onSubmit={handleAddSupplier} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase mb-1">Nome do Fornecedor</label>
                <input required type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none uppercase font-bold text-sm" value={newSupplierName} onChange={e => setNewSupplierName(e.target.value)} />
              </div>
              <button type="submit" className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold transition-all">ADICIONAR</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductCatalog;
