
import React, { useState, useEffect, Component } from 'react';
import Sidebar from './components/Sidebar.tsx';
import Dashboard from './views/Dashboard.tsx';
import { STORES } from './constants.tsx';
import Sales from './views/Sales.tsx';
import Inventory from './views/Inventory.tsx';
import Logistics from './views/Logistics.tsx';
import Assembly from './views/Assembly.tsx';
import Reports from './views/Reports.tsx';
import Stores from './views/Stores.tsx';
import Customers from './views/Customers.tsx';
import EmployeesView from './views/Employees.tsx';
import Romaneios from './views/Romaneios.tsx';
import Products from './views/Products.tsx';
import SuppliersView from './views/Suppliers.tsx';
import Expedicao from './views/Expedicao.tsx';
import Tarefas from './views/Tarefas.tsx';
import ReceiptSettlement from './views/ReceiptSettlement.tsx';
import NFeManagement from './views/NFeManagement.tsx';
import WholesaleManagement from './views/WholesaleManagement.tsx';
import WholesaleCatalog from './views/WholesaleCatalog.tsx';
import StockTransfer from './views/StockTransfer.tsx';
import { Bell, Search, User, Lock, Store as StoreIcon, AlertCircle, X, Menu, Loader2, LogOut } from 'lucide-react';
import { Employee, UserRole, Sale, InventoryItem, Store, Product, Customer, Supplier } from './types.ts';
import { CartProvider } from './components/CartContext.tsx';
import { supabaseService } from './services/supabaseService.ts';
import { supabase } from './services/supabase.ts';
import { offlineSyncService } from './services/offlineSyncService.ts';
class ErrorBoundary extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 bg-red-50 text-red-700 min-h-screen">
          <h1 className="text-2xl font-bold mb-4">Ocorreu um erro no sistema</h1>
          <div className="p-4 bg-white border border-red-200 rounded-xl overflow-auto max-w-full">
            <p className="font-mono text-sm">{this.state.error?.toString() || 'Erro desconhecido'}</p>
          </div>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-6 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors"
          >
            Recarregar Página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}


