import React, { useState, useMemo } from 'react';
import { Product, InventoryItem, WholesaleReservation, Store } from '../types.ts';
import { ShoppingCart, Plus, Minus, CheckCircle, Package, Info, Search, ShoppingBag, X, Filter, Settings, Eye, EyeOff, Lock, Unlock, Share2, ListChecks, Download, Loader2 } from 'lucide-react';
import { supabaseService } from '../services/supabaseService.ts';
import { getDirectImageUrl } from '../utils/imageUtils.ts';

interface WholesaleCatalogProps {
    user: any;
    products: Product[];
    inventory: InventoryItem[];
    stores: Store[];
    refreshData: (scope?: string | boolean) => Promise<void>;
}

const FALLBACK_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%23f1f5f9'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='60' fill='%23cbd5e1'%3E📦%3C/text%3E%3C/svg%3E";

const normalizeId = (id: string) => id.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');


const WholesaleCatalog: React.FC<WholesaleCatalogProps> = ({ user, products, inventory, stores, refreshData }) => {
    const [cart, setCart] = useState<Record<string, number>>({});
    const [search, setSearch] = useState('');
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [loading, setLoading] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
    const [modalImage, setModalImage] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'catalog' | 'history'>('catalog');
    const [reservations, setReservations] = useState<any[]>([]);
    const [loadingReservations, setLoadingReservations] = useState(false);
    const [markup, setMarkup] = useState<number>(() => Number(localStorage.getItem('wholesale_markup')) || 0);
    const [showWholesalePrices, setShowWholesalePrices] = useState(false);
    const [isMarkupModalOpen, setIsMarkupModalOpen] = useState(false);
    const [showInstallments, setShowInstallments] = useState<boolean>(() => localStorage.getItem('wholesale_show_installments') === 'true');
    const [installmentCount, setInstallmentCount] = useState<number>(() => Number(localStorage.getItem('wholesale_installments')) || 10);
    const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
    const [showTotalPrice, setShowTotalPrice] = useState<boolean>(() => localStorage.getItem('wholesale_show_total_price') !== 'false');
    const [sharingLoading, setSharingLoading] = useState<string | null>(null);

    // Novos Estados
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
    const [productInstallments, setProductInstallments] = useState<Record<string, number>>(() => {
        try {
            return JSON.parse(localStorage.getItem('wholesale_product_installments') || '{}');
        } catch (e) {
            return {};
        }
    });

    // Persistir configurações
    React.useEffect(() => {
        localStorage.setItem('wholesale_markup', markup.toString());
        localStorage.setItem('wholesale_show_installments', showInstallments.toString());
        localStorage.setItem('wholesale_installments', installmentCount.toString());
        localStorage.setItem('wholesale_show_total_price', showTotalPrice.toString());
        localStorage.setItem('wholesale_product_installments', JSON.stringify(productInstallments));
    }, [markup, showInstallments, installmentCount, showTotalPrice, productInstallments]);

    // Fetch reservations when tab changes
    const fetchReservations = async () => {
        if (!user?.id) return;
        setLoadingReservations(true);
        try {
            const data = await supabaseService.getWholesaleReservations(user.id);
            setReservations(data);
        } catch (err) {
            console.error("Erro ao buscar reservas:", err);
        } finally {
            setLoadingReservations(false);
        }
    };

    React.useEffect(() => {
        if (activeTab === 'history') {
            fetchReservations();
        }
    }, [activeTab]);

    const getPrice = (price: number = 0) => {
        if (showWholesalePrices) return price;
        return price * (1 + markup / 100);
    };

    const getProductInstallments = (productId: string) => {
        return productInstallments[productId] || installmentCount;
    };

    // Resetar modalImage quando o produto muda (corrigido: useMemo não deve ser usado para side-effects)
    React.useEffect(() => {
        if (selectedProduct) setModalImage(selectedProduct.imageUrl || null);
    }, [selectedProduct]);

    // Filtrar produtos de atacado com estoque positivo (Real - 5)
    const filteredProducts = useMemo(() => {
        // Encontrar o ID do estoque do Norte dinamicamente
        const norteWarehouseId = stores.find(s => 
            s.type === 'CD' && s?.name?.toUpperCase().includes('NORTE')
        )?.id || 'W-NORTE';

        return products.filter(p => {
            if (!p.isWholesale || !p.active) return false;
            
            const norteStock = (inventory || [])
                .filter(i => i.productId === p.id && i.locationId === norteWarehouseId)
                .reduce((acc: number, i: any) => acc + i.quantity, 0);
            
            const calculatedStock = norteStock - 3;
            if (calculatedStock <= 0) return false;

            if (search) {
                const s = search.toLowerCase();
                return p.name.toLowerCase().includes(s) || (p.sku && p.sku.toLowerCase().includes(s));
            }
            return true;
        }).map(p => {
            const norteStock = (inventory || [])
                .filter(i => i.productId === p.id && i.locationId === norteWarehouseId)
                .reduce((acc: number, i: any) => acc + (i.quantity || 0), 0);
            return { ...p, calculatedStock: norteStock - 3 };
        });
    }, [products, inventory, stores, search]);

    // Agrupar por categoria
    const groupedProducts = useMemo(() => {
        const groups: Record<string, any[]> = {};
        filteredProducts.forEach(p => {
            const cat = p.category || 'Outros';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(p);
        });
        return groups;
    }, [filteredProducts]);

    const addToCart = (productId: string, max: number) => {
        try {
            const current = cart[productId] || 0;
            if (current < (max || 0)) {
                setCart(prev => ({ ...prev, [productId]: current + 1 }));
            }
        } catch (err: any) {
            console.error("Erro ao adicionar ao carrinho:", err);
        }
    };

    const removeFromCart = (productId: string) => {
        try {
            const current = cart[productId] || 0;
            if (current > 1) {
                setCart(prev => ({ ...prev, [productId]: current - 1 }));
            } else {
                setCart(prev => {
                    const newCart = { ...prev };
                    delete newCart[productId];
                    return newCart;
                });
            }
        } catch (err) {
            console.error("Erro ao remover do carrinho:", err);
        }
    };

    const cartCount = useMemo(() => {
        return Object.values(cart || {}).reduce((acc: number, q: number) => acc + (Number(q) || 0), 0);
    }, [cart]);

    const cartTotal = useMemo(() => {
        if (!Array.isArray(products)) return 0;
        return Object.entries(cart || {}).reduce((acc: number, [id, qty]: [string, number]) => {
            const p = products.find(prod => prod?.id === id);
            if (!p) return acc;
            return acc + getPrice(p?.wholesalePrice || 0) * (Number(qty) || 0);
        }, 0);
    }, [cart, products, showWholesalePrices, markup]);

    const handleConfirmReservation = async () => {
        if (Object.keys(cart).length === 0) return;
        setLoading(true);
        try {
            // Criar uma reserva para cada item do carrinho
            for (const [productId, quantity] of Object.entries(cart) as [string, number][]) {
                await supabaseService.createWholesaleReservation({
                    wholesalerId: user.id,
                    productId,
                    quantity,
                    status: 'PENDENTE'
                });
            }
            setCart({});
            setIsCartOpen(false);
            setShowSuccess(true);
            await refreshData('inventory');
            await fetchReservations();
            setTimeout(() => setShowSuccess(false), 5000);
        } catch (err) {
            alert('Erro ao confirmar reserva.');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleWholesalePrice = () => {
        setShowWholesalePrices(!showWholesalePrices);
    };

    const handleCancelReservation = async (reservationId: string) => {
        if (!confirm('Deseja realmente cancelar esta reserva? O estoque será devolvido ao CD.')) return;
        setLoadingReservations(true);
        try {
            await supabaseService.updateWholesaleReservationStatus(reservationId, 'CANCELADA', user.name);
            await fetchReservations();
            refreshData('inventory');
        } catch (err) {
            console.error("Erro ao cancelar reserva:", err);
            alert("Erro ao cancelar reserva.");
        } finally {
            setLoadingReservations(false);
        }
    };

    // Helper para desenhar retângulos arredondados no canvas
    const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    };

    // Helper para quebrar texto no Canvas
    const wrapText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number => {
        const words = text.split(' ');
        let line = '';
        let currentY = y;
        let lineCount = 0;

        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            const testWidth = metrics.width;
            if (testWidth > maxWidth && n > 0) {
                ctx.fillText(line.trim(), x, currentY);
                line = words[n] + ' ';
                currentY += lineHeight;
                lineCount++;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line.trim(), x, currentY);
        return currentY + lineHeight;
    };

    // Função Unificada de Geração de Card
    const generateProductCardBlob = async (product: Product): Promise<Blob | null> => {
        try {
            const currentInstallments = getProductInstallments(product.id);
            const price = getPrice(product.wholesalePrice || 0);
            const formattedPrice = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);
            const instValue = price / currentInstallments;
            const formattedInst = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(instValue);

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;

            canvas.width = 1080;
            canvas.height = 1550;

            const gradient = ctx.createLinearGradient(0, 0, 1080, 1550);
            gradient.addColorStop(0, '#f8fafc');
            gradient.addColorStop(1, '#f1f5f9');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 1080, 1550);

            const img = new Image();
            img.crossOrigin = "anonymous";
            let rawUrl = getDirectImageUrl(product.imageUrl) || FALLBACK_IMG;
            let imageUrl = rawUrl;
            if (rawUrl && !rawUrl.startsWith('data:')) {
                const timestamp = new Date().getTime();
                // Aumentando qualidade (q=100) e largura (w=2000) e usando compressão sem perda se possível
                imageUrl = `https://images.weserv.nl/?url=${encodeURIComponent(rawUrl)}&w=2000&q=100&il&t=${timestamp}`;
            }

            let imageLoaded = false;
            try {
                // Tentativa 1: Weserv (Melhor performance e redimensionamento)
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => reject(new Error("Timeout")), 8000);
                    img.onload = () => { clearTimeout(timeout); resolve(true); };
                    img.onerror = () => { clearTimeout(timeout); reject(new Error("Proxy Error")); };
                    img.src = imageUrl;
                });
                imageLoaded = true;
            } catch (imgErr) {
                console.warn("Falha no Weserv, tentando AllOrigins...", imgErr);
                try {
                    // Tentativa 2: AllOrigins (CORS puro, imagem original)
                    const proxy2 = `https://api.allorigins.win/raw?url=${encodeURIComponent(rawUrl)}`;
                    await new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => reject(new Error("Timeout")), 7000);
                        img.onload = () => { clearTimeout(timeout); resolve(true); };
                        img.onerror = reject;
                        img.src = proxy2;
                    });
                    imageLoaded = true;
                } catch (e2) {
                    console.warn("Falha no AllOrigins, tentando URL direta...", e2);
                    try {
                        // Tentativa 3: URL Direta (Alguns browsers/servidores podem permitir via cache ou headers)
                        await new Promise((resolve, reject) => {
                            const timeout = setTimeout(() => reject(new Error("Timeout")), 5000);
                            img.onload = () => { clearTimeout(timeout); resolve(true); };
                            img.onerror = reject;
                            img.src = rawUrl;
                        });
                        imageLoaded = true;
                    } catch (e3) {
                        imageLoaded = false;
                    }
                }
            }

            const padding = 80;
            const imgMaxHeight = 850;
            const imgMaxWidth = 920;
            const canvasCenterX = 540;

            ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
            ctx.shadowBlur = 40;
            ctx.shadowOffsetY = 20;
            ctx.fillStyle = '#ffffff';
            roundRect(ctx, (1080 - imgMaxWidth) / 2 - 20, padding - 20, imgMaxWidth + 40, imgMaxHeight + 40, 60);
            ctx.fill();
            ctx.shadowColor = 'transparent';

            if (imageLoaded) {
                let drawWidth = img.width;
                let drawHeight = img.height;
                const ratio = Math.min(imgMaxWidth / drawWidth, imgMaxHeight / drawHeight);
                drawWidth *= ratio;
                drawHeight *= ratio;
                ctx.drawImage(img, (1080 - drawWidth) / 2, padding + (imgMaxHeight - drawHeight) / 2, drawWidth, drawHeight);
            } else {
                ctx.fillStyle = '#cbd5e1';
                ctx.font = '120px serif';
                ctx.textAlign = 'center';
                ctx.fillText('🖼️', canvasCenterX, padding + imgMaxHeight / 2);
            }

            let nextY = 1050;
            ctx.textAlign = 'center';
            ctx.font = '900 30px sans-serif';
            ctx.fillStyle = '#3b82f6';
            ctx.fillText((product.category || 'PRODUTO').toUpperCase(), canvasCenterX, nextY);
            nextY += 70;

            ctx.font = '900 68px sans-serif';
            ctx.fillStyle = '#0f172a';
            nextY = wrapText(ctx, product.name.toUpperCase(), canvasCenterX, nextY, 900, 75);
            nextY += 10;

            if (product.description) {
                ctx.font = '500 34px sans-serif';
                ctx.fillStyle = '#64748b';
                nextY = wrapText(ctx, product.description, canvasCenterX, nextY, 850, 45);
                nextY += 20;
            }

            if (showTotalPrice) {
                ctx.font = '900 115px sans-serif';
                ctx.fillStyle = '#2563eb';
                ctx.fillText(formattedPrice, canvasCenterX, nextY + 100);
                nextY += 110;
            }

            if (showInstallments && currentInstallments > 1) {
                ctx.font = '700 50px sans-serif';
                ctx.fillStyle = '#1e293b';
                ctx.fillText(`${currentInstallments}x de ${formattedInst}`, canvasCenterX, nextY + 40);
                nextY += 60;
            }


            return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        } catch (err) {
            console.error("Erro na geração do card:", err);
            return null;
        }
    };

    const handleShareWhatsApp = async (product: Product) => {
        setSharingLoading(product.id);
        try {
            const blob = await generateProductCardBlob(product);
            if (!blob) throw new Error("Falha ao gerar Blob");

            const fileName = `${product.name.substring(0, 20).replace(/\s+/g, '_')}_${new Date().getTime()}.png`;
            const file = new File([blob], fileName, { type: 'image/png' });

            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: product.name,
                    text: `Confira este produto: ${product.name}`
                });
            } else {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = fileName;
                link.click();
            }
        } catch (err) {
            alert("Erro ao compartilhar. Verifique a imagem do produto.");
        } finally {
            setSharingLoading(null);
        }
    };

    const toggleProductSelection = (productId: string) => {
        setSelectedProducts(prev => {
            const next = new Set(prev);
            if (next.has(productId)) next.delete(productId);
            else next.add(productId);
            return next;
        });
    };

    const handleBulkDownload = async () => {
        if (selectedProducts.size === 0) return;
        setLoading(true);
        const selectedList = products.filter(p => selectedProducts.has(p.id));
        
        try {
            for (const product of selectedList) {
                const blob = await generateProductCardBlob(product);
                if (blob) {
                    const fileName = `CARD_${product.name.substring(0,15).replace(/\s+/g, '_')}.png`;
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.download = fileName;
                    link.click();
                    // Pequeno delay para não bloquear
                    await new Promise(r => setTimeout(r, 600));
                }
            }
            alert(`${selectedProducts.size} imagens enviadas para download.`);
            setIsSelectionMode(false);
            setSelectedProducts(new Set());
        } catch (err) {
            alert("Erro durante a geração em lote.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-full bg-slate-50 flex flex-col -m-4 md:-m-8">
            {/* Header com Abas */}
            <div className="sticky top-0 z-30 bg-white shadow-sm border-b border-slate-100 px-4 md:px-8 py-3 md:py-4 flex flex-col md:flex-row items-center justify-between gap-3 md:gap-4">

                <div className="flex items-center gap-3">
                    <div className="bg-blue-600 p-1.5 md:p-2 rounded-xl shadow-lg shadow-blue-500/20">
                        <ShoppingBag className="w-4 h-4 md:w-5 md:h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-sm md:text-lg font-black text-slate-900 tracking-tight uppercase leading-none">Catálogo Atacado</h1>
                        <p className="hidden md:block text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{user?.name}</p>
                    </div>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button 
                        onClick={() => setActiveTab('catalog')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'catalog' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Produtos
                    </button>
                    <button 
                        onClick={() => setActiveTab('history')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Minhas Reservas
                    </button>
                </div>

                <div className="flex items-center gap-2 md:gap-3 w-full md:w-auto">
                    {activeTab === 'catalog' && (
                        <>
                            <div className="relative flex-1 md:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar no catálogo..."
                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none font-medium text-slate-900"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                            <button 
                                onClick={() => {
                                    setIsSelectionMode(!isSelectionMode);
                                    if (isSelectionMode) setSelectedProducts(new Set());
                                }}
                                className={`p-2.5 rounded-xl transition-all active:scale-95 flex items-center gap-2 text-xs font-black uppercase ${isSelectionMode ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-slate-100 text-slate-600'}`}
                                title="Modo de Seleção"
                            >
                                <ListChecks className="w-5 h-5 md:w-4 md:h-4" />
                                <span className="hidden sm:inline">{isSelectionMode ? 'Sair Seleção' : 'Selecionar'}</span>
                            </button>
                            <button 
                                onClick={() => setIsMarkupModalOpen(true)}
                                className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors text-slate-600 active:scale-95"
                                title="Configurar Margem"
                            >
                                <Settings className="w-5 h-5" />
                            </button>
                            <button 
                                onClick={handleToggleWholesalePrice}
                                className={`p-2.5 rounded-xl transition-all active:scale-95 flex items-center gap-2 text-xs font-black uppercase ${showWholesalePrices ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-600'}`}
                                title={showWholesalePrices ? "Esconder Custo" : "Ver Custo"}
                            >
                                {showWholesalePrices ? <EyeOff className="w-5 h-5 md:w-4 md:h-4" /> : <Eye className="w-5 h-5 md:w-4 md:h-4" />}
                                <span className="hidden sm:inline">{showWholesalePrices ? "Custo" : "Venda"}</span>
                            </button>
                        </>
                    )}
                    
                    <button 
                        onClick={() => setIsCartOpen(true)}
                        className="relative p-2.5 bg-blue-600 hover:bg-blue-700 rounded-xl border-none transition-all shadow-lg shadow-blue-500/30 active:scale-95"
                    >
                        <ShoppingCart className="w-5 h-5 text-white" />
                        {cartCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-white text-blue-600 text-[10px] font-black rounded-full flex items-center justify-center border-2 border-blue-600 animate-in zoom-in duration-300">
                                {cartCount}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            <div className="flex-1 p-2 md:p-8">

                {showSuccess && (
                    <div className="bg-emerald-50 border-2 border-emerald-200 p-6 rounded-[2.5rem] flex items-center justify-between gap-6 animate-in slide-in-from-top-4 duration-500 shadow-xl shadow-emerald-500/10 mb-8">
                        <div className="flex items-center gap-4">
                            <div className="bg-emerald-500 p-3 rounded-2xl"><CheckCircle className="w-6 h-6 text-white" /></div>
                            <div>
                                <h3 className="font-black text-emerald-900 text-lg">Reserva Confirmada!</h3>
                                <p className="text-emerald-700 text-sm font-medium">Sua solicitação foi enviada para a expedição e o estoque já foi reservado.</p>
                            </div>
                        </div>
                        <button onClick={() => setShowSuccess(false)} className="p-2 hover:bg-emerald-100 rounded-full"><X className="w-5 h-5 text-emerald-600" /></button>
                    </div>
                )}

                {activeTab === 'catalog' ? (
                    <>
                        {/* Categorias - Menu Superior (Desktop) e Hambúrguer (Mobile) */}
                        <div className="flex items-center gap-2 mb-4 md:mb-8 sticky top-[64px] z-20">
                            {/* Botão Mobile - Menu Hambúrguer */}
                            <button 
                                onClick={() => setIsCategoryMenuOpen(true)}
                                className="md:hidden flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 active:scale-95"
                            >
                                <Filter className="w-4 h-4" />
                                Categorias
                            </button>

                            {/* Categorias (Desktop - Barra Lateral) */}
                            <div className="hidden md:flex flex-nowrap gap-2 bg-white/50 backdrop-blur-sm p-2 rounded-2xl border border-white/20 shadow-xl shadow-slate-200/50 overflow-x-auto no-scrollbar flex-1">
                                {Object.keys(groupedProducts).length > 0 && (
                                    <div className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 mr-2 shrink-0">
                                        <Filter className="w-3 h-3" /> <span>Categorias</span>
                                    </div>
                                )}
                                {Object.keys(groupedProducts).sort().map(cat => (
                                    <button 
                                        key={cat} 
                                        onClick={() => {
                                            const el = document.getElementById(`cat-${normalizeId(cat)}`);
                                            if (el) {
                                                const headerOffset = 130;
                                                const elementPosition = el.getBoundingClientRect().top;
                                                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                                                window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
                                            }
                                        }}
                                        className="px-4 py-2 bg-white hover:bg-blue-600 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 shadow-sm border border-slate-100 transition-all active:scale-95 whitespace-nowrap"
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Modal/Menu de Categorias Mobile */}
                        {isCategoryMenuOpen && (
                            <div className="fixed inset-0 z-[100] md:hidden">
                                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsCategoryMenuOpen(false)} />
                                <div className="absolute bottom-0 left-0 right-0 max-h-[70vh] bg-white rounded-t-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom duration-300 flex flex-col">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                            <Filter className="w-4 h-4 text-blue-600" /> Selecione uma Categoria
                                        </h3>
                                        <button onClick={() => setIsCategoryMenuOpen(false)} className="p-2 hover:bg-slate-100 rounded-full">
                                            <X className="w-5 h-5 text-slate-400" />
                                        </button>
                                    </div>
                                    <div className="overflow-y-auto space-y-2 pb-8">
                                        {Object.keys(groupedProducts).sort().map(cat => (
                                            <button 
                                                key={cat} 
                                                onClick={() => {
                                                    const el = document.getElementById(`cat-${normalizeId(cat)}`);
                                                    if (el) {
                                                        const headerOffset = 130;
                                                        const elementPosition = el.getBoundingClientRect().top;
                                                        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                                                        window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
                                                    }
                                                    setIsCategoryMenuOpen(false);
                                                }}
                                                className="w-full text-left px-6 py-4 bg-slate-50 hover:bg-blue-50 hover:text-blue-600 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-600 transition-all active:scale-95 border border-slate-100"
                                            >
                                                {cat}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}


                        {Object.keys(groupedProducts).length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[2rem] border-2 border-dashed border-slate-200 shadow-sm">
                                <div className="bg-slate-50 p-6 rounded-full mb-4">
                                    <Package className="w-12 h-12 text-slate-300" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-400 uppercase tracking-widest">Nenhum produto encontrado</h3>
                                <p className="text-slate-400 text-sm mt-1">Tente ajustar sua busca ou categoria</p>
                            </div>
                        ) : (
                            <div className="space-y-16">
                                {(Object.entries(groupedProducts) as [string, (Product & { calculatedStock: number })[]][]).sort(([a], [b]) => a.localeCompare(b)).map(([category, catProducts]) => (
                                <div key={category} id={`cat-${normalizeId(category)}`} className="scroll-mt-48 md:scroll-mt-48">
                                    <div className="flex items-center gap-4 mb-4 md:mb-6">
                                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
                                        <h2 className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-[0.2em] md:tracking-[0.3em] bg-slate-50 px-2 md:px-4 text-center">{category}</h2>
                                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
                                        {catProducts.map((product) => (
                                            <div 
                                                key={product.id} 
                                                className="group bg-white rounded-2xl md:rounded-3xl border border-slate-100 overflow-hidden hover:shadow-2xl hover:shadow-slate-200/50 transition-all duration-500 md:hover:-translate-y-1"
                                            >

                                                    <div 
                                                        className="aspect-square relative overflow-hidden bg-slate-50 cursor-pointer"
                                                        onClick={() => setSelectedProduct(product)}
                                                    >
                                                        <img
                                                            src={getDirectImageUrl(product.imageUrl) || FALLBACK_IMG}
                                                            alt={product.name}
                                                            className="w-full h-full object-contain p-4 group-hover:scale-110 transition-transform duration-700"
                                                        />
                                                        
                                                        {isSelectionMode && (
                                                            <div 
                                                                className="absolute inset-0 z-20 flex items-center justify-center bg-blue-600/10 cursor-pointer"
                                                                onClick={(e) => { e.stopPropagation(); toggleProductSelection(product.id); }}
                                                            >
                                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-4 shadow-xl transition-all ${selectedProducts.has(product.id) ? 'bg-blue-600 border-white text-white' : 'bg-white/80 border-white text-transparent'}`}>
                                                                    <CheckCircle className="w-6 h-6" />
                                                                </div>
                                                            </div>
                                                        )}
                                                        
                                                        {/* Share Button (Mobile - Fixed / Desktop - Overlay) */}
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleShareWhatsApp(product); }}
                                                            disabled={sharingLoading === product.id}
                                                            className="absolute top-2 right-2 md:top-4 md:right-4 bg-emerald-500 p-2 md:p-3 rounded-xl shadow-lg shadow-emerald-500/30 text-white active:scale-95 z-10 lg:opacity-0 lg:group-hover:opacity-100 transition-all duration-300 disabled:opacity-50"
                                                            title="Compartilhar"
                                                        >
                                                            {sharingLoading === product.id ? (
                                                                <div className="w-3.5 h-3.5 md:w-4 md:h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                                                            ) : (
                                                                <Share2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                                            )}
                                                        </button>

                                                        {product.calculatedStock <= 3 && (
                                                            <div className="absolute top-2 left-2 md:top-4 md:left-4">
                                                                <span className="bg-amber-500 text-white text-[8px] md:text-[9px] font-black px-2 md:px-3 py-1 md:py-1.5 rounded-full shadow-lg shadow-amber-500/20 uppercase tracking-widest animate-pulse">
                                                                    Últimas
                                                                </span>
                                                            </div>
                                                        )}
                                                        <div className="absolute inset-x-0 bottom-0 p-3 hidden md:flex justify-between items-end opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <div className="bg-white/90 backdrop-blur-md p-2 rounded-xl shadow-xl transform translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
                                                                <Search className="w-4 h-4 text-blue-600" />
                                                            </div>
                                                        </div>
                                                    </div>

                                                <div className="p-3 md:p-6">
                                                    <div className="mb-2 md:mb-4">
                                                        <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-none md:line-clamp-2 h-auto md:h-10 md:min-h-[40px] leading-tight cursor-pointer uppercase text-[10px] md:text-sm" onClick={() => setSelectedProduct(product)}>
                                                            {product.name}
                                                        </h3>
                                                        <p className="text-[8px] md:text-[10px] font-black text-slate-300 uppercase tracking-widest mt-0.5 md:mt-1 tracking-tighter">{product.sku}</p>
                                                    </div>

                                                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-1 md:gap-4">
                                                        <div>
                                                            <p className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 flex items-center gap-1">
                                                                {showWholesalePrices ? <Lock className="w-2.5 h-2.5 md:w-3 md:h-3 text-amber-500" /> : <Unlock className="w-2.5 h-2.5 md:w-3 md:h-3 text-blue-500" />}
                                                                {showWholesalePrices ? 'Custo' : 'Venda'}
                                                            </p>
                                                            {(showTotalPrice || showWholesalePrices) && (
                                                                <p className={`text-sm md:text-xl font-black tracking-tighter italic ${showWholesalePrices ? 'text-amber-600' : 'text-slate-900'}`}>
                                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(getPrice(product.wholesalePrice || 0))}
                                                                </p>
                                                            )}
                                                            {showInstallments && !showWholesalePrices && (
                                                                <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                                                                    <p className={`font-bold text-slate-500 ${!showTotalPrice ? 'text-sm md:text-xl font-black italic text-slate-900' : 'text-[9px] md:text-[11px]'}`}>
                                                                        {!showTotalPrice ? '' : 'Ou '} {getProductInstallments(product.id)}x de <span className="text-blue-600">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(getPrice(product.wholesalePrice || 0) / getProductInstallments(product.id))}</span>
                                                                    </p>
                                                                    
                                                                    {/* Override Parcelas Individual */}
                                                                    <div className="flex items-center gap-1 bg-white/80 backdrop-blur-sm px-2 py-0.5 rounded-xl border border-blue-100 shadow-sm">
                                                                        <button 
                                                                            onClick={(e) => { e.stopPropagation(); setProductInstallments(prev => ({ ...prev, [product.id]: Math.max(1, getProductInstallments(product.id) - 1) })); }}
                                                                            className="w-5 h-5 flex items-center justify-center text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                                        >
                                                                            <Minus className="w-3 h-3" />
                                                                        </button>
                                                                        <span className="text-[10px] font-black text-blue-700 min-w-[22px] text-center tracking-tighter">{getProductInstallments(product.id)}x</span>
                                                                        <button 
                                                                            onClick={(e) => { e.stopPropagation(); setProductInstallments(prev => ({ ...prev, [product.id]: getProductInstallments(product.id) + 1 })); }}
                                                                            className="w-5 h-5 flex items-center justify-center text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                                        >
                                                                            <Plus className="w-3 h-3" />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="md:text-right flex md:block items-center justify-between">
                                                            <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest md:mb-1">
                                                                Estoque
                                                            </p>
                                                            <p className="text-[10px] md:text-xs font-black text-slate-900">
                                                                <span className={product.calculatedStock > 10 ? 'text-emerald-500' : 'text-orange-500'}>{product.calculatedStock}</span> <span className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase ml-0.5">UN</span>
                                                            </p>
                                                        </div>
                                                    </div>


                                                    <div className="mt-3 md:mt-6 flex items-center gap-2">
                                                        {cart[product.id] ? (
                                                            <div className="flex-1 flex items-center justify-between bg-slate-50 p-1 rounded-xl md:rounded-2xl border border-slate-100">
                                                                <button onClick={() => removeFromCart(product.id)} className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center bg-white hover:bg-slate-100 text-slate-600 rounded-lg md:rounded-xl shadow-sm transition-all active:scale-90">
                                                                    <X className="w-3 h-3 md:w-4 md:h-4 text-red-400" />
                                                                </button>
                                                                <span className="font-black text-slate-900 text-xs md:text-sm">{cart[product.id]}</span>
                                                                <button 
                                                                    onClick={() => addToCart(product.id, product.calculatedStock)} 
                                                                    disabled={cart[product.id] >= product.calculatedStock}
                                                                    className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center bg-white hover:bg-blue-50 text-blue-600 rounded-lg md:rounded-xl shadow-sm transition-all active:scale-90 disabled:opacity-50"
                                                                >
                                                                    <Plus className="w-3 h-3 md:w-4 md:h-4" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => addToCart(product.id, product.calculatedStock)}
                                                                className="flex-1 bg-slate-900 hover:bg-blue-600 text-white py-2.5 md:py-3.5 rounded-xl md:rounded-2xl font-black text-[9px] md:text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-1.5 md:gap-2 shadow-xl shadow-slate-900/10 hover:shadow-blue-500/30"
                                                            >
                                                                <Plus className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                                                Reservar
                                                            </button>
                                                        )}
                                                    </div>

                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                ) : (
                    /* Aba de Histórico */
                    <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">Minhas Reservas</h2>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Histórico completo de pedidos realizados</p>
                            </div>
                            <button 
                                onClick={fetchReservations}
                                className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-400 hover:text-blue-600"
                                title="Atualizar Lista"
                            >
                                <CheckCircle className={`w-5 h-5 ${loadingReservations ? 'animate-spin' : ''}`} />
                            </button>
                        </div>

                        {loadingReservations ? (
                            <div className="py-32 flex flex-col items-center justify-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Carregando histórico...</p>
                            </div>
                        ) : reservations.length === 0 ? (
                            <div className="py-32 flex flex-col items-center justify-center">
                                <div className="bg-slate-50 p-8 rounded-full mb-4 text-slate-200">
                                    <Package className="w-16 h-16" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-400 uppercase tracking-widest">Nenhuma reserva encontrada</h3>
                                <p className="text-slate-400 text-sm mt-1">Suas reservas aparecerão aqui assim que forem confirmadas</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50/50">
                                            <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Data</th>
                                            <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Produto</th>
                                            <th className="px-8 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Qtd</th>
                                            <th className="px-8 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Status</th>
                                            <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {reservations.map((res) => (
                                            <tr key={res.id} className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="px-8 py-6">
                                                    <p className="text-sm font-black text-slate-900">
                                                        {new Date(res.createdAt).toLocaleDateString('pt-BR')}
                                                    </p>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                        {new Date(res.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200/50 overflow-hidden flex-shrink-0">
                                                            <img 
                                                                src={getDirectImageUrl(res.productImage) || FALLBACK_IMG} 
                                                                alt={res.productName} 
                                                                className="w-full h-full object-contain p-1"
                                                            />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-black text-slate-900 line-clamp-1 uppercase leading-tight italic">{res.productName}</p>
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{res.productCategory}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 text-center">
                                                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-slate-900 text-white text-xs font-black">
                                                        {res.quantity}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-6 text-center">
                                                    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm ${
                                                        res.status === 'EFETIVADA' ? 'bg-emerald-100 text-emerald-600' :
                                                        res.status === 'CANCELADA' ? 'bg-red-100 text-red-600' :
                                                        'bg-blue-100 text-blue-600'
                                                    }`}>
                                                        {res.status}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-6 text-right">
                                                    {res.status === 'PENDENTE' && (
                                                        <button 
                                                            onClick={() => handleCancelReservation(res.id)}
                                                            className="p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all active:scale-95"
                                                            title="Cancelar Reserva"
                                                        >
                                                            <X className="w-5 h-5" />
                                                        </button>
                                                    )}
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

            {/* Cart Sidebar */}
            {isCartOpen && (
                <div className="fixed inset-0 z-[60] flex justify-end">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsCartOpen(false)} />
                    <div className="relative w-full max-w-md bg-white h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
                        <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
                                <ShoppingBag className="w-6 h-6 text-blue-600" /> Minha Reserva
                            </h2>
                            <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 space-y-6">
                            {Object.keys(cart).length === 0 ? (
                                <div className="text-center py-20">
                                    <ShoppingBag className="w-16 h-16 text-slate-100 mx-auto mb-4" />
                                    <p className="text-slate-400 font-bold text-sm">Seu carrinho está vazio.</p>
                                </div>
                            ) : (
                                (Object.entries(cart || {}) as [string, number][]).map(([id, qty]) => {
                                    const p = Array.isArray(products) ? products.find(prod => prod?.id === id) : null;
                                    if (!p) return null;
                                    return (
                                        <div key={id} className="flex gap-4 p-4 bg-slate-50 rounded-3xl border border-slate-100 group relative">
                                            <div className="w-16 h-16 bg-white rounded-2xl overflow-hidden border border-slate-100 shrink-0">
                                                <img src={getDirectImageUrl(p.imageUrl)} className="w-full h-full object-cover" alt={p.name} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-slate-900 text-sm truncate uppercase">{p.name}</h4>
                                                <p className="text-xs font-black text-blue-600 mt-0.5">R$ {getPrice(p.wholesalePrice || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                                
                                                <div className="flex items-center gap-3 mt-3">
                                                    <button onClick={() => removeFromCart(id)} className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors"><Minus className="w-4 h-4" /></button>
                                                    <span className="font-black text-sm text-slate-900 min-w-[20px] text-center">{qty}</span>
                                                    <button 
                                                        onClick={() => {
                                                            const norteWarehouseId = stores.find(s => 
                                                                s.type === 'CD' && s?.name?.toUpperCase().includes('NORTE')
                                                            )?.id || 'W-NORTE';

                                                            const norteStock = (inventory || [])
                                                                .filter(i => i.productId === p.id && i.locationId === norteWarehouseId)
                                                                .reduce((acc: number, i: any) => acc + (i.quantity || 0), 0);
                                                            addToCart(id, norteStock - 3);
                                                        }} 
                                                        className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-blue-500 transition-colors"
                                                    ><Plus className="w-4 h-4" /></button>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] text-slate-400 font-bold uppercase">Subtotal</p>
                                                <p className="font-black text-slate-900 text-sm">R$ {(getPrice(p.wholesalePrice || 0) * (qty as number)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {Object.keys(cart).length > 0 && (
                            <div className="p-8 border-t border-slate-100 bg-slate-50/50">
                                <div className="flex items-center justify-between mb-6">
                                    <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Total da Reserva</p>
                                    <p className="text-2xl font-black text-slate-900">R$ {cartTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                </div>
                                <button
                                    onClick={handleConfirmReservation}
                                    disabled={loading}
                                    className="w-full bg-blue-600 text-white py-5 rounded-3xl font-black uppercase text-sm shadow-2xl shadow-blue-600/30 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                                >
                                    {loading ? <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" /> : <Package className="w-5 h-5" />}
                                    CONFIRMAR RESERVA
                                </button>
                                <p className="text-[10px] text-slate-400 text-center mt-4 font-medium uppercase tracking-tighter">
                                    Ao confirmar, estes itens serão abatidos do estoque principal imediatamente.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
            {/* Modal de Detalhes do Produto */}
            {selectedProduct && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 md:p-4">
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setSelectedProduct(null)}></div>
                    <div className="bg-white w-full max-w-4xl rounded-3xl md:rounded-[3rem] shadow-2xl relative overflow-hidden animate-in zoom-in duration-300 flex flex-col md:flex-row max-h-[95vh] md:max-h-[90vh]">
                        <button 
                            onClick={() => setSelectedProduct(null)}
                            className="absolute top-4 right-4 md:top-6 md:right-6 z-10 w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/90 backdrop-blur-md md:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all shadow-lg"
                        >
                            <X className="w-5 h-5 md:w-6 md:h-6" />
                        </button>

                        {/* Image Side */}
                        <div className="w-full md:w-1/2 h-[40vh] md:h-auto bg-slate-50 relative group overflow-hidden shrink-0">
                            <img 
                                src={getDirectImageUrl(modalImage || selectedProduct.imageUrl || '')} 
                                alt={selectedProduct.name} 
                                className="w-full h-full object-contain p-6 md:p-8 cursor-zoom-in group-hover:scale-105 transition-transform duration-500"
                                onClick={() => setLightboxUrl(modalImage || selectedProduct.imageUrl || null)}
                            />
                            {(selectedProduct.imageUrl2 || selectedProduct.imageUrl) && (
                                <div className="absolute bottom-4 left-4 right-4 flex gap-2 overflow-x-auto no-scrollbar pb-2">
                                     <div 
                                        onClick={() => setModalImage(selectedProduct.imageUrl || '')}
                                        className={`w-14 h-14 md:w-20 md:h-20 shrink-0 rounded-xl md:rounded-2xl border-2 shadow-lg overflow-hidden cursor-pointer active:scale-95 transition-all ${modalImage === selectedProduct.imageUrl ? 'border-blue-500' : 'border-white opacity-70 hover:opacity-100'}`}
                                    >
                                        <img src={getDirectImageUrl(selectedProduct.imageUrl || '')} className="w-full h-full object-contain p-1" alt="" />
                                     </div>
                                     {selectedProduct.imageUrl2 && (
                                        <div 
                                            onClick={() => setModalImage(selectedProduct.imageUrl2 || '')}
                                            className={`w-14 h-14 md:w-20 md:h-20 shrink-0 rounded-xl md:rounded-2xl border-2 shadow-lg overflow-hidden cursor-pointer active:scale-95 transition-all ${modalImage === selectedProduct.imageUrl2 ? 'border-blue-500' : 'border-white opacity-70 hover:opacity-100'}`}
                                        >
                                            <img src={getDirectImageUrl(selectedProduct.imageUrl2 || '')} className="w-full h-full object-contain p-1" alt="" />
                                        </div>
                                     )}
                                </div>
                            )}
                        </div>

                        {/* Info Side */}
                        <div className="w-full md:w-1/2 p-6 md:p-12 overflow-y-auto">
                            <div className="space-y-6 md:space-y-8">
                                <div>
                                    <div className="inline-flex px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest border border-blue-100 mb-3 md:mb-4">
                                        {selectedProduct.category}
                                    </div>
                                    <h2 className="text-xl md:text-3xl font-black text-slate-900 uppercase leading-tight italic">{selectedProduct.name}</h2>
                                    <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mt-1 md:mt-2">SKU: {selectedProduct.sku}</p>
                                </div>

                                {selectedProduct.description && (
                                    <div className="space-y-3 md:space-y-4">
                                        <h3 className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <Info className="w-4 h-4" /> Detalhes do Produto
                                        </h3>
                                        <div className="p-4 md:p-6 bg-slate-50 rounded-2xl md:rounded-3xl text-slate-600 text-xs md:text-sm font-medium leading-relaxed uppercase border border-slate-100">
                                            {selectedProduct.description}
                                        </div>
                                    </div>
                                ) || (
                                    <div className="p-6 bg-slate-50 rounded-3xl text-slate-400 text-xs font-bold uppercase text-center border border-dashed border-slate-200">
                                        Nenhuma descrição disponível
                                    </div>
                                )}

                                <div className="p-6 md:p-8 bg-blue-50 border border-blue-100 rounded-3xl md:rounded-[2.5rem] flex flex-col sm:flex-row sm:items-center justify-between gap-4 md:gap-6">
                                    <div>
                                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                                            {showWholesalePrices ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                                            {showWholesalePrices ? 'Custo' : 'Venda'}
                                        </p>
                                        {(showTotalPrice || showWholesalePrices) && (
                                            <p className={`text-2xl md:text-3xl font-black italic ${showWholesalePrices ? 'text-amber-600' : 'text-blue-600'}`}>
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(getPrice(selectedProduct.wholesalePrice || 0))}
                                            </p>
                                        )}
                                        {showInstallments && !showWholesalePrices && (
                                            <p className={`font-bold text-slate-500 mt-1 ${!showTotalPrice ? 'text-2xl md:text-3xl font-black italic text-blue-600' : 'text-[10px] md:text-sm'}`}>
                                                {!showTotalPrice ? '' : 'Ou '} {installmentCount}x de <span className="text-blue-600">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(getPrice(selectedProduct.wholesalePrice || 0) / installmentCount)}</span> {!showTotalPrice ? '' : ''}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2">
                                        <button 
                                            onClick={() => handleShareWhatsApp(selectedProduct)}
                                            disabled={sharingLoading === selectedProduct.id}
                                            className="px-4 py-2.5 md:p-3 bg-emerald-50 text-emerald-600 rounded-xl md:rounded-2xl hover:bg-emerald-100 transition-colors flex items-center gap-2 text-[9px] md:text-[10px] font-black uppercase tracking-widest shrink-0 disabled:opacity-50"
                                        >
                                            {sharingLoading === selectedProduct.id ? (
                                                <div className="w-3.5 h-3.5 md:w-4 md:h-4 border-2 border-emerald-600/50 border-t-emerald-600 rounded-full animate-spin" />
                                            ) : (
                                                <Share2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                            )} 
                                            <span className="sm:hidden lg:inline">Compartilhar Imagem</span>
                                        </button>
                                        <div className="text-right">
                                            <p className="text-[8px] md:text-[10px] font-black text-blue-400 uppercase tracking-widest">Disponível</p>
                                            <p className="text-sm md:text-xl font-black text-slate-900 uppercase">
                                                {filteredProducts.find(p => p.id === selectedProduct.id)?.calculatedStock || 0} UN
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Lightbox Fullscreen */}
            {lightboxUrl && (
                <div 
                    className="fixed inset-0 z-[200] bg-slate-950/95 backdrop-blur-3xl flex items-center justify-center p-4 animate-in fade-in duration-300 pointer-events-auto"
                    onClick={() => setLightboxUrl(null)}
                >
                    <button className="absolute top-8 right-8 text-white/50 hover:text-white transition-colors">
                        <X className="w-12 h-12" />
                    </button>
                    <img 
                        src={getDirectImageUrl(lightboxUrl)} 
                        alt="Fullscreen" 
                        className="max-w-full max-h-full object-contain rounded-3xl animate-in zoom-in-95 duration-500"
                    />
                </div>
            )}

            {/* Modal de Configuração de Margem */}
            {isMarkupModalOpen && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xl animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] animate-in zoom-in-95 duration-500 border border-slate-100 relative group">
                        {/* Glow effect */}
                        <div className="absolute -inset-1 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[3rem] opacity-5 blur-2xl transition duration-500 group-hover:opacity-10"></div>
                        
                        <button onClick={() => setIsMarkupModalOpen(false)} className="absolute top-6 right-6 p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-all">
                            <X className="w-5 h-5" />
                        </button>

                        <div className="text-center mb-10 relative">
                            <div className="w-20 h-20 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-sm border border-blue-100/50">
                                <Settings className="w-10 h-10 text-blue-600 animate-[spin_8s_linear_infinite]" />
                            </div>
                            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight italic">Configurações</h3>
                            <p className="text-[10px] font-black text-slate-400 uppercase mt-2 tracking-[0.2em]">Personalize seu catálogo</p>
                        </div>
                        
                        <div className="space-y-8 relative">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Margem de Lucro</label>
                                    <div className="relative group/input">
                                        <div className="absolute inset-0 bg-blue-600 opacity-0 group-focus-within/input:opacity-5 rounded-2xl transition-opacity pointer-events-none"></div>
                                        <input 
                                            type="text" 
                                            inputMode="decimal"
                                            className="w-full px-8 py-5 bg-white border-2 border-blue-100 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 transition-all font-black text-center text-3xl text-black placeholder:text-slate-900 z-10 relative"
                                            placeholder="0"
                                            value={markup === 0 ? '' : markup}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(',', '.');
                                                if (val === '' || !isNaN(Number(val))) {
                                                    setMarkup(val === '' ? 0 : Number(val));
                                                }
                                            }}
                                        />
                                        <span className="absolute right-8 top-1/2 -translate-y-1/2 font-black text-blue-600 text-2xl pointer-events-none z-20">%</span>
                                    </div>
                            </div>

                            <div className="p-6 bg-slate-50/80 rounded-[2rem] border border-slate-100/50 space-y-5">
                                <label className="flex items-center justify-between cursor-pointer group/toggle">
                                    <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest group-hover/toggle:text-blue-600 transition-colors">Exibir Preço Total</span>
                                    <div className="relative inline-flex items-center">
                                        <input 
                                            type="checkbox" 
                                            className="sr-only peer" 
                                            checked={showTotalPrice}
                                            onChange={() => setShowTotalPrice(!showTotalPrice)}
                                        />
                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 shadow-inner flex-shrink-0"></div>
                                    </div>
                                </label>

                                <label className="flex items-center justify-between cursor-pointer group/toggle">
                                    <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest group-hover/toggle:text-blue-600 transition-colors">Exibir Parcelado</span>
                                    <div className="relative inline-flex items-center">
                                        <input 
                                            type="checkbox" 
                                            className="sr-only peer" 
                                            checked={showInstallments}
                                            onChange={() => setShowInstallments(!showInstallments)}
                                        />
                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 shadow-inner flex-shrink-0"></div>
                                    </div>
                                </label>

                                {showInstallments && (
                                    <div className="space-y-3 animate-in slide-in-from-top-2 duration-300 pt-2 border-t border-slate-200/50">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Default de Parcelas</label>
                                        <div className="relative group/input">
                                            <input 
                                                type="number"
                                                className="w-full px-6 py-4 bg-white border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 transition-all font-black text-center text-2xl text-slate-900 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                value={installmentCount}
                                                onChange={(e) => setInstallmentCount(Number(e.target.value))}
                                            />
                                            <span className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-blue-500 text-xl italic uppercase pointer-events-none">x</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <button 
                                onClick={() => setIsMarkupModalOpen(false)} 
                                className="w-full py-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-black uppercase text-xs hover:from-blue-700 hover:to-indigo-700 transition-all shadow-xl shadow-blue-500/20 tracking-[0.2em] active:scale-[0.98] ring-offset-2 focus:ring-2 focus:ring-blue-500"
                            >
                                Salvar Configurações
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Action Bar */}
            {selectedProducts.size > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[80] w-[92%] md:w-auto animate-in slide-in-from-bottom duration-700">
                    <div className="bg-slate-900/95 text-white px-6 md:px-12 py-5 rounded-[3rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex items-center justify-between gap-10 backdrop-blur-2xl border border-white/10 relative overflow-hidden group">
                        {/* Shimmer effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                        
                        <div className="flex items-center gap-5 relative">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center font-black text-lg shadow-lg shadow-blue-500/30 animate-in zoom-in duration-500">
                                {selectedProducts.size}
                            </div>
                            <div className="hidden sm:block">
                                <p className="text-xs font-black uppercase tracking-[0.2em] leading-none italic">Produtos Selecionados</p>
                                <p className="text-[10px] text-slate-400 mt-1.5 uppercase font-bold tracking-widest">Condição {installmentCount}x default</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-4 relative">
                            <button 
                                onClick={() => {
                                    setSelectedProducts(new Set());
                                    setIsSelectionMode(false);
                                }}
                                className="px-6 py-3 rounded-2xl border border-white/10 hover:bg-white/5 text-[10px] font-black uppercase tracking-[0.2em] transition-all active:scale-95"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleBulkDownload}
                                disabled={loading}
                                className="px-10 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-blue-500/40 transition-all flex items-center gap-3 active:scale-95 disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 shadow-sm" />}
                                <span className="hidden xs:inline">Gerar Todos</span>
                                <span className="xs:hidden">Gerar</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WholesaleCatalog;
