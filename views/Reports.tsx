import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Download, FileText, Calendar } from 'lucide-react';
import { Sale, Store, Product, Employee } from '../types.ts';

interface ReportsProps {
  user: Employee | { id: 'admin', name: 'Lucas', role: 'ADMIN', storeId?: string } | null;
  sales: Sale[];
  stores: Store[];
  products: Product[];
  employees: Employee[];
}

const COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981', '#f59e0b', '#6366f1'];

const Reports: React.FC<ReportsProps> = ({ user, sales, stores, products, employees }) => {
  const [dateFilter, setDateFilter] = React.useState('this_month');
  const [storeFilter, setStoreFilter] = React.useState(user?.role === 'GERENTE' ? (user.storeId || 'all') : 'all');
  const [sellerFilter, setSellerFilter] = React.useState('all');

  const filteredSales = useMemo(() => {
    let filtered = sales;

    // Filter by Store
    if (storeFilter !== 'all') {
      filtered = filtered.filter(s => s.storeId === storeFilter);
    }

    // Filter by Seller
    if (sellerFilter !== 'all') {
      filtered = filtered.filter(s => s.sellerId === sellerFilter);
    }

    // Filter by Date
    const now = new Date();
    if (dateFilter === 'today') {
      filtered = filtered.filter(s => new Date(s.createdAt).toDateString() === now.toDateString());
    } else if (dateFilter === 'this_week') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      filtered = filtered.filter(s => new Date(s.createdAt) >= startOfWeek);
    } else if (dateFilter === 'this_month') {
      filtered = filtered.filter(s => {
        const d = new Date(s.createdAt);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
    }

    return filtered;
  }, [sales, storeFilter, sellerFilter, dateFilter]);
  const categoryData = useMemo(() => {
    const categories: Record<string, number> = {};
    filteredSales.forEach(sale => {
      sale.items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        const category = product?.category || 'Outros';
        const itemTotal = (item.price - (item.discount || 0)) * item.quantity;
        categories[category] = (categories[category] || 0) + itemTotal;
      });
    });
    return Object.entries(categories).map(([name, value]) => ({ name, value }));
  }, [filteredSales, products]);

  const storeData = useMemo(() => {
    return stores.map(store => {
      const storeSales = filteredSales.filter(s => s.storeId === store.id);
      const totalVendas = storeSales.reduce((acc, curr) => acc + curr.total, 0);
      return {
        name: store.name,
        vendas: totalVendas,
        meta: 100000 // Meta fictícia para visualização
      };
    });
  }, [filteredSales, stores]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Relatórios</h1>
          <p className="text-slate-500">Indicadores de performance e vendas</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50 transition-all outline-none"
          >
            <option value="all">Todo o Período</option>
            <option value="today">Hoje</option>
            <option value="this_week">Esta Semana</option>
            <option value="this_month">Este Mês</option>
          </select>

          <select
            disabled={user?.role === 'GERENTE'}
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50 transition-all outline-none disabled:opacity-50"
          >
            <option value="all">Todas as Lojas</option>
            {stores.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <select
            value={sellerFilter}
            onChange={(e) => setSellerFilter(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50 transition-all outline-none"
          >
            <option value="all">Todos os Vendedores</option>
            {employees.filter(e => e.role === 'VENDEDOR' || e.role === 'GERENTE').map(e => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>

          <button className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-all shadow-lg shadow-blue-100">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Exportar PDF</span>
          </button>
        </div>
      </header>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total de Vendas Filtradas</p>
          <h2 className="text-3xl font-black text-slate-900 mt-1">
            {(filteredSales.reduce((acc, curr) => acc + curr.total, 0) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </h2>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Quantidade de Pedidos</p>
          <h2 className="text-3xl font-black text-blue-600 mt-1">{filteredSales.length}</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold mb-6">Vendas por Categoria</h3>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR')}`}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold mb-6">Performance por Loja (Vendas vs Meta)</h3>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={storeData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontWeight: 600 }} />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="vendas" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                <Bar dataKey="meta" fill="#e2e8f0" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-lg font-bold">Relatórios Rápidos</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          <button className="p-6 text-left hover:bg-slate-50 transition-all flex items-center gap-4 group">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-slate-900">Relatório de Comissão</p>
              <p className="text-sm text-slate-500">Vendedores e metas individuais</p>
            </div>
          </button>
          <button className="p-6 text-left hover:bg-slate-50 transition-all flex items-center gap-4 group">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-all">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-slate-900">Fluxo de Caixa</p>
              <p className="text-sm text-slate-500">Entradas e saídas operacionais</p>
            </div>
          </button>
          <button className="p-6 text-left hover:bg-slate-50 transition-all flex items-center gap-4 group">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl group-hover:bg-purple-600 group-hover:text-white transition-all">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-slate-900">Giro de Estoque</p>
              <p className="text-sm text-slate-500">Produtos com maior saída por CD</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Reports;