const App: React.FC = () => {
  const [user, setUser] = useState<Employee | { id: 'admin', name: 'Lucas', role: 'ADMIN', storeId?: string } | null>(null);
  const [activeView, setActiveView] = useState('dashboard');
  const [loginForm, setLoginForm] = useState({ user: '', pass: '' });
  const [error, setError] = useState('');

  const [showLogin, setShowLogin] = useState(false);

  // Estado global sincronizado com Supabase
  const [sales, setSales] = useState<Sale[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobilePlatform, setIsMobilePlatform] = useState(false);
  const isFieldRole = user?.role === 'MOTORISTA' || user?.role === 'MONTADOR';

  useEffect(() => {
    // Restaurar usuário do localStorage imediatamente
    const savedUser = localStorage.getItem('lm_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
      } catch (e) {
        console.error("Erro ao restaurar usuário:", e);
      }
    }

    const ua = navigator.userAgent.toLowerCase();
    const isAndroid = ua.indexOf("android") > -1;
    const isSafari = ua.indexOf("safari") > -1 && ua.indexOf("chrome") === -1;
    if (isAndroid || isSafari) {
      setIsMobilePlatform(true);
      setIsSidebarOpen(false);
    }
  }, []);

  // scope: 'all' | 'sales' | 'inventory' | 'static' | 'customers'
  // force = ignora cache localStorage para dados estáticos
  const initData = async (scope: boolean | 'all' | 'sales' | 'inventory' | 'static' | 'customers' = 'all', startDate?: string, endDate?: string) => {
    // Normaliza: chamadas legadas passavam true/false como primeiro argumento
    const resolvedScope = scope === true || scope === false ? 'all' : scope;
    const bypassCache = scope === true; // force=true => bypass cache

    if (resolvedScope === 'all' || resolvedScope === 'static') {
      setIsLoading(true);
    }

    try {
      if (resolvedScope === 'sales') {
        const sItems = await supabaseService.getSales(startDate, endDate);
        setSales(sItems);
        // Salvar em cache se for motorista ou montador
        if (isFieldRole) offlineSyncService.saveSalesCache(sItems);
        return;
      }

      if (resolvedScope === 'inventory') {
        const iItems = await supabaseService.getInventory();
        setInventory(iItems);
        return;
      }

      if (resolvedScope === 'customers') {
        const cItems = await supabaseService.getCustomers();
        setCustomers(cItems);
        return;
      }

      // Carregamento completo (login ou scope 'all')
      if (resolvedScope === 'all' || resolvedScope === 'static') {
        const eItems = await supabaseService.getEmployees(bypassCache);
        setEmployees(eItems);

        if (user || bypassCache) {
          const [sItems, iItems, stItems, pItems, cItems, supItems] = await Promise.all([
            supabaseService.getSales(startDate, endDate),
            supabaseService.getInventory(),
            supabaseService.getStores(bypassCache),
            supabaseService.getProducts(bypassCache),
            supabaseService.getCustomers(),
            supabaseService.getSuppliers(bypassCache)
          ]);
          setSales(sItems);
          setInventory(iItems);
          setStores(stItems);
          setProducts(pItems);
          setCustomers(cItems);
          setSuppliers(supItems);

          // Salvar em cache de campo
          if (isFieldRole) offlineSyncService.saveSalesCache(sItems);
        }
      }
    } catch (err) {
      console.error("Erro ao carregar dados do Supabase:", err);
      // Fallback para cache offline se for equipe interna
      if (isFieldRole) {
        const cachedSales = offlineSyncService.getSalesCache();
        if (cachedSales) {
          console.log("[Offline] Carregando dados do cache local...");
          setSales(cachedSales);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    initData();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const email = session.user.email;
        if (email) {
          const emp = await supabaseService.getEmployeeByEmail(email);
          if (emp) setUser(emp);
          else if (email === 'lucas@moveislm.com') {
            setUser({ id: 'admin', name: 'Lucas', role: 'ADMIN' as const, active: true, username: email } as any);
          }
        }
      } else {
        // Sessão expirou ou usuário deslogou do Supabase Auth
        const savedUser = localStorage.getItem('lm_user');
        if (savedUser) {
          const parsed = JSON.parse(savedUser);
          // Só limpamos o estado se o usuário que estava logado era o Admin (que usa Auth)
          // Usuários Master ou Funcionários (login local) não devem ser deslogados aqui
          if (parsed.username === 'lucas@moveislm.com') {
            setUser(null);
            localStorage.removeItem('lm_user');
          }
        }
      }
    });

    const handleSyncComplete = () => {
      console.log("[OfflineSync] Sincronização concluída, atualizando dados...");
      initData('sales');
    };
    window.addEventListener('lm_sync_completed', handleSyncComplete);

    // ─── REALTIME SUBSCRIPTIONS ──────────────────────────────────────────────
    const productsChannel = supabase.channel('products-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => {
        const { eventType, new: newRow, old: oldRow } = payload;
        console.log("[Realtime] Product Change:", eventType, newRow?.id || oldRow?.id);
        
        if (eventType === 'INSERT') {
          const mapped = supabaseService.mapProduct(newRow);
          setProducts(prev => {
            if (prev.some(p => p.id === mapped.id)) return prev;
            return [...prev, mapped];
          });
        } else if (eventType === 'UPDATE') {
          const mapped = supabaseService.mapProduct(newRow);
          setProducts(prev => prev.map(p => p.id === mapped.id ? mapped : p));
        } else if (eventType === 'DELETE') {
          setProducts(prev => prev.filter(p => p.id !== oldRow.id));
        }
        supabaseService.cacheInvalidate('products');
      })
      .subscribe();

    const inventoryChannel = supabase.channel('inventory-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, (payload) => {
        const { eventType, new: newRow, old: oldRow } = payload;
        console.log("[Realtime] Inventory Change:", eventType, newRow?.product_id || oldRow?.product_id);

        if (eventType === 'INSERT' || eventType === 'UPDATE') {
          const mapped = supabaseService.mapInventoryItem(newRow);
          setInventory(prev => {
            const exists = prev.some(i => i.productId === mapped.productId && i.locationId === mapped.locationId);
            if (exists) {
              return prev.map(i => (i.productId === mapped.productId && i.locationId === mapped.locationId) ? mapped : i);
            }
            return [...prev, mapped];
          });
        } else if (eventType === 'DELETE') {
          setInventory(prev => prev.filter(i => 
            !(i.productId === oldRow.product_id && i.locationId === oldRow.location_id)
          ));
        }
      })
      .subscribe();
    // ─────────────────────────────────────────────────────────────────────────

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('lm_sync_completed', handleSyncComplete);
      supabase.removeChannel(productsChannel);
      supabase.removeChannel(inventoryChannel);
    };
  }, [user?.id]); // Re-run if user changes to fetch their specific data

  const redirectByRole = (employee: Employee) => {
    if (employee.role === 'MOTORISTA') setActiveView('delivery');
    else if (employee.role === 'MONTADOR') setActiveView('assembly');
    else if (employee.role === 'CONFERENTE') setActiveView('expedicao');
    else if (employee.role === 'SUPERVISOR') setActiveView('tarefas');
    else if (employee.role === 'VENDEDOR') setActiveView('sales');
    else if (employee.role === 'LOGISTA') setActiveView('wholesale-catalog');
    else setActiveView('dashboard');
  };

  // Redirecionar usuários de campo/vendas que caem no dashboard por padrão (ex: ao atualizar F5)
  useEffect(() => {
    if (user && activeView === 'dashboard') {
      const fieldRoles = ['MOTORISTA', 'MONTADOR', 'CONFERENTE', 'VENDEDOR', 'LOGISTA'];
      if (fieldRoles.includes(user.role)) {
        redirectByRole(user as Employee);
      }
    }
  }, [user, activeView]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // 0. Bypass para o usuário Master (solicitação do cliente)
      if (loginForm.user === 'Master' && loginForm.pass === '@Master2026') {
        const masterData = { id: 'master', name: 'ADMINISTRADOR MASTER', role: 'ADMIN' as const, active: true, username: 'Master' };
        setUser(masterData as any);
        localStorage.setItem('lm_user', JSON.stringify(masterData));
        setActiveView('dashboard');
        setShowLogin(false);
        setIsLoading(false);
        return;
      }

      // 1. Tentar login via Supabase Auth
      let authUser = null;
      try {
        authUser = await supabaseService.signIn(loginForm.user, loginForm.pass);
      } catch (e) {
        console.warn("Auth falhou, tentando login local...");
      }

      if (authUser) {
        // 2. Buscar perfil completo na tabela employees (Login via Auth)
        const employee = employees.find(emp => emp.username === loginForm.user);

        if (employee) {
          setUser(employee);
          localStorage.setItem('lm_user', JSON.stringify(employee));
          setShowLogin(false);
          redirectByRole(employee);
        } else {
          // Caso seja o admin principal e não esteja na tabela (fallback)
          if (loginForm.user === 'lucas@moveislm.com') {
            const adminData = { id: 'admin', name: 'Lucas', role: 'ADMIN' as const, active: true, username: loginForm.user };
            setUser(adminData as any);
            localStorage.setItem('lm_user', JSON.stringify(adminData));
            setActiveView('dashboard');
            setShowLogin(false);
          } else {
            setError('Perfil não encontrado para este usuário.');
            await supabaseService.signOut();
          }
        }
      } else {
        // 3. Fallback: Tentar login direto pela tabela de funcionários (para usuários sem Auth cadastrado)
        const employee = employees.find(emp =>
          emp.username === loginForm.user &&
          emp.password === loginForm.pass &&
          emp.active
        );

        if (employee) {
          setUser(employee);
          localStorage.setItem('lm_user', JSON.stringify(employee));
          setShowLogin(false);
          redirectByRole(employee);
        } else {
          // 4. Última tentativa: Login de Atacado
          const wholesaleUser = await supabaseService.signInWholesale(loginForm.user, loginForm.pass);
          if (wholesaleUser) {
            setUser(wholesaleUser as any);
            localStorage.setItem('lm_user', JSON.stringify(wholesaleUser));
            setShowLogin(false);
            setActiveView('wholesale-catalog');
          } else {
            setError('Usuário ou senha incorretos.');
          }
        }
      }
    } catch (err: any) {
      console.error("Erro no login:", err);
      setError('Usuário ou senha incorretos ou erro de conexão.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabaseService.signOut();
    setUser(null);
    localStorage.removeItem('lm_user');
    setLoginForm({ user: '', pass: '' }); // Clear login and password fields
    setActiveView('dashboard');
  };

  const renderView = () => {
    if (isLoading) return <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

    // Guarda de rota baseado no cargo
    if (user?.role === 'MOTORISTA' && activeView !== 'logistics' && activeView !== 'delivery') {
      setActiveView('logistics');
      return null;
    }
    if (user?.role === 'MONTADOR' && activeView !== 'assembly') {
      setActiveView('assembly');
      return null;
    }

    switch (activeView) {
      case 'dashboard': return <Dashboard user={user!} sales={sales} stores={stores} refreshData={initData} />;
      case 'customers': return <Customers customers={customers} setCustomers={setCustomers} refreshData={initData} />;
      case 'products': return <Products user={user} products={products} inventory={inventory} stores={stores} employees={employees} suppliers={suppliers} refreshData={initData} />;
      case 'sales': return <Sales user={user} sales={sales} setSales={setSales} inventory={inventory} setInventory={setInventory} stores={stores} products={products} customers={customers} setCustomers={setCustomers} employees={employees} refreshData={initData} />;
      case 'inventory': return <Inventory inventory={inventory} setInventory={setInventory} products={products} stores={stores} suppliers={suppliers} employees={employees} user={user} refreshData={initData} />;
      case 'stores': return <Stores stores={stores} setStores={setStores} employees={employees} refreshData={initData} />;
      case 'employees': return <EmployeesView user={user} employees={employees} setEmployees={setEmployees} stores={stores} refreshData={initData} />;
      case 'suppliers': return <SuppliersView suppliers={suppliers} setSuppliers={setSuppliers} refreshData={initData} />;
      case 'romaneios': return <Romaneios user={user} sales={sales} setSales={setSales} employees={employees} products={products} stores={stores} refreshData={initData} />;
      case 'expedicao': return <Expedicao user={user} stores={stores} sales={sales} products={products} employees={employees} customers={customers} refreshData={initData} />;
      case 'tarefas': return <Tarefas user={user} stores={stores} sales={sales} setSales={setSales} products={products} refreshData={initData} />;
      case 'delivery':
      case 'logistics': return <Logistics user={user} sales={sales} setSales={setSales} products={products} stores={stores} employees={employees} refreshData={initData} />;
      case 'assembly': return <Assembly user={user} sales={sales} setSales={setSales} products={products} stores={stores} employees={employees} refreshData={initData} />;
      case 'settlement': return <ReceiptSettlement sales={sales} setSales={setSales} employees={employees} stores={stores} products={products} customers={customers} />;
      case 'reports': return <Reports user={user} sales={sales} stores={stores} products={products} employees={employees} refreshData={initData} />;
      case 'nfe': return <NFeManagement sales={sales} products={products} stores={stores} refreshData={initData} />;
      case 'wholesale-management': return <WholesaleManagement user={user!} refreshData={initData} />;
      case 'wholesale-catalog': return <WholesaleCatalog user={user!} products={products} inventory={inventory} stores={stores} refreshData={initData} />;
      case 'transfer': return <StockTransfer user={user} products={products} inventory={inventory} stores={stores} employees={employees} refreshData={initData} />;
      default: return <Dashboard user={user!} sales={sales} stores={stores} />;
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)' }}>
        <div className="w-full max-w-md animate-in zoom-in-95 duration-200 relative z-10">
          <div className="bg-white/90 backdrop-blur-xl rounded-[2.5rem] p-10 shadow-2xl border border-white/20">
            <div className="text-center mb-10">
              <div className="bg-blue-600 w-16 h-16 rounded-3xl shadow-xl shadow-blue-500/30 flex items-center justify-center mx-auto mb-4">
                <StoreIcon className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Móveis LM</h1>
              <p className="text-slate-400 font-medium mt-1 uppercase text-[10px] tracking-widest">Painel Administrativo v2.0</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Usuário</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input required type="text" className="w-full pl-12 pr-4 py-4 bg-white/50 border border-slate-100 rounded-2xl focus:border-blue-500 transition-all outline-none font-semibold text-slate-900" placeholder="Seu usuário" value={loginForm.user} onChange={e => setLoginForm({ ...loginForm, user: e.target.value })} />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input required type="password" name="password" className="w-full pl-12 pr-4 py-4 bg-white/50 border border-slate-100 rounded-2xl focus:border-blue-500 transition-all outline-none font-semibold text-slate-900" placeholder="••••••••" value={loginForm.pass} onChange={e => setLoginForm({ ...loginForm, pass: e.target.value })} />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-2xl flex items-center gap-3 text-sm font-bold border border-red-100 animate-in shake duration-300">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white py-4 rounded-2xl font-black shadow-xl shadow-blue-500/20 transition-all active:scale-95 uppercase tracking-widest mt-4 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Lock className="w-5 h-5" />
                    Entrar no Sistema
                  </>
                )}
              </button>
            </form>
          </div>
          <p className="text-center mt-6 text-white/60 text-[10px] font-bold uppercase tracking-widest">© 2026 Móveis LM • Todos os direitos reservados</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden relative">
      <div className={`fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsSidebarOpen(false)} />

      {!isFieldRole && (
        <div className={`fixed lg:static inset-y-0 left-0 z-50 transform transition-transform duration-300 lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <Sidebar activeView={activeView} setActiveView={(view) => { setActiveView(view); setIsSidebarOpen(false); }} role={user.role} onLogout={handleLogout} />
        </div>
      )}

      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-4 md:px-8 shrink-0 no-print">
          <div className="flex items-center gap-4 flex-1">
            {!isFieldRole && (
              <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 hover:bg-slate-100 rounded-xl lg:hidden">
                <Menu className="w-5 h-5 text-slate-600" />
              </button>
            )}
            <h2 className="font-bold text-slate-900 uppercase text-xs truncate">
              {activeView === 'delivery' || activeView === 'assembly' ? 'Minha Rota' : activeView}
            </h2>
          </div>
          <div className="flex items-center gap-3 pl-2">
            <div className="text-right hidden xs:block">
              <p className="text-[10px] md:text-xs font-bold text-slate-900 uppercase">{user.name}</p>
              <p className="text-[9px] md:text-[10px] text-slate-400">{user.role}</p>
            </div>
            <div className="w-8 h-8 md:w-9 md:h-9 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xs uppercase shrink-0">{user.name.substring(0, 2)}</div>

            {isFieldRole && (
              <button
                onClick={handleLogout}
                className="ml-2 p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                title="Sair"
              >
                <LogOut className="w-5 h-5" />
              </button>
            )}
          </div>
        </header>
        <section className="flex-1 overflow-y-auto p-3 md:p-8 bg-slate-50/50">
          <ErrorBoundary>
            <div className="max-w-7xl mx-auto h-full">{renderView()}</div>
          </ErrorBoundary>
        </section>
      </main>
    </div>
  );
};

const AppWrapper: React.FC = () => (
  <CartProvider>
    <App />
  </CartProvider>
);

export default AppWrapper;
