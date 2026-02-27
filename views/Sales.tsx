
import React, { useState, useEffect } from 'react';
import { Employee, Store, OrderStatus, Sale, Product, Customer, SaleItem, Payment, InventoryItem } from '../types.ts';
import { Search, Plus, Eye, X, ShoppingCart, User, Package, CheckCircle2, ArrowLeft, Trash2, AlertCircle, CreditCard, DollarSign, Box } from 'lucide-react';
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
  const [productSearch, setProductSearch] = useState('');
  const [isManagerOverrideNeeded, setIsManagerOverrideNeeded] = useState(false);
  const [managerLogin, setManagerLogin] = useState({ username: '', password: '' });
  const [managerError, setManagerError] = useState('');
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

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

          // Calculate discount based on new price vs original price
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

          // Calculate new price based on discount
          const newPrice = product.price * (1 - newDiscount / 100);
          return { ...item, discount: newDiscount, price: newPrice };
        }
        return item;
      });
      return { ...prev, items: updatedItems };
    });
  };

  if (selectedSale) {
    return <SaleReceipt sale={selectedSale} onBack={() => setSelectedSale(null)} />;
  }

  const filteredSales = sales.filter(s =>
    s.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddItem = (product: Product) => {
    const existing = newSale.items?.find(i => i.productId === product.id);
    if (existing) {
      setNewSale({
        ...newSale,
        items: newSale.items?.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      });
    } else {
      const newItem: SaleItem = {
        productId: product.id,
        quantity: 1,
        price: product.price,
        discount: 0,
        originalPrice: product.price,
        locationId: 'W-NORTE',
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
      emp.storeId === newSale.storeId // Must be from the same store
    );

    if (manager) {
      setIsManagerOverrideNeeded(false);
      setManagerLogin({ username: '', password: '' });
      completeSale(); // Proceed with saving the sale
    } else {
      const otherStoreManager = employees.find(emp =>
        emp.username === managerLogin.username &&
        emp.password === managerLogin.password &&
        emp.role === 'GERENTE'
      );

      if (otherStoreManager) {
        setManagerError('Este gerente não pertence a esta unidade.');
      } else {
        setManagerError('Usuário ou senha de gerente incorretos.');
      }
    }
  };

  const completeSale = async () => {
    if (!selectedCustomer || !newSale.items?.length) return;

    const lastIdNum = sales.length > 0 ? Math.max(...sales.map(s => {
      const num = parseInt(s.id);
      return isNaN(num) ? 0 : num;
    })) : 100;
    const nextId = (lastIdNum + 1).toString();

    const sale: Sale = {
      id: nextId,
      date: new Date().toLocaleDateString('pt-BR'),
      customerName: selectedCustomer.name,
      customerCpf: selectedCustomer.document,
      customerPhone: selectedCustomer.phone,
      customerEmail: selectedCustomer.email,
      customerReference: selectedCustomer.reference,
      storeId: newSale.storeId!,
      sellerId: newSale.sellerId!,
      items: newSale.items as SaleItem[],
      payments: newSale.payments as Payment[],
      total: calculateTotal(),
      status: OrderStatus.PENDING,
      deliveryAddress: selectedCustomer.address + ', ' + selectedCustomer.number + ' - ' + selectedCustomer.neighborhood,
      deliveryObs: newSale.deliveryObs || '',
      assemblyRequired: newSale.items?.some(i => i.assemblyRequired) || false,
    };

    try {
      await supabaseService.createSale(sale);

      // Persistir atualizações de estoque no Supabase
      const inventoryUpdates = sale.items.map(item => {
        const currentQty = inventory.find(i => i.productId === item.productId && i.locationId === item.locationId)?.quantity || 0;
        return supabaseService.updateInventory(item.productId, item.locationId, Math.max(0, currentQty - item.quantity));
      });
      await Promise.all(inventoryUpdates);

      setSales([sale, ...sales]);

      // Update local inventory state
      setInventory(prev => {
        const updated = [...prev];
        sale.items.forEach(item => {
          const index = updated.findIndex(i => i.productId === item.productId && i.locationId === item.locationId);
          if (index !== -1) {
            updated[index] = { ...updated[index], quantity: Math.max(0, updated[index].quantity - item.quantity) };
          }
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
    } catch (err) {
      console.error("Erro ao salvar venda:", err);
      alert("Erro ao salvar venda no banco de dados. Verifique sua conexão.");
    }
  };

  const handleSaveSale = () => {
    if (!selectedCustomer || !newSale.items?.length) return;

    const total = calculateTotal();
    const paymentsTotal = calculatePaymentsTotal();

    if (Math.abs(total - paymentsTotal) > 0.01) {
      alert(`O total dos pagamentos (R$ ${paymentsTotal.toFixed(2)}) deve ser igual ao total do pedido (R$ ${total.toFixed(2)})`);
      return;
    }

    // Check if any item has a discount > 10%
    const hasHighDiscount = newSale.items.some(item => item.discount > 10);

    if (hasHighDiscount) {
      setIsManagerOverrideNeeded(true);
    } else {
      completeSale();
    }
  };

  if (isCreating) {
    return (
      <>
        <div className="space-y-6 animate-in fade-in duration-300">
          <header className="flex items-center gap-4">
            <button onClick={() => setIsCreating(false)} className="p-2 hover:bg-white rounded-full transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Nova Venda</h1>
              <p className="text-slate-500">Iniciando pedido sequencial</p>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <h3 className="text-sm font-black text-slate-400 uppercase mb-4 flex items-center gap-2">
                  <User className="w-4 h-4" /> Cliente
                </h3>
                {!selectedCustomer ? (
                  <div className="space-y-4">
                    <div className="relative">
                      <select
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-blue-500 font-bold text-sm appearance-none"
                        value={selectedCustomer?.id || ''}
                        onChange={(e) => {
                          const customer = customers.find(c => c.id === e.target.value);
                          if (customer) setSelectedCustomer(customer);
                        }}
                      >
                        <option value="">Selecione um cliente...</option>
                        {customers.map(c => (
                          <option key={c.id} value={c.id}>{c.name} ({c.document})</option>
                        ))}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <Plus className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex justify-between items-center">
                    <div>
                      <p className="font-black text-blue-900 uppercase">{selectedCustomer.name}</p>
                      <p className="text-xs text-blue-700">{selectedCustomer.document} • {selectedCustomer.phone}</p>
                    </div>
                    <button onClick={() => setSelectedCustomer(null)} className="p-2 hover:bg-blue-200 rounded-full text-blue-600">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <h3 className="text-sm font-black text-slate-400 uppercase mb-4 flex items-center gap-2">
                  <Package className="w-4 h-4" /> Produtos e Pedido
                </h3>
                <div className="flex flex-col gap-6">
                  {/* Lista de Produtos (Busca) - Agora Acima */}
                  <div className="space-y-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Adicionar produto..."
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-500"
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-2">
                      {products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase())).map(p => {
                        const totalStock = getStock(p.id);
                        return (
                          <button
                            key={p.id}
                            onClick={() => handleAddItem(p)}
                            disabled={totalStock <= 0}
                            className={`w-full text-left p-2 rounded-xl transition-colors border flex items-center gap-3 ${totalStock > 0 ? 'hover:bg-slate-50 border-slate-100' : 'opacity-50 cursor-not-allowed border-red-50 bg-red-50/10'
                              }`}
                          >
                            <img src={p.imageUrl} className="w-10 h-10 rounded-lg object-cover" />
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-slate-900 text-xs uppercase truncate">{p.name}</p>
                              <div className="flex items-center justify-between">
                                <p className="text-[10px] text-blue-600 font-bold">R$ {p.price.toFixed(2)}</p>
                                <p className={`text-[9px] font-black px-1.5 py-0.5 rounded ${totalStock > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                  SALDO: {totalStock}
                                </p>
                              </div>
                            </div>
                            <Plus className="w-4 h-4 text-slate-400" />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Itens do Pedido - Agora Abaixo */}
                  <div className="bg-slate-50 rounded-2xl p-4 flex flex-col">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase mb-3 flex items-center gap-2">
                      <Box className="w-3 h-3" /> Itens do Pedido
                    </h4>
                    <div className="space-y-3">
                      {newSale.items?.length === 0 && <p className="text-center text-xs text-slate-400 py-8">Nenhum item adicionado</p>}
                      {newSale.items?.map(item => {
                        const prod = products.find(p => p.id === item.productId);
                        return (
                          <div key={item.productId} className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-bold text-slate-900 uppercase truncate mb-2">{prod?.name}</p>
                              <div className="flex flex-wrap gap-3">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    className="w-10 bg-slate-50 border-none text-[10px] font-bold p-1 rounded"
                                    value={item.quantity}
                                    onChange={(e) => {
                                      const qty = parseInt(e.target.value) || 1;
                                      setNewSale({ ...newSale, items: newSale.items?.map(i => i.productId === item.productId ? { ...i, quantity: qty } : i) });
                                    }}
                                  />
                                  <span className="text-[10px] text-slate-400">x</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    className="w-20 bg-slate-50 border-none text-[10px] font-bold p-1 rounded text-right"
                                    value={item.price}
                                    onChange={(e) => handlePriceChange(item.productId, parseFloat(e.target.value))}
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-slate-400">Desc.</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    className="w-16 bg-slate-50 border-none text-[10px] font-bold p-1 rounded text-right text-red-500"
                                    value={item.discount}
                                    onChange={(e) => handleDiscountChange(item.productId, parseFloat(e.target.value))}
                                  />
                                  <span className="text-[10px] text-slate-400">%</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <select
                                    className="text-[10px] bg-slate-50 border-none p-1 rounded font-bold outline-none"
                                    value={item.locationId}
                                    onChange={(e) => setNewSale({ ...newSale, items: newSale.items?.map(i => i.productId === item.productId ? { ...i, locationId: e.target.value } : i) })}
                                  >
                                    {stores.map(s => {
                                      const stock = getStock(item.productId, s.id);
                                      return (
                                        <option key={s.id} value={s.id} disabled={stock <= 0}>
                                          {s.name} (Saldo: {stock})
                                        </option>
                                      );
                                    })}
                                  </select>
                                  <label className="flex items-center gap-1 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      className="w-3 h-3 accent-blue-600"
                                      checked={item.assemblyRequired}
                                      onChange={(e) => setNewSale({ ...newSale, items: newSale.items?.map(i => i.productId === item.productId ? { ...i, assemblyRequired: e.target.checked } : i) })}
                                    />
                                    <span className="text-[10px] text-slate-500 font-bold">Montagem</span>
                                  </label>
                                </div>
                              </div>
                            </div>
                            <button onClick={() => handleRemoveItem(item.productId)} className="text-red-400 hover:text-red-600 p-1">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                    {newSale.items && newSale.items.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-center">
                        <span className="text-xs font-black text-slate-400 uppercase">Subtotal Itens</span>
                        <span className="text-sm font-black text-slate-900">R$ {calculateTotal().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                <h3 className="text-sm font-black text-slate-400 uppercase flex items-center gap-2">
                  <CreditCard className="w-4 h-4" /> Pagamento
                </h3>

                <div className="space-y-3">
                  {newSale.payments?.map((payment, index) => (
                    <div key={index} className="flex gap-2 items-end bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <div className="flex-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Forma</label>
                        <select
                          className="w-full bg-white border border-slate-200 p-2 rounded-xl text-xs font-bold outline-none"
                          value={payment.method}
                          onChange={(e) => handlePaymentChange(index, 'method', e.target.value)}
                        >
                          <option value="Dinheiro">Dinheiro</option>
                          <option value="PIX">PIX</option>
                          <option value="Cartão de Crédito">Cartão de Crédito</option>
                          <option value="Cartão de Débito">Cartão de Débito</option>
                          <option value="Boleto">Boleto</option>
                          <option value="Crediário">Crediário</option>
                        </select>
                      </div>
                      <div className="w-24">
                        <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Valor</label>
                        <input
                          type="number"
                          step="0.01"
                          className="w-full bg-white border border-slate-200 p-2 rounded-xl text-xs font-bold outline-none text-right"
                          value={payment.amount}
                          onChange={(e) => handlePaymentChange(index, 'amount', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <button
                        onClick={() => handleRemovePayment(index)}
                        className="p-2 text-red-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={handleAddPayment}
                    className="w-full py-2 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 hover:border-blue-300 hover:text-blue-500 transition-all flex items-center justify-center gap-2 text-xs font-bold"
                  >
                    <Plus className="w-4 h-4" /> Adicionar Pagamento
                  </button>
                </div>

                <div className="pt-2 flex justify-between items-center text-xs font-bold">
                  <span className="text-slate-500">Total Pago:</span>
                  <span className={Math.abs(calculatePaymentsTotal() - calculateTotal()) < 0.01 ? 'text-green-600' : 'text-red-500'}>
                    R$ {calculatePaymentsTotal().toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                <h3 className="text-sm font-black text-slate-400 uppercase flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4" /> Checkout
                </h3>

                <div className="pt-4">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-slate-500 font-bold uppercase text-xs">Total do Pedido</span>
                    <span className="text-2xl font-black text-blue-600">R$ {calculateTotal().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>

                  <button
                    onClick={handleSaveSale}
                    disabled={!selectedCustomer || !newSale.items?.length}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white py-4 rounded-2xl font-black shadow-xl shadow-blue-100 transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    Finalizar Venda
                  </button>
                </div>
              </div>

              <div className="bg-slate-900 p-6 rounded-3xl text-white">
                <h4 className="text-[10px] font-black text-slate-400 uppercase mb-2">Observações de Entrega</h4>
                <textarea
                  className="w-full bg-white/10 border border-white/10 rounded-xl p-3 text-xs outline-none focus:border-white/20 h-24"
                  placeholder="Instruções para o entregador..."
                  value={newSale.deliveryObs}
                  onChange={e => setNewSale({ ...newSale, deliveryObs: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>

        {isManagerOverrideNeeded && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                <h2 className="text-lg font-black text-slate-900 uppercase">Aprovação de Desconto</h2>
                <button onClick={() => setIsManagerOverrideNeeded(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
              </div>
              <form onSubmit={handleManagerLogin} className="p-6 space-y-4">
                <p className="text-sm text-slate-600">Um desconto acima do limite de 10% foi aplicado. Por favor, insira as credenciais de um gerente para aprovar.</p>
                <div className="space-y-1">
                  <label className="block text-xs font-black text-slate-400 uppercase mb-1">Usuário do Gerente</label>
                  <input required type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold text-slate-900" value={managerLogin.username} onChange={e => setManagerLogin({ ...managerLogin, username: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-black text-slate-400 uppercase mb-1">Senha do Gerente</label>
                  <input required type="password" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold text-slate-900" value={managerLogin.password} onChange={e => setManagerLogin({ ...managerLogin, password: e.target.value })} />
                </div>
                {managerError && <div className="bg-red-50 text-red-600 p-4 rounded-2xl flex items-center gap-3 text-sm font-bold border border-red-100 animate-in shake duration-300"><AlertCircle className="w-5 h-5 shrink-0" />{managerError}</div>}
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black shadow-xl transition-all">APROVAR DESCONTO</button>
              </form>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Vendas</h1>
          <p className="text-slate-500">Gestão de pedidos (Iniciando em 101)</p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-200 font-bold"
        >
          <Plus className="w-5 h-5" />
          <span>Nova Venda</span>
        </button>
      </header>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por cliente ou código..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 rounded-xl text-sm transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Código</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente / Data</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Loja</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-black text-blue-600 text-sm">{sale.id}</span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-slate-700 text-sm uppercase">{sale.customerName}</p>
                    <p className="text-[10px] text-slate-400">{sale.date}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded-md">
                      {stores.find(s => s.id === sale.storeId)?.name}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => setSelectedSale(sale)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-all"
                    >
                      <Eye className="w-4 h-4" /> Ver Nota
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Sales;
