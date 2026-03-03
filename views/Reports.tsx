import React, { useMemo, useState, useRef } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Download, FileText, Printer, X } from 'lucide-react';
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
  const [dateFilter, setDateFilter] = useState('this_month');
  const [storeFilter, setStoreFilter] = useState(user?.role === 'GERENTE' ? (user.storeId || 'all') : 'all');
  const [sellerFilter, setSellerFilter] = useState('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showPdf, setShowPdf] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const filteredSales = useMemo(() => {
    let filtered = sales.filter(s => s.status !== 'Cancelada');

    if (storeFilter !== 'all') filtered = filtered.filter(s => s.storeId === storeFilter);
    if (sellerFilter !== 'all') filtered = filtered.filter(s => s.sellerId === sellerFilter);

    const now = new Date();
    if (dateFilter === 'today') {
      filtered = filtered.filter(s => new Date(s.date).toDateString() === now.toDateString());
    } else if (dateFilter === 'this_week') {
      const start = new Date(now); start.setDate(now.getDate() - now.getDay());
      filtered = filtered.filter(s => new Date(s.date) >= start);
    } else if (dateFilter === 'this_month') {
      filtered = filtered.filter(s => {
        const d = new Date(s.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
    } else if (dateFilter === 'custom' && customStart && customEnd) {
      const start = new Date(customStart + 'T00:00:00');
      const end = new Date(customEnd + 'T23:59:59');
      filtered = filtered.filter(s => {
        const d = new Date(s.date);
        return d >= start && d <= end;
      });
    }

    return filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [sales, storeFilter, sellerFilter, dateFilter, customStart, customEnd]);

  const categoryData = useMemo(() => {
    const categories: Record<string, number> = {};
    filteredSales.forEach(sale => {
      sale.items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        const category = product?.category || 'Outros';
        const itemTotal = item.price * item.quantity;
        categories[category] = (categories[category] || 0) + itemTotal;
      });
    });
    return Object.entries(categories).map(([name, value]) => ({ name, value }));
  }, [filteredSales, products]);

  const storeData = useMemo(() => {
    return stores.map(store => ({
      name: store.name,
      vendas: filteredSales.filter(s => s.storeId === store.id).reduce((acc, curr) => acc + curr.total, 0),
      meta: 100000
    }));
  }, [filteredSales, stores]);

  const totalGeral = filteredSales.reduce((acc, s) => acc + s.total, 0);

  // Totais por forma de pagamento
  const paymentTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    filteredSales.forEach(sale => {
      (sale.payments || []).forEach(p => {
        const method = p.method || 'Outros';
        totals[method] = (totals[method] || 0) + (p.amount || 0);
      });
    });
    return totals;
  }, [filteredSales]);

  const getPaymentLabel = (method: string) => {
    const map: Record<string, string> = {
      'Dinheiro': 'Dinheiro',
      'PIX': 'Pix',
      'Cartão de Crédito': 'Cartão de Crédito',
      'Cartão Crédito': 'Cartão de Crédito',
      'Cartão de Débito': 'Cartão de Débito',
      'Cartão Débito': 'Cartão de Débito',
      'Entrega': 'Pagar na Entrega',
      'Boleto': 'Boleto',
      'Crediário': 'Crediário',
    };
    return map[method] || method;
  };

  const getDateLabel = () => {
    if (dateFilter === 'today') return `Hoje (${new Date().toLocaleDateString('pt-BR')})`;
    if (dateFilter === 'this_week') return 'Esta Semana';
    if (dateFilter === 'this_month') return `Mês ${new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`;
    if (dateFilter === 'custom' && customStart && customEnd)
      return `De: ${new Date(customStart + 'T12:00').toLocaleDateString('pt-BR')} até: ${new Date(customEnd + 'T12:00').toLocaleDateString('pt-BR')}`;
    return 'Todo o Período';
  };

  const getSellerName = (sellerId: string) => employees.find(e => e.id === sellerId)?.name || '—';
  const getStoreName = (storeId: string) => stores.find(s => s.id === storeId)?.name || '—';

  const handlePrint = () => {
    window.print();
  };

  const handlePrintHtml = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Relatório de Vendas - Móveis LM</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; text-transform: uppercase; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 10px; }
            .footer { margin-top: 30px; text-align: right; font-weight: bold; }
            .total-row { background-color: #eee; font-weight: bold; }
            h1 { margin: 0; font-size: 24px; }
            .subtitle { color: #666; margin-top: 5px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Relatório de Vendas</h1>
            <div class="subtitle">${storeFilter !== 'all' ? getStoreName(storeFilter) : 'Todas as Lojas'} | ${getDateLabel()}</div>
            ${sellerFilter !== 'all' ? `<div class="subtitle">Vendedor: ${getSellerName(sellerFilter)}</div>` : ''}
          </div>
          <table>
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Data</th>
                <th>Cliente</th>
                <th>Vendedor</th>
                <th>Produtos</th>
                <th style="text-align: right">Total</th>
                <th>Pagamento</th>
              </tr>
            </thead>
            <tbody>
              ${filteredSales.map(sale => {
      const itemsList = sale.items.map(item => {
        const prod = products.find(p => p.id === item.productId);
        return `${item.quantity}x ${prod?.name || item.productId}`;
      }).join(', ');

      const paymentsStr = (sale.payments || []).map(p => `${getPaymentLabel(p.method)}: R$ ${p.amount.toFixed(2)}`).join(' / ');

      return `
                  <tr>
                    <td>${sale.id}</td>
                    <td>${new Date(sale.date).toLocaleDateString('pt-BR')}</td>
                    <td>${sale.customerName}</td>
                    <td>${getSellerName(sale.sellerId)}</td>
                    <td>${itemsList}</td>
                    <td style="text-align: right">R$ ${sale.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td>${paymentsStr}</td>
                  </tr>
                `;
    }).join('')}
              <tr class="total-row">
                <td colspan="5" style="text-align: right">TOTAL GERAL</td>
                <td style="text-align: right">R$ ${totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
          <div class="footer">
            ${Object.entries(paymentTotals).map(([method, amount]) => `
              <div>${getPaymentLabel(method)}: R$ ${Number(amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            `).join('')}
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Print PDF view
  if (showPdf) {
    return (
      <div className="space-y-0">
        {/* Toolbar - no-print */}
        <div className="no-print flex items-center justify-between gap-4 mb-6 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <button
            onClick={() => setShowPdf(false)}
            className="flex items-center gap-2 text-slate-600 font-bold text-sm hover:text-slate-900 transition-all"
          >
            <X className="w-4 h-4" /> Fechar PDF
          </button>
          <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
            {filteredSales.length} pedidos · {totalGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
          >
            <Printer className="w-4 h-4" /> Imprimir / Salvar PDF
          </button>
        </div>

        {/* PDF Content */}
        <div ref={printRef} className="bg-white p-8 print:p-6 max-w-[1100px] mx-auto shadow-xl rounded-2xl print:shadow-none print:rounded-none">
          {/* Header */}
          <div className="text-center mb-6 border-b-2 border-black pb-4">
            <h1 className="text-3xl font-black text-black">Relatório de Vendas</h1>
            <p className="text-sm text-gray-600 mt-1 font-medium">
              {storeFilter !== 'all' ? getStoreName(storeFilter) : 'Todas as Lojas'} &nbsp;·&nbsp; {getDateLabel()}
            </p>
            {sellerFilter !== 'all' && (
              <p className="text-xs text-gray-500 mt-0.5">Vendedor: {getSellerName(sellerFilter)}</p>
            )}
          </div>

          {/* Tabela principal */}
          <table className="w-full border-collapse text-sm mb-6" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#e8eaf6' }}>
                <th className="border border-gray-400 px-3 py-2 text-left font-black text-black text-xs uppercase">Pedido</th>
                <th className="border border-gray-400 px-3 py-2 text-left font-black text-black text-xs uppercase">Data</th>
                <th className="border border-gray-400 px-3 py-2 text-left font-black text-black text-xs uppercase">Cliente</th>
                <th className="border border-gray-400 px-3 py-2 text-left font-black text-black text-xs uppercase">Vendedor</th>
                <th className="border border-gray-400 px-3 py-2 text-left font-black text-black text-xs uppercase">Produtos</th>
                <th className="border border-gray-400 px-3 py-2 text-right font-black text-black text-xs uppercase">Total</th>
                <th className="border border-gray-400 px-3 py-2 text-left font-black text-black text-xs uppercase">Pagamento</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.map((sale, idx) => {
                const rowBg = idx % 2 === 0 ? '#ffffff' : '#f9fafb';
                const itemsList = sale.items.map(item => {
                  const prod = products.find(p => p.id === item.productId);
                  return `QTD${item.quantity}: ${prod?.name || item.productId} - R$ ${(item.price * item.quantity).toFixed(2)} /`;
                }).join(' ');

                const paymentsStr = (sale.payments || []).map(p => {
                  const label = getPaymentLabel(p.method);
                  return `${label}: $ ${p.amount.toFixed(2)}`;
                }).join(' / ');

                return (
                  <tr key={sale.id} style={{ backgroundColor: rowBg }}>
                    <td className="border border-gray-300 px-3 py-2 font-bold text-xs text-gray-800 align-top">{sale.id}</td>
                    <td className="border border-gray-300 px-3 py-2 text-xs text-gray-700 align-top whitespace-nowrap">
                      {new Date(sale.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-xs text-gray-800 font-medium align-top">{sale.customerName}</td>
                    <td className="border border-gray-300 px-3 py-2 text-xs text-gray-700 align-top">{getSellerName(sale.sellerId)}</td>
                    <td className="border border-gray-300 px-3 py-2 text-xs text-gray-700 align-top">{itemsList}</td>
                    <td className="border border-gray-300 px-3 py-2 text-xs font-bold text-gray-900 text-right align-top whitespace-nowrap">
                      R$ {sale.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-xs text-gray-700 align-top">{paymentsStr}</td>
                  </tr>
                );
              })}

              {/* Linha de TOTAL */}
              <tr style={{ backgroundColor: '#c5cae9' }}>
                <td colSpan={5} className="border border-gray-400 px-3 py-2 text-right font-black text-sm text-black uppercase" style={{ textAlign: 'right' }}>
                  TOTAL
                </td>
                <td className="border border-gray-400 px-3 py-2 text-right font-black text-sm text-black whitespace-nowrap">
                  R$ {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td className="border border-gray-400 px-3 py-2"></td>
              </tr>
            </tbody>
          </table>

          {/* Totais por forma de pagamento */}
          <div className="text-right text-sm space-y-0.5">
            {Object.entries(paymentTotals).map(([method, amount]) => (
              <p key={method} className="text-gray-700 font-medium">
                {getPaymentLabel(method)}: <span className="font-bold">R$ {Number(amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </p>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Normal view
  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Relatórios</h1>
          <p className="text-slate-500">Indicadores de performance e vendas</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50 transition-all outline-none"
          >
            <option value="all">Todo o Período</option>
            <option value="today">Hoje</option>
            <option value="this_week">Esta Semana</option>
            <option value="this_month">Este Mês</option>
            <option value="custom">Período Personalizado</option>
          </select>

          {dateFilter === 'custom' && (
            <>
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none" />
              <span className="flex items-center text-slate-400 text-sm font-bold">até</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none" />
            </>
          )}

          <select
            disabled={user?.role === 'GERENTE'}
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50 transition-all outline-none disabled:opacity-50"
          >
            <option value="all">Todas as Lojas</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
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

          <button
            onClick={handlePrintHtml}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-900 transition-all shadow-lg shadow-slate-200"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir HTML</span>
          </button>

          <button
            onClick={() => setShowPdf(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
          >
            <Download className="w-4 h-4" />
            <span>Gerar PDF</span>
          </button>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total de Vendas Filtradas</p>
          <h2 className="text-3xl font-black text-slate-900 mt-1">
            {totalGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </h2>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Quantidade de Pedidos</p>
          <h2 className="text-3xl font-black text-blue-600 mt-1">{filteredSales.length}</h2>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold mb-6">Vendas por Categoria</h3>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" innerRadius={80} outerRadius={120} paddingAngle={5} dataKey="value">
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR')}`} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold mb-6">Performance por Loja</h3>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={storeData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontWeight: 600 }} />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="vendas" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-lg font-bold">Relatórios Rápidos</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          <button onClick={() => setShowPdf(true)} className="p-6 text-left hover:bg-slate-50 transition-all flex items-center gap-4 group">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-slate-900">Relatório de Vendas (PDF)</p>
              <p className="text-sm text-slate-500">Com itens, pagamentos e totais</p>
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
