
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar.tsx';
import Dashboard from './views/Dashboard.tsx';
import Sales from './views/Sales.tsx';
import Inventory from './views/Inventory.tsx';
import Logistics from './views/Logistics.tsx';
import Assembly from './views/Assembly.tsx';
import Reports from './views/Reports.tsx';
import ProductCatalog from './views/ProductCatalog.tsx';
import Stores from './views/Stores.tsx';
import Customers from './views/Customers.tsx';
import EmployeesView from './views/Employees.tsx';
import Romaneios from './views/Romaneios.tsx';
import Products from './views/Products.tsx';
import Expedicao from './views/Expedicao.tsx';
import Tarefas from './views/Tarefas.tsx';
import ReceiptSettlement from './views/ReceiptSettlement.tsx';
import { Bell, Search, User, Lock, Store as StoreIcon, AlertCircle, X, Menu } from 'lucide-react';
import { Employee, UserRole, Sale, InventoryItem, Store, Product, Customer } from './types.ts';
import { CartProvider } from './components/CartContext.tsx';
import { supabaseService } from './services/supabaseService.ts';
import { supabase } from './services/supabase.ts';

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
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobilePlatform, setIsMobilePlatform] = useState(false);

  useEffect(() => {
    // Restaurar usuário do localStorage imediatamente
    const savedUser = localStorage.getItem('lm_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
        if (parsed.username !== 'Master') {
          // Se for um usuário normal, o onAuthStateChange cuidará da re-validação
        }
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

  useEffect(() => {
    const initData = async () => {
      try {
        const [sItems, iItems, stItems, eItems, pItems, cItems] = await Promise.all([
          supabaseService.getSales(),
          supabaseService.getInventory(),
          supabaseService.getStores(),
          supabaseService.getEmployees(),
          supabaseService.getProducts(),
          supabaseService.getCustomers()
        ]);
        setSales(sItems);
        setInventory(iItems);
        setStores(stItems);
        setEmployees(eItems);
        setProducts(pItems);
        setCustomers(cItems);
      } catch (err) {
        console.error("Erro ao carregar dados do Supabase:", err);
      } finally {
        setIsLoading(false);
      }
    };
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

    return () => subscription.unsubscribe();
  }, [employees]); // Re-run if employees state changes to ensure we can find the profile

  const redirectByRole = (employee: Employee) => {
    if (employee.role === 'MOTORISTA') setActiveView('delivery');
    else if (employee.role === 'MONTADOR') setActiveView('assembly');
    else if (employee.role === 'CONFERENTE') setActiveView('expedicao');
    else if (employee.role === 'SUPERVISOR') setActiveView('tarefas');
    else if (employee.role === 'VENDEDOR') setActiveView('sales');
    else setActiveView('dashboard');
  };

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
          setError('Usuário ou senha incorretos.');
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
    setActiveView('catalog');
  };

  const renderView = () => {
    if (isLoading) return <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

    if (!user && activeView !== 'catalog') return <ProductCatalog user={null} inventory={inventory} stores={stores} products={products} setProducts={setProducts} />;

    switch (activeView) {
      case 'dashboard': return <Dashboard user={user!} sales={sales} stores={stores} />;
      case 'catalog': return <ProductCatalog user={user} inventory={inventory} stores={stores} products={products} setProducts={setProducts} />;
      case 'customers': return <Customers customers={customers} setCustomers={setCustomers} />;
      case 'products': return <Products user={user} products={products} inventory={inventory} stores={stores} employees={employees} />;
      case 'sales': return <Sales user={user} sales={sales} setSales={setSales} inventory={inventory} setInventory={setInventory} stores={stores} products={products} customers={customers} setCustomers={setCustomers} employees={employees} />;
      case 'inventory': return <Inventory inventory={inventory} setInventory={setInventory} products={products} stores={stores} />;
      case 'stores': return <Stores stores={stores} setStores={setStores} employees={employees} />;
      case 'employees': return <EmployeesView user={user} employees={employees} setEmployees={setEmployees} stores={stores} />;
      case 'romaneios': return <Romaneios sales={sales} setSales={setSales} employees={employees} products={products} />;
      case 'expedicao': return <Expedicao user={user} stores={stores} />;
      case 'tarefas': return <Tarefas user={user} stores={stores} />;
      case 'delivery':
      case 'logistics': return <Logistics user={user} sales={sales} setSales={setSales} />;
      case 'assembly': return <Assembly user={user} sales={sales} setSales={setSales} products={products} />;
      case 'settlement': return <ReceiptSettlement sales={sales} setSales={setSales} employees={employees} stores={stores} />;
      case 'reports': return <Reports user={user} sales={sales} stores={stores} products={products} employees={employees} />;
      default: return <ProductCatalog user={user} inventory={inventory} stores={stores} products={products} setProducts={setProducts} />;
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-500/20">
              <StoreIcon className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight">Móveis LM</h1>
          </div>
          <button
            onClick={() => setShowLogin(true)}
            className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition-all"
          >
            <Lock className="w-4 h-4" />
            <span>Acesso Restrito</span>
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto">
            {isLoading ? (
              <div className="flex items-center justify-center p-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>
            ) : (
              <ProductCatalog user={null} inventory={inventory} stores={stores} products={products} setProducts={setProducts} />
            )}
          </div>
        </main>

        {showLogin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
            <div className="w-full max-w-md animate-in zoom-in-95 duration-200">
              <div className="bg-white rounded-[2.5rem] p-10 shadow-2xl border border-slate-100 relative">
                <button
                  onClick={() => setShowLogin(false)}
                  className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
                <div className="text-center mb-10">
                  <h1 className="text-3xl font-black text-slate-900 tracking-tight">Móveis LM</h1>
                  <p className="text-slate-400 font-medium mt-1">Acesso ao Sistema ERP</p>
                </div>
                <form onSubmit={handleLogin} className="space-y-5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Usuário</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input required type="text" className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-blue-500 transition-all outline-none font-semibold text-slate-900" placeholder="Seu usuário" value={loginForm.user} onChange={e => setLoginForm({ ...loginForm, user: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Senha</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input required type="password" name="password" className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-blue-500 transition-all outline-none font-semibold text-slate-900" placeholder="••••••••" value={loginForm.pass} onChange={e => setLoginForm({ ...loginForm, pass: e.target.value })} />
                    </div>
                  </div>
                  {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl flex items-center gap-3 text-sm font-bold border border-red-100 animate-in shake duration-300"><AlertCircle className="w-5 h-5 shrink-0" />{error}</div>}
                  <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black shadow-xl shadow-blue-500/20 transition-all active:scale-95 uppercase tracking-widest mt-4">Entrar no Sistema</button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden relative">
      <div className={`fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsSidebarOpen(false)} />

      <div className={`fixed lg:static inset-y-0 left-0 z-50 transform transition-transform duration-300 lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar activeView={activeView} setActiveView={(view) => { setActiveView(view); setIsSidebarOpen(false); }} role={user.role} onLogout={handleLogout} />
      </div>

      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-4 md:px-8 shrink-0 no-print">
          <div className="flex items-center gap-4 flex-1">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 hover:bg-slate-100 rounded-xl lg:hidden">
              <Menu className="w-5 h-5 text-slate-600" />
            </button>
            <h2 className="font-bold text-slate-900 uppercase text-xs truncate">{activeView}</h2>
          </div>
          <div className="flex items-center gap-3 pl-2">
            <div className="text-right hidden xs:block">
              <p className="text-[10px] md:text-xs font-bold text-slate-900 uppercase">{user.name}</p>
              <p className="text-[9px] md:text-[10px] text-slate-400">{user.role}</p>
            </div>
            <div className="w-8 h-8 md:w-9 md:h-9 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xs uppercase shrink-0">{user.name.substring(0, 2)}</div>
          </div>
        </header>
        <section className="flex-1 overflow-y-auto p-3 md:p-8 bg-slate-50/50">
          <div className="max-w-7xl mx-auto h-full">{renderView()}</div>
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
