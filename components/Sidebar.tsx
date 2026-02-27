
import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Box,
  Truck,
  Wrench,
  BarChart3,
  Store as StoreIcon,
  Users,
  Grid,
  LogOut,
  X,
  ShieldAlert,
  ClipboardList,
  PackageCheck,
  ClipboardCheck,
  DollarSign
} from 'lucide-react';
import { UserRole } from '../types.ts';

interface SidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
  role: UserRole;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView, role, onLogout }) => {
  const allItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'SUPERVISOR', 'MASTER', 'GERENTE'] },
    { id: 'catalog', label: 'Catálogo', icon: Grid, roles: ['ADMIN', 'VENDEDOR', 'CONFERENTE', 'SUPERVISOR', 'MASTER', 'GERENTE'] },
    { id: 'customers', label: 'Clientes', icon: Users, roles: ['ADMIN', 'VENDEDOR', 'GERENTE', 'SUPERVISOR', 'MASTER'] },
    { id: 'products', label: 'Produtos', icon: Box, roles: ['ADMIN', 'VENDEDOR', 'GERENTE', 'SUPERVISOR', 'MASTER'] },
    { id: 'sales', label: 'Vendas', icon: ShoppingCart, roles: ['ADMIN', 'VENDEDOR', 'GERENTE', 'SUPERVISOR', 'MASTER'] },
    { id: 'inventory', label: 'Estoque', icon: Package, roles: ['ADMIN', 'CONFERENTE'] },
    { id: 'expedicao', label: 'Expedição', icon: PackageCheck, roles: ['ADMIN', 'CONFERENTE'] },
    { id: 'tarefas', label: 'Tarefas', icon: ClipboardCheck, roles: ['ADMIN', 'SUPERVISOR', 'MASTER'] },
    { id: 'settlement', label: 'Acerto Entregas', icon: DollarSign, roles: ['ADMIN', 'SUPERVISOR', 'MASTER'] },
    { id: 'stores', label: 'Unidades', icon: StoreIcon, roles: ['ADMIN'] },
    { id: 'employees', label: 'Equipe', icon: ShieldAlert, roles: ['ADMIN', 'GERENTE'] },
    { id: 'romaneios', label: 'Gestão Romaneios', icon: ClipboardList, roles: ['ADMIN'] },
    { id: 'delivery', label: 'Minha Rota', icon: Truck, roles: ['ADMIN', 'MOTORISTA'] },
    { id: 'assembly', label: 'Minhas Montagens', icon: Wrench, roles: ['ADMIN', 'MONTADOR'] },
    { id: 'reports', label: 'Relatórios', icon: BarChart3, roles: ['ADMIN', 'SUPERVISOR', 'MASTER', 'GERENTE'] },
  ];

  const menuItems = allItems.filter(item => item.roles.includes(role));

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col h-full shrink-0 no-print">
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-500/20"><StoreIcon className="w-6 h-6" /></div>
          <span className="font-bold text-lg tracking-tight">Móveis LM</span>
        </div>
        <button onClick={() => setActiveView(activeView)} className="p-2 hover:bg-slate-800 rounded-lg lg:hidden text-slate-400">
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium text-sm">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800 space-y-2">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-all font-bold text-sm"
        >
          <LogOut className="w-5 h-5" />
          Sair do Sistema
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
