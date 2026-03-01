
import React, { useState, useEffect } from 'react';
import { Employee, Store, OrderStatus, Sale, Product, Customer, SaleItem, Payment, InventoryItem } from '../types.ts';
import { Search, Plus, Eye, X, ShoppingCart, User, Package, CheckCircle2, ArrowLeft, Trash2, AlertCircle, CreditCard, DollarSign, Box, Filter } from 'lucide-react';
import SaleReceipt from './SaleReceipt.tsx';
import CustomerModal from '../components/CustomerModal.tsx';

import { supabaseService } from '../services/supabaseService.ts';

interface SalesProps {
  user?: any;
  sales: Sale[];
  setSales: React.Dispatch<React.SetStateAction<Sale[]>>;
  inventory: InventoryItem[];
  setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  stores: Store[];
  products: Product[];
  customers: Customer[];
  employees: Employee[];
}

const Sales: React.FC<SalesProps> = ({ user, sales, setSales, inventory, setInventory, stores, products, customers, employees }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  const [newSale, setNewSale] = useState<Partial<Sale>>({
    customerName: '',
    items: [],
    payments: [{ method: 'Dinheiro', amount: 0 }],
    storeId: user?.storeId || stores[0]?.id || '',
    sellerId: (user?.role === 'VENDEDOR' || user?.role === 'GERENTE') ? user.id : (employees.find(e => e.role === 'VENDEDOR' || e.role === 'GERENTE')?.id || ''),
    deliveryAddress: '',
    deliveryObs: '',
    assemblyRequired: false
  });
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [isManagerOverrideNeeded, setIsManagerOverrideNeeded] = useState(false);
  const [managerLogin, setManagerLogin] = useState({ username: '', password: '' });
  const [managerError, setManagerError] = useState('');
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [cancelRequest, setCancelRequest] = useState<{ saleId: string; justification: string } | null>(null);

  const handleCustomerCreated = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsCustomerModalOpen(false);
  };

  const getStock = (productId: string, locationId?: string) => {
    if (locationId) {
      return inventory.find(i => i.productId === productId && i.locationId === locationId)?.quantity || 0;
    }
    return inventory.filter(i => i.productId === productId).reduce((acc, i) => acc + i.quantity, 0);
  };

  const handlePriceChange = (productId: string, newPrice: number) => {
    setNewSale(prev => {
      const updatedItems = prev.items?.map(item => {
        if (item.productId === productId) {
          const product = products.find(p => p.id === productId);
          if (!product) return item;
          const discount = ((product.price - newPrice) / product.price) * 100;
          return { ...item, price: newPrice, discount: Math.max(0, discount) };
        }
        return item;
      });
      return { ...prev, items: updatedItems };
    });
  };

  const handleDiscountChange = (productId: string, newDiscount: number) => {
    setNewSale(prev => {
      const updatedItems = prev.items?.map(item => {
        if (item.productId === productId) {
          const product = products.find(p => p.id === productId);
          if (!product) return item;
          const newPrice = product.price * (1 - newDiscount / 100);
          return { ...item, discount: newDiscount, price: newPrice };
        }
        return item;
      });
      return { ...prev, items: updatedItems };
    });
  };

  const filteredSales = (sales || []).filter(s => {
    const matchesSearch = (s.customerName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (s.id?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    if (user?.role === 'GERENTE') {
      return matchesSearch && matchesStatus && s.storeId === user.storeId;
    }
    return matchesSearch && matchesStatus;
  });

  const handleAddItem = (product: Product) => {
    const existing = newSale.items?.find(i => i.productId === product.id);
    if (existing) {
      // Só valida ao AUMENTAR a qtd além do saldo do CD já selecionado no item
      const availableQty = inventory.find(i => i.productId === product.id && i.locationId === existing.locationId)?.quantity || 0;
      if (existing.quantity + 1 > availableQty) {
        const locationName = stores.find(s => s.id === existing.locationId)?.name || existing.locationId;
        alert(`Saldo insuficiente em "${locationName}"! Disponível: ${availableQty} un.`);
        return;
      }
      setNewSale({
        ...newSale,
        items: newSale.items?.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      });
    } else {
      // Ao adicionar pela 1ª vez: seleciona automaticamente o CD com saldo
      // Prefere o CD da loja atual se tiver saldo, senão usa o primeiro com saldo
      const stockLocations = inventory.filter(i => i.productId === product.id && i.quantity > 0);
      const preferred = stockLocations.find(i => i.locationId === newSale.storeId) || stockLocations[0];
      const defaultLocationId = preferred?.locationId || newSale.storeId || (stores[0]?.id || '');

      const newItem: SaleItem = {
        productId: product.id,
        quantity: 1,
        price: product.price,
        discount: 0,
        originalPrice: product.price,
        locationId: defaultLocationId,
        assemblyRequired: false
      };
      setNewSale({ ...newSale, items: [...(newSale.items || []), newItem] });
    }
  };


  const handleRemoveItem = (productId: string) => {
    setNewSale({
      ...newSale,
      items: newSale.items?.filter(i => i.productId !== productId)
    });
  };

  const calculateTotal = () => {
    return newSale.items?.reduce((acc, item) => acc + (item.price * item.quantity), 0) || 0;
  };

  const calculatePaymentsTotal = () => {
    return newSale.payments?.reduce((acc, p) => acc + p.amount, 0) || 0;
  };

  const handleAddPayment = () => {
    const remaining = calculateTotal() - calculatePaymentsTotal();
    setNewSale({
      ...newSale,
      payments: [...(newSale.payments || []), { method: 'Dinheiro', amount: Math.max(0, remaining) }]
    });
  };

  const handleRemovePayment = (index: number) => {
    setNewSale({
      ...newSale,
      payments: newSale.payments?.filter((_, i) => i !== index)
    });
  };

  const handlePaymentChange = (index: number, field: keyof Payment, value: any) => {
    setNewSale({
      ...newSale,
      payments: newSale.payments?.map((p, i) => i === index ? { ...p, [field]: value } : p)
    });
  };

  const handleManagerLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setManagerError('');
    const manager = employees.find(emp =>
      emp.username === managerLogin.username &&
      emp.password === managerLogin.password &&
      emp.role === 'GERENTE' &&
      emp.storeId === newSale.storeId
    );
    if (manager) {
      setIsManagerOverrideNeeded(false);
      setManagerLogin({ username: '', password: '' });
      completeSale();
    } else {
      setManagerError('Usuário ou senha de gerente incorretos ou gerente de outra unidade.');
    }
  };

  const handleCancelSale = async (saleId: string, justification: string) => {
    try {
      const sale = sales.find(s => s.id === saleId);
      await supabaseService.markSaleCancelPending(saleId);
      setSales(prev => prev.map(s => s.id === saleId ? { ...s, status: OrderStatus.CANCEL_PENDING } : s));

      await supabaseService.createTask({
        title: `Autorização de Cancelamento — Venda Nº ${saleId}`,
        description: `A venda Nº ${saleId} (Cliente: ${sale?.customerName || '?'}, Total: R$ ${sale?.total?.toFixed(2) || '0,00'}) solicitada para cancelamento por ${user?.name || 'operador'} (${user?.role}).\n\nJustificativa: ${justification}\n\nProdutos: ${sale?.items?.map(i => products.find(p => p.id === i.productId)?.name).filter(Boolean).join(', ')}\n\nApós autorizar, escolha o CD para devolução do saldo.`,
        type: 'CANCELAMENTO_PENDENTE',
        priority: 'ALTA',
        status: 'ABERTA',
        created_by: user?.name || 'Sistema',
        assigned_to: 'MASTER',
        store_id: sale?.storeId || user?.storeId || '',
        sale_id: saleId,
        product_name: sale?.items?.map(i => products.find(p => p.id === i.productId)?.name).filter(Boolean).join(', ') || '',
      });

      setCancelRequest(null);
      alert('Solicitação de cancelamento enviada! Aguarde autorização do MASTER/SUPERVISOR na tela de Tarefas/Avisos.');
    } catch (err) {
      console.error('Erro ao solicitar cancelamento:', err);
      alert('Erro ao solicitar cancelamento.');
    }
  };


  const handleConfirmPayment = async (saleId: string, amount: number) => {
    try {
      await supabaseService.confirmPaymentStatus(saleId, amount);
      setSales(prev => prev.map(s => {
        if (s.id === saleId) {
          return {
            ...s,
            payments: s.payments.map(p =>
              (p.method === 'Entrega' && p.amount === amount) ? { ...p, status: 'CONFERIDO' } : p
            )
          }
        }
        return s;
      }));
      alert('Pagamento recebido e conferido!');
    } catch (e) {
      console.error('Erro ao confirmar recebimento:', e);
      alert('Erro ao confirmar recebimento.');
    }
  };

  const completeSale = async () => {
    if (!selectedCustomer || !newSale.items?.length) return;
    // ID sequencial a partir de 101
    const existingNums = (sales || []).map(s => parseInt(s.id)).filter(n => !isNaN(n));
    const lastIdNum = existingNums.length > 0 ? Math.max(...existingNums) : 100;
    const nextId = (lastIdNum + 1).toString();

    const sale: Sale = {
      id: nextId,
      date: new Date().toISOString(),
      customerName: selectedCustomer.name,
      customerCpf: selectedCustomer.document,
      customerPhone: selectedCustomer.phone,
      customerEmail: selectedCustomer.email,
      customerReference: selectedCustomer.reference,
      storeId: newSale.storeId || (stores[0]?.id ?? ''),
      // Use null-safe sellerId to avoid FK violation when empty
      sellerId: newSale.sellerId || user?.id || '',
      items: newSale.items as SaleItem[],
      payments: newSale.payments as Payment[],
      total: calculateTotal(),
      status: OrderStatus.PENDING,
      deliveryAddress: selectedCustomer.address + (selectedCustomer.number ? ', ' + selectedCustomer.number : '') + (selectedCustomer.neighborhood ? ' - ' + selectedCustomer.neighborhood : ''),
      deliveryObs: newSale.deliveryObs || '',
      assemblyRequired: newSale.items?.some(i => i.assemblyRequired) || false,
    };

    try {
      await supabaseService.createSale(sale);
      const inventoryUpdates = sale.items.map(item => {
        const currentQty = inventory.find(i => i.productId === item.productId && i.locationId === item.locationId)?.quantity || 0;
        const locationStore = stores.find(s => s.id === item.locationId);
        const storeType = locationStore?.type || 'STORE_STOCK';
        return supabaseService.updateInventory(item.productId, item.locationId, Math.max(0, currentQty - item.quantity), storeType);
      });
      await Promise.all(inventoryUpdates);


      // Criar avisos automáticos para itens vendidos de outra loja
      const crossStoreItems = sale.items.filter(item => item.locationId && item.locationId !== sale.storeId);
      const saleStoreName = stores.find(s => s.id === sale.storeId)?.name || sale.storeId;
      if (crossStoreItems.length > 0) {
        const notificationPromises = crossStoreItems.map(item => {
          const productName = products.find(p => p.id === item.productId)?.name || item.productId;
          const sourceStoreName = stores.find(s => s.id === item.locationId)?.name || item.locationId;
          return supabaseService.createTask({
            title: `Produto vendido de ${sourceStoreName}`,
            description: `A loja "${saleStoreName}" vendeu ${item.quantity}x "${productName}" do estoque de "${sourceStoreName}".\nCliente: ${sale.customerName}\nVenda Nº ${sale.id}`,
            type: 'AVISO_SAIDA_ESTOQUE',
            priority: 'ALTA',
            status: 'ABERTA',
            created_by: user?.name || 'Sistema',
            assigned_to: 'GERENTE',
            store_id: item.locationId, // Loja que é dona do estoque (exibição no gerente dessa loja)
            source_store_id: item.locationId,
            sale_id: sale.id,
            product_name: productName,
          });
        });
        await Promise.all(notificationPromises);
      }

      setSales([sale, ...sales]);
      setInventory(prev => {
        const updated = [...prev];
        sale.items.forEach(item => {
          const index = updated.findIndex(i => i.productId === item.productId && i.locationId === item.locationId);
          if (index !== -1) updated[index] = { ...updated[index], quantity: Math.max(0, updated[index].quantity - item.quantity) };
        });
        return updated;
      });
      setIsCreating(false);
      setNewSale({
        items: [],
        payments: [{ method: 'Dinheiro', amount: 0 }],
        storeId: user?.storeId || stores[0]?.id || '',
        sellerId: (user?.role === 'VENDEDOR' || user?.role === 'GERENTE') ? user.id : (employees.find(e => e.role === 'VENDEDOR' || e.role === 'GERENTE')?.id || ''),
        deliveryAddress: '',
        deliveryObs: '',
        assemblyRequired: false
      });
      setSelectedCustomer(null);
    } catch (err: any) {
      console.error("Erro ao salvar venda:", err);
      const msg = err?.message || JSON.stringify(err);
      alert(`Erro ao salvar venda no banco de dados.\n${msg}`);
    }
  };

  const handleSaveSale = () => {
    if (!selectedCustomer || !newSale.items?.length) return;
    const total = calculateTotal();
    const paymentsTotal = calculatePaymentsTotal();
    if (Math.abs(total - paymentsTotal) > 0.01) {
      alert(`O total dos pagamentos deve ser igual ao total do pedido`);
      return;
    }
    const hasHighDiscount = newSale.items.some(item => item.discount > 10);
    if (hasHighDiscount) setIsManagerOverrideNeeded(true);
    else completeSale();
  };

  if (selectedSale) {
    return <SaleReceipt
      sale={selectedSale}
      onBack={() => setSelectedSale(null)}
      stores={stores}
      products={products}
      employees={employees}
      customers={customers}
    />;
  }

  if (isCreating) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <header className="flex items-center gap-4">
          <button onClick={() => setIsCreating(false)} className="p-2 hover:bg-white rounded-full transition-colors"><ArrowLeft className="w-6 h-6" /></button>
          <div><h1 className="text-2xl font-bold text-slate-900">Nova Venda</h1></div>
        </header>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-black text-slate-400 uppercase flex items-center gap-2"><User className="w-4 h-4" /> Cliente</h3>
                <button onClick={() => setIsCustomerModalOpen(true)} className="text-blue-600 font-bold text-xs uppercase">+ Novo Cliente</button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar por nome, CPF ou telefone..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-blue-500 font-bold text-sm"
                  value={customerSearch || (selectedCustomer ? selectedCustomer.name : '')}
                  onFocus={() => { setCustomerSearch(''); setCustomerDropdownOpen(true); }}
                  onChange={e => { setCustomerSearch(e.target.value); setSelectedCustomer(null); setCustomerDropdownOpen(true); }}
                  onBlur={() => setTimeout(() => setCustomerDropdownOpen(false), 200)}
                />
                {customerDropdownOpen && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-60 overflow-y-auto">
                    {(customers || [])
                      .filter(c => {
                        const q = customerSearch.toLowerCase();
                        return !q ||
                          c.name.toLowerCase().includes(q) ||
                          (c.document || '').toLowerCase().includes(q) ||
                          (c.phone || '').toLowerCase().includes(q);
                      })
                      .slice(0, 30)
                      .map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onMouseDown={() => { setSelectedCustomer(c); setCustomerSearch(''); setCustomerDropdownOpen(false); }}
                          className="w-full px-4 py-2.5 text-left hover:bg-blue-50 transition-colors"
                        >
                          <p className="font-bold text-xs text-slate-900 uppercase">{c.name}</p>
                          <p className="text-[10px] text-slate-400 font-medium">{c.document} {c.phone ? `· ${c.phone}` : ''}</p>
                        </button>
                      ))
                    }
                    {(customers || []).filter(c => {
                      const q = customerSearch.toLowerCase();
                      return !q || c.name.toLowerCase().includes(q) || (c.document || '').toLowerCase().includes(q) || (c.phone || '').toLowerCase().includes(q);
                    }).length === 0 && (
                        <p className="px-4 py-3 text-xs text-slate-400 font-medium">Nenhum cliente encontrado</p>
                      )}
                  </div>
                )}
                {selectedCustomer && (
                  <div className="mt-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black text-blue-700 uppercase">{selectedCustomer.name}</p>
                      <p className="text-[10px] text-blue-500 font-medium">{selectedCustomer.document} {selectedCustomer.phone ? `· ${selectedCustomer.phone}` : ''}</p>
                    </div>
                    <button type="button" onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); }} className="text-blue-400 hover:text-blue-600 text-xs font-bold">✕</button>
                  </div>
                )}
              </div>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <h3 className="text-sm font-black text-slate-400 uppercase mb-4 flex items-center gap-2"><Package className="w-4 h-4" /> Itens do Pedido</h3>
              <div className="relative mb-4"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="text" placeholder="Buscar produto..." className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-2xl text-sm" value={productSearch} onChange={e => setProductSearch(e.target.value)} /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                {products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || (p.sku || '').toLowerCase().includes(productSearch.toLowerCase())).map(p => {
                  const totalStock = inventory.filter(i => i.productId === p.id).reduce((acc: number, i) => acc + (i.quantity || 0), 0);
                  const hasStock = totalStock > 0;
                  return (
                    <div key={p.id} className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all ${hasStock ? 'bg-slate-50 border-slate-100 hover:border-blue-100 hover:bg-blue-50' : 'bg-slate-50/50 border-slate-100 opacity-60'}`}>
                      <div className="w-8 h-8 bg-white rounded-lg overflow-hidden border shrink-0">
                        <img src={p.imageUrl || p.images?.[0]?.url} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-black uppercase truncate text-slate-800">{p.name}</p>
                        <p className="text-blue-600 font-bold text-[10px]">R$ {p.price.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${hasStock ? 'text-emerald-700 bg-emerald-50' : 'text-red-500 bg-red-50'}`}>
                          SALDO: {totalStock}
                        </span>
                        {hasStock && (
                          <button onClick={() => handleAddItem(p)} className="w-6 h-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center transition-all">
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {(newSale.items?.length || 0) > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Box className="w-3 h-3" /> Itens do Pedido</p>
                  {newSale.items?.map(item => {
                    const p = products.find(prod => prod.id === item.productId);
                    const itemStocks = inventory.filter(i => i.productId === item.productId && i.quantity > 0);
                    return (
                      <div key={item.productId} className="bg-white border border-slate-100 rounded-2xl p-3 space-y-2">
                        <p className="text-[10px] font-black uppercase text-blue-700 truncate">{p?.name}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <input type="number" min="1" className="w-14 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-center" value={item.quantity} onChange={e => {
                            const newQty = parseInt(e.target.value) || 1;
                            const availableQty = inventory.find(inv => inv.productId === item.productId && inv.locationId === item.locationId)?.quantity || 0;
                            if (newQty > availableQty) {
                              const locationName = stores.find(s => s.id === item.locationId)?.name || item.locationId;
                              alert(`Saldo insuficiente em "${locationName}"! Disponível: ${availableQty} un.`);
                              return;
                            }
                            setNewSale({ ...newSale, items: newSale.items?.map(i => i.productId === item.productId ? { ...i, quantity: newQty } : i) });
                          }} />
                          <span className="text-[10px] text-slate-400 font-bold">x</span>
                          <input type="number" className="w-20 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold" value={item.price} onChange={e => handlePriceChange(item.productId, parseFloat(e.target.value) || 0)} />
                          <span className="text-[9px] text-slate-400 font-bold">Desc.</span>
                          <input type="number" min="0" max="100" className="w-12 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold" value={Math.round(item.discount)} onChange={e => handleDiscountChange(item.productId, parseFloat(e.target.value) || 0)} />
                          <span className="text-[9px] text-slate-400 font-bold">%</span>
                          <select className="flex-1 min-w-[130px] px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold outline-none" value={item.locationId} onChange={e => setNewSale({ ...newSale, items: newSale.items?.map(i => i.productId === item.productId ? { ...i, locationId: e.target.value } : i) })}>
                            {itemStocks.map(s => { const sn = stores.find(st => st.id === s.locationId)?.name || s.locationId; return <option key={s.locationId} value={s.locationId}>{sn} (Saldo: {s.quantity})</option>; })}
                            {itemStocks.length === 0 && <option value={item.locationId}>Sem estoque</option>}
                          </select>
                          <label className="flex items-center gap-1 cursor-pointer shrink-0">
                            <input type="checkbox" className="w-3.5 h-3.5 rounded" checked={item.assemblyRequired} onChange={e => setNewSale({ ...newSale, items: newSale.items?.map(i => i.productId === item.productId ? { ...i, assemblyRequired: e.target.checked } : i) })} />
                            <span className="text-[9px] font-bold text-slate-600">Montagem</span>
                          </label>
                          <button onClick={() => handleRemoveItem(item.productId)} className="p-1 text-red-400 hover:text-red-600 ml-auto"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex justify-between items-center pt-1 px-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase">Subtotal Itens</span>
                    <span className="text-sm font-black text-slate-900">R$ {calculateTotal().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="space-y-4">
            {/* Card PAGAMENTO */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-slate-400" />
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Pagamento</h3>
              </div>
              <div className="px-5 py-3">
                <div className="grid grid-cols-[1fr_auto_auto] gap-2 text-[9px] font-black text-slate-400 uppercase mb-2 px-1">
                  <span>Forma</span><span>Valor</span><span></span>
                </div>
                <div className="space-y-2">
                  {newSale.payments?.map((p, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
                      <select className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-blue-400" value={p.method} onChange={e => handlePaymentChange(idx, 'method', e.target.value)}>
                        <option value="Dinheiro">Dinheiro</option>
                        <option value="Cartão Débito">Débito</option>
                        <option value="Cartão Crédito">Crédito</option>
                        <option value="PIX">PIX</option>
                        <option value="Entrega">Receber na Entrega</option>
                      </select>
                      <input type="number" className="w-24 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-blue-400" value={p.amount} onChange={e => handlePaymentChange(idx, 'amount', parseFloat(e.target.value) || 0)} />
                      <button onClick={() => handleRemovePayment(idx)} className="p-1.5 text-red-400 hover:text-red-600 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button onClick={handleAddPayment} className="mt-3 w-full py-2 text-blue-600 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-blue-50 rounded-xl transition-all">
                  <Plus className="w-3.5 h-3.5" /> Adicionar Pagamento
                </button>
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100">
                  <span className="text-xs font-bold text-slate-500">Total Pago:</span>
                  <span className={`text-sm font-black ${Math.abs(calculatePaymentsTotal() - calculateTotal()) < 0.01 && calculateTotal() > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    R$ {calculatePaymentsTotal().toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Card CHECKOUT */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-slate-400" />
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Checkout</h3>
              </div>
              <div className="px-5 py-4">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total do Pedido</span>
                  <span className="text-3xl font-black text-blue-700">R$ {calculateTotal().toFixed(2)}</span>
                </div>
                <button onClick={handleSaveSale} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-emerald-200 transition-all active:scale-95 flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-5 h-5" /> Finalizar Venda
                </button>
              </div>
            </div>

            {/* Card OBSERVAÇÕES */}
            <div className="bg-slate-900 rounded-2xl p-5">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Observações de Entrega</p>
              <textarea
                rows={4}
                placeholder="Instruções para o entregador..."
                className="w-full bg-transparent text-slate-300 text-xs font-medium placeholder-slate-600 resize-none outline-none"
                value={newSale.deliveryObs || ''}
                onChange={e => setNewSale({ ...newSale, deliveryObs: e.target.value })}
              />
            </div>
          </div>
        </div>
        {isCustomerModalOpen && <CustomerModal isOpen={isCustomerModalOpen} onClose={() => setIsCustomerModalOpen(false)} onCustomerCreated={handleCustomerCreated} />}
        {isManagerOverrideNeeded && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
            <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
              <h3 className="text-lg font-black text-slate-900 uppercase mb-2">Desconto Elevado</h3>
              <p className="text-xs text-slate-500 font-medium mb-6 uppercase">Ação requer autorização do gerente</p>
              <form onSubmit={handleManagerLogin} className="space-y-4">
                <input required type="text" placeholder="Usuário do Gerente" className="w-full px-4 py-3 bg-slate-50 border rounded-2xl" value={managerLogin.username} onChange={e => setManagerLogin({ ...managerLogin, username: e.target.value })} />
                <input required type="password" placeholder="Senha" className="w-full px-4 py-3 bg-slate-50 border rounded-2xl" value={managerLogin.password} onChange={e => setManagerLogin({ ...managerLogin, password: e.target.value })} />
                {managerError && <p className="text-red-500 text-[10px] font-bold uppercase">{managerError}</p>}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setIsManagerOverrideNeeded(false)} className="flex-1 py-3 text-slate-500 font-bold uppercase text-xs">Cancelar</button>
                  <button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs shadow-lg shadow-blue-100">Autorizar</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Vendas e Pedidos</h1>
          <p className="text-slate-500">Histórico completo e novo pedido sequencial</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsCreating(true)} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 font-bold shadow-lg shadow-slate-200 transition-all active:scale-95"><Plus className="w-5 h-5" /> Nova Venda</button>
        </div>
      </header>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="text" placeholder="Buscar venda ou cliente..." className="w-full pl-10 pr-4 py-2 bg-slate-50 rounded-xl text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
          <div className="flex gap-2">
            <div className="relative"><Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select className="pl-10 pr-4 py-2 bg-slate-50 rounded-xl text-sm uppercase font-bold" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="all">Todos Status</option>
                {Object.values(OrderStatus).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Nº</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Cliente</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Unidade</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSales.map(sale => (
                <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-black text-blue-600 text-sm">{sale.id}</td>
                  <td className="px-6 py-4"><p className="font-medium text-slate-700 text-sm uppercase">{sale.customerName}</p><p className="text-[10px] text-slate-400">{new Date(sale.date).toLocaleDateString()}</p></td>
                  <td className="px-6 py-4"><span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded-md">{stores.find(s => s.id === sale.storeId)?.name}</span></td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-black border uppercase ${sale.status === OrderStatus.CANCELED ? 'bg-red-50 text-red-600 border-red-100' : sale.status === OrderStatus.COMPLETED ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                      {sale.status}
                    </span>
                    {sale.payments?.some(p => p.status === 'AGUARDANDO_ACERTO') && (
                      <div className="mt-1">
                        <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 uppercase animate-pulse">
                          PEDIDO ENTREGUE - AGUARDANDO CONFERÊNCIA
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => setSelectedSale(sale)} className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-black uppercase"><Eye className="w-4 h-4" /> Ver</button>
                      {(user?.role === 'ADMIN' || user?.role === 'SUPERVISOR' || user?.username === 'Master') && sale.payments?.some(p => p.status === 'AGUARDANDO_ACERTO') && (
                        <button onClick={() => { const p = sale.payments.find(p => p.status === 'AGUARDANDO_ACERTO'); if (p) handleConfirmPayment(sale.id, p.amount); }} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-black uppercase shadow-sm"><DollarSign className="w-4 h-4" /> Receber</button>
                      )}
                      {/* Botão Pago na Loja para gerentes — pagamento de entrega recebido no balcão */}
                      {sale.payments?.some(p => p.method === 'Entrega' && (p.status === 'PENDENTE_ENTREGA' || p.status === 'AGUARDANDO_ACERTO')) &&
                        (user?.role === 'GERENTE' || user?.role === 'ADMIN' || user?.role === 'SUPERVISOR' || user?.username === 'Master') && (
                          <button
                            onClick={async () => {
                              const p = sale.payments.find(p => p.method === 'Entrega' && (p.status === 'PENDENTE_ENTREGA' || p.status === 'AGUARDANDO_ACERTO'));
                              if (!p) return;
                              if (!window.confirm(`Confirmar que o cliente pagou R$ ${p.amount.toFixed(2)} na loja? O motorista NÃO deve cobrar na entrega.`)) return;
                              try {
                                await supabaseService.markPaymentPaidAtStore(sale.id, p.amount);
                                setSales(prev => prev.map(s => s.id === sale.id ? { ...s, payments: s.payments.map(pay => pay.method === 'Entrega' && pay.amount === p.amount ? { ...pay, status: 'PAGO_EM_LOJA' as any } : pay) } : s));
                              } catch { alert('Erro ao registrar pagamento na loja.'); }
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 bg-violet-50 text-violet-700 rounded-lg text-xs font-black uppercase border border-violet-200"
                          >
                            <DollarSign className="w-4 h-4" /> Pago na Loja
                          </button>
                        )}
                      {sale.payments?.some(p => p.method === 'Entrega' && p.status === 'PAGO_EM_LOJA') && (
                        <span className="text-[9px] font-black text-violet-700 bg-violet-50 px-2 py-1 rounded border border-violet-200 uppercase">Pago na Loja</span>
                      )}
                      {(user?.username === 'Master' || user?.role === 'SUPERVISOR' || (user?.role === 'GERENTE' && sale.storeId === user?.storeId)) &&
                        sale.status !== OrderStatus.CANCELED && sale.status !== OrderStatus.CANCEL_PENDING && (
                          <button onClick={() => setCancelRequest({ saleId: sale.id, justification: '' })} className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-black uppercase"><Trash2 className="w-4 h-4" /> Cancelar</button>
                        )}
                      {sale.status === OrderStatus.CANCEL_PENDING && (
                        <span className="text-[9px] font-black text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-100 uppercase">Aguard. Autorização</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Justificativa de Cancelamento */}
      {cancelRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-red-50 border-b border-red-100 flex justify-between items-center">
              <div>
                <h2 className="text-base font-black text-red-800 uppercase">Solicitar Cancelamento</h2>
                <p className="text-[10px] text-red-500 font-medium">Venda Nº {cancelRequest.saleId} · Será enviada para autorização do MASTER/SUPERVISOR</p>
              </div>
              <button onClick={() => setCancelRequest(null)} className="p-2 hover:bg-red-100 rounded-full transition-colors">
                <span className="text-red-400 font-black text-lg leading-none">✕</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase mb-2">Justificativa obrigatória</label>
                <textarea
                  rows={4}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-700 resize-none outline-none focus:border-red-300"
                  placeholder="Descreva o motivo do cancelamento..."
                  value={cancelRequest.justification}
                  onChange={e => setCancelRequest({ ...cancelRequest, justification: e.target.value })}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setCancelRequest(null)}
                  className="flex-1 py-3 text-slate-500 font-bold uppercase text-xs border border-slate-200 rounded-2xl hover:bg-slate-50"
                >
                  Voltar
                </button>
                <button
                  onClick={() => {
                    if (!cancelRequest.justification.trim()) { alert('Informe a justificativa do cancelamento.'); return; }
                    handleCancelSale(cancelRequest.saleId, cancelRequest.justification);
                  }}
                  className="flex-1 py-3 bg-red-600 text-white rounded-2xl font-black uppercase text-xs shadow-lg shadow-red-100 hover:bg-red-700"
                >
                  Enviar Solicitação
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sales;

