
import React, { useMemo } from 'react';
import { Employee, Sale, Store } from '../types.ts';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { DollarSign, ShoppingBag, PackageCheck, AlertCircle } from 'lucide-react';

interface DashboardProps {
  user: Employee | { id: 'admin', name: 'Lucas', role: 'ADMIN', storeId?: string } | null;
  sales: Sale[];
  stores: Store[];
}

const Dashboard: React.FC<DashboardProps> = ({ user, sales, stores }) => {
  const filteredSales = useMemo(() => {
    if (user?.role === 'GERENTE' && user.storeId) {
      return sales.filter(sale => sale.storeId === user.storeId);
    }
    return sales;
  }, [user, sales]);

  // Calculate dynamic data based on filteredSales (simplified for now)
  const totalSalesToday = filteredSales.reduce((sum, sale) => sum + sale.total, 0);
  const totalDeliveriesToday = filteredSales.filter(sale => sale.status === 'Em Rota' || sale.status === 'Entregue').length;

  const data = [
    { name: 'Seg', vendas: totalSalesToday * 0.8, entregas: totalDeliveriesToday * 0.7 },
    { name: 'Ter', vendas: totalSalesToday * 0.9, entregas: totalDeliveriesToday * 0.8 },
    { name: 'Qua', vendas: totalSalesToday * 0.7, entregas: totalDeliveriesToday * 0.9 },
    { name: 'Qui', vendas: totalSalesToday * 1.1, entregas: totalDeliveriesToday * 1.0 },
    { name: 'Sex', vendas: totalSalesToday * 0.6, entregas: totalDeliveriesToday * 1.2 },
    { name: 'Sab', vendas: totalSalesToday * 1.3, entregas: totalDeliveriesToday * 1.1 },
    { name: 'Dom', vendas: totalSalesToday * 0.5, entregas: totalDeliveriesToday * 0.6 },
  ];
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Visão Geral {user?.role === 'GERENTE' && user.storeId ? `da Loja ${stores.find(s => s.id === user.storeId)?.name}` : ''}</h1>
        <p className="text-slate-500">Resumo de operações de hoje</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <DollarSign className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">+12%</span>
          </div>
          <p className="text-sm text-slate-500 mb-1">Faturamento Hoje</p>
          <h3 className="text-2xl font-bold text-slate-900">R$ {totalSalesToday.toFixed(2)}</h3>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">+5%</span>
          </div>
          <p className="text-sm text-slate-500 mb-1">Vendas Concluídas</p>
          <h3 className="text-2xl font-bold text-slate-900">{filteredSales.length}</h3>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
              <PackageCheck className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">15 pendentes</span>
          </div>
          <p className="text-sm text-slate-500 mb-1">Entregas do Dia</p>
          <h3 className="text-2xl font-bold text-slate-900">{totalDeliveriesToday}</h3>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-red-50 text-red-600 rounded-xl">
              <AlertCircle className="w-6 h-6" />
            </div>
          </div>
          <p className="text-sm text-slate-500 mb-1">Assistências Abertas</p>
          <h3 className="text-2xl font-bold text-slate-900">0</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h4 className="text-lg font-semibold mb-6">Faturamento Semanal</h4>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="vendas" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h4 className="text-lg font-semibold mb-6">Eficiência de Entregas</h4>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="entregas" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {user?.role === 'ADMIN' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-900">Visão Consolidada por Unidade (Hoje)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Unidade</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-right">Faturamento</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-center">Pedidos</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-center">Ticket Médio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stores.map(store => {
                  const sSales = sales.filter(s => s.storeId === store.id && new Date(s.createdAt).toDateString() === new Date().toDateString());
                  const sTotal = sSales.reduce((acc, curr) => acc + curr.total, 0);
                  const sTicket = sSales.length > 0 ? sTotal / sSales.length : 0;
                  return (
                    <tr key={store.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-900">{store.name}</td>
                      <td className="px-6 py-4 font-medium text-slate-700 text-right">{sTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      <td className="px-6 py-4 font-medium text-slate-700 text-center">{sSales.length}</td>
                      <td className="px-6 py-4 font-medium text-slate-700 text-center">{sTicket.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
