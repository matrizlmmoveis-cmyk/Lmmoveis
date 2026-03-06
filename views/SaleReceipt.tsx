import React from 'react';
import { Sale, Customer, Store, Product, Employee } from '../types.ts';
import { Printer, ArrowLeft, FileText, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { nfEmailService } from '../services/nfe/nfeService';
import { SEFAZTxtGenerator } from '../services/nfe/sefazGenerator';
import { NFeIssuer, NFeDest, NFeItem } from '../services/nfe/types';

interface SaleReceiptProps {
  sale: Sale;
  onBack: () => void;
  stores: Store[];
  products: Product[];
  employees: Employee[];
  customers: Customer[];
  hideControls?: boolean;
}

const SaleReceipt: React.FC<SaleReceiptProps> = ({ sale, onBack, stores, products, employees, customers, hideControls }) => {
  const [isEmitting, setIsEmitting] = React.useState(false);
  const [nfeStatus, setNfeStatus] = React.useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = React.useState('');

  const store = stores.find(s => s.id === sale.storeId);
  const seller = employees.find(s => s.id === sale.sellerId);

  const handlePrint = () => {
    window.print();
  };

  const handleEmitNFe = async () => {
    setIsEmitting(true);
    setNfeStatus('idle');
    setErrorMessage('');

    try {
      // 1. Validar / Buscar dados completos do cliente
      const customer = customers.find(c => c.document === sale.customerCpf);
      if (!customer) throw new Error("Dados detalhados do cliente não encontrados no cadastro.");

      // 2. Preparar Emitente (Mock da Loja Selecionada)
      const issuer: NFeIssuer = {
        name: store?.name || 'Móveis LM',
        cnpj: '12345678000199', // Mock
        state: 'RJ',
        ibge: '3304557',
        street: store?.location || 'Rua Principal',
        number: '100',
        neighborhood: 'Centro',
        city: 'Rio de Janeiro',
        cep: '20000000'
      };

      // 3. Preparar Destinatário
      const dest: NFeDest = {
        name: customer.name,
        document: customer.document,
        type: customer.type === 'PJ' ? 'CNPJ' : 'CPF',
        email: customer.email,
        street: customer.address,
        number: customer.number,
        neighborhood: customer.neighborhood,
        city: customer.city,
        state: customer.state,
        cep: customer.zipCode,
        ibge: '3304557' // Mock IBGE
      };

      // 4. Preparar Itens
      const items: NFeItem[] = sale.items.map(item => {
        const prod = products.find(p => p.id === item.productId);
        return {
          description: prod?.name || 'Produto',
          ncm: '94036000', // Mock NCM para móveis de madeira
          cfop: '5102', // Venda de mercadoria
          unit: 'UN',
          qty: item.quantity,
          unitValue: item.price,
          totalValue: item.price * item.quantity * (1 - item.discount / 100)
        };
      });

      // 5. Configurar API (Credenciais Mock)
      nfEmailService.setConfig({
        cnpj: issuer.cnpj,
        apiKey: 'sk_test_api_key_nfe_lm'
      });

      // 6. Gerar TXT
      const txtContent = SEFAZTxtGenerator.generate(issuer, dest, items, parseInt(sale.id), 1);
      console.log("TXT SEFAZ Gerado:\n", txtContent);

      // 7. Transmitir
      const response = await nfEmailService.sendNFe(txtContent);
      console.log("Resposta API:", response);

      setNfeStatus('success');
    } catch (error: any) {
      console.error("Erro na emissão:", error);
      setNfeStatus('error');
      setErrorMessage(error.message || "Erro desconhecido na transmissão.");
    } finally {
      setIsEmitting(false);
    }
  };

  return (
    <div className={hideControls ? "bg-white" : "max-w-4xl mx-auto p-2 md:p-8 bg-white shadow-lg min-h-screen"}>
      {!hideControls && (
        <div className="no-print flex flex-col md:flex-row justify-between items-center gap-4 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-600 font-semibold hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para Vendas
          </button>

          <div className="flex items-center gap-3">
            {nfeStatus === 'success' && (
              <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 text-xs font-bold animate-in fade-in zoom-in duration-300">
                <CheckCircle className="w-4 h-4" />
                <span>NF-e Emitida!</span>
              </div>
            )}

            {nfeStatus === 'error' && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100 text-[10px] font-bold max-w-[200px] truncate animate-in fade-in zoom-in duration-300" title={errorMessage}>
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Erro: {errorMessage}</span>
              </div>
            )}

            <button
              onClick={handleEmitNFe}
              disabled={isEmitting || nfeStatus === 'success'}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold shadow-lg transition-all ${nfeStatus === 'success'
                ? 'bg-slate-200 text-slate-500 cursor-not-allowed shadow-none'
                : 'bg-emerald-600 text-white shadow-emerald-100 hover:bg-emerald-700 disabled:opacity-70'
                }`}
            >
              {isEmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Transmitindo...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  Emitir NF-e
                </>
              )}
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all"
            >
              <Printer className="w-4 h-4" />
              Imprimir Recibo
            </button>
          </div>
        </div>
      )}

      {/* PRINTABLE RECEIPT */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            /* Hide only the UI shell components */
            .no-print, nav, aside, button, .Sidebar, [role="navigation"], header.no-print {
              display: none !important;
            }

            /* Ensure the page-level containers don't restrict the print */
            html, body, #root, main, section {
              height: auto !important;
              min-height: 0 !important;
              overflow: visible !important;
              margin: 0 !important;
              padding: 0 !important;
              background-color: white !important;
              position: static !important;
              width: 100% !important;
            }

            @page {
              margin: 5mm;
              size: auto;
            }

            /* Receipt Content Styling */
            .print-container { 
              display: flex !important;
              flex-direction: column !important;
              box-shadow: none !important; 
              margin: 0 auto !important; 
              padding: 0 !important;
              width: 100% !important;
              max-width: 19cm !important; /* Fits safely on A4 with 5mm margins */
              border: 2px solid black !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            /* Aggressive color and layout preservation */
            .print-container * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            /* Hide scrollbars (universal) */
            ::-webkit-scrollbar { display: none !important; }
            * { scrollbar-width: none !important; -ms-overflow-style: none !important; }
          }
        `
      }} />
      <div className="border-2 border-black text-[11.5px] text-black font-sans bg-white max-w-[780px] mx-auto print-container" style={{ minHeight: '1050px', display: 'flex', flexDirection: 'column' }}>

        {/* ── HEADER ─────────────────────────────────── */}
        <div className="flex border-b-2 border-black">
          {/* Logo — inline SVG, always renders in print */}
          <div className="flex items-center justify-center shrink-0 border-r border-black" style={{ width: '150px', minHeight: '100px', backgroundColor: '#2d2d2d' }}>
            <svg width="100" height="100" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* House outline */}
              <polygon points="30,6 56,28 52,28 52,54 8,54 8,28 4,28" fill="none" stroke="white" strokeWidth="3" strokeLinejoin="round" />
              {/* Door */}
              <rect x="24" y="38" width="12" height="16" fill="white" />
              {/* Sofa body */}
              <rect x="14" y="32" width="32" height="10" rx="3" fill="white" />
              {/* Sofa arms */}
              <rect x="11" y="30" width="7" height="12" rx="2" fill="white" />
              <rect x="42" y="30" width="7" height="12" rx="2" fill="white" />
              {/* Sofa back */}
              <rect x="14" y="26" width="32" height="8" rx="2" fill="white" />
            </svg>
          </div>

          {/* Company name + stores */}
          <div className="flex-1 px-6 py-3 flex flex-col justify-center" style={{ backgroundColor: '#e8f5e9' }}>
            <h1 className="text-center font-black uppercase leading-tight tracking-tight" style={{ fontSize: '24px' }}>
              GRUPO FERNANDES MÓVEIS
            </h1>
            <div className="text-center mt-2 space-y-0.5" style={{ fontSize: '11px', fontWeight: 700 }}>
              {store && (
                <p className="leading-snug uppercase">
                  {store.name.toUpperCase()}
                  {store.location ? ` - ${store.location.toUpperCase()}` : ''}
                  {store.phones?.[0] ? ` - ${store.phones[0]}` : ''}
                </p>
              )}
            </div>
          </div>

          {/* Pedido + date */}
          <div className="shrink-0 border-l border-black px-5 py-3 flex flex-col justify-center text-right bg-white" style={{ minWidth: '140px' }}>
            <p className="font-black uppercase" style={{ fontSize: '11px' }}>PEDIDO {sale.id}</p>
            <p className="font-bold mt-1" style={{ fontSize: '10px' }}>
              Data: {new Date(sale.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </p>
          </div>
        </div>


        {/* ── CLIENTE ──────────────────────────────────── */}
        <div className="px-4 py-3 border-b border-black space-y-1.5">
          <div className="flex gap-8 flex-wrap">
            <p><strong>Cliente:</strong> {sale.customerName}</p>
            <p><strong>CPF:</strong> {sale.customerCpf}</p>
          </div>
          <p><strong>Telefone:</strong> {sale.customerPhone}</p>
          <p><strong>Endereço:</strong> {sale.deliveryAddress}</p>
          {sale.customerReference && <p><strong>Referencia:</strong> {sale.customerReference}</p>}
          <div className="flex gap-8 flex-wrap">
            {sale.customerEmail && <p><strong>Email:</strong> {sale.customerEmail}</p>}
            <p><strong>Vendedor:</strong> {seller?.name || '—'}</p>
          </div>
          {sale.deliveryObs && (
            <p className="pt-1"><strong>OBS:</strong> {sale.deliveryObs}</p>
          )}
        </div>

        {/* ── TABELA DE ITENS ───────────────────────────── */}
        <table className="w-full border-collapse border-b border-black" style={{ flex: 1 }}>
          <thead className="bg-gray-100">
            <tr className="text-[10px] font-black uppercase border-b border-black">
              <th className="border-r border-black px-3 py-2 text-left">Produto</th>
              <th className="border-r border-black px-3 py-2 text-center w-12">QTD</th>
              <th className="border-r border-black px-3 py-2 text-center w-24">CD</th>
              <th className="border-r border-black px-3 py-2 text-right w-28">V. Unit</th>
              <th className="border-r border-black px-3 py-2 text-right w-28">Total</th>
              <th className="px-3 py-2 text-center w-16">% Desc</th>
            </tr>
          </thead>
          <tbody>
            {sale.items
              .filter(item => item.dispatchStatus !== 'DEVOLVER' && item.dispatchStatus !== 'CANCELADO' && item.dispatchStatus !== 'DEVOLVIDO')
              .map((item, i) => {
                const prod = products.find(p => p.id === item.productId);
                const sourceStore = stores.find(s => s.id === item.locationId);
                const total = item.price * item.quantity;
                return (
                  <tr key={i} className="border-b border-black" style={{ height: '36px' }}>
                    <td className="border-r border-black px-3 py-2 font-medium uppercase text-[10.5px]">{prod?.name}</td>
                    <td className="border-r border-black px-3 py-2 text-center">{item.quantity}</td>
                    <td className="border-r border-black px-3 py-2 text-center text-[10px]">{sourceStore?.name || '—'}</td>
                    <td className="border-r border-black px-3 py-2 text-right">R$ {item.price.toFixed(2)}</td>
                    <td className="border-r border-black px-3 py-2 text-right font-bold">R$ {total.toFixed(2)}</td>
                    <td className="px-3 py-2 text-center">{item.discount > 0 ? `${item.discount.toFixed(0)}%` : '0'}</td>
                  </tr>
                );
              })}
            {/* Linhas vazias — altura maior para preencher A4 */}
            {[...Array(Math.max(0, 8 - sale.items.length))].map((_, i) => (
              <tr key={`empty-${i}`} className="border-b border-black" style={{ height: '36px' }}>
                <td className="border-r border-black" />
                <td className="border-r border-black" />
                <td className="border-r border-black" />
                <td className="border-r border-black" />
                <td className="border-r border-black" />
                <td />
              </tr>
            ))}
            {/* Total row */}
            <tr>
              <td colSpan={4} className="border-r border-black px-3 py-2 text-right font-black text-[12px] uppercase">
                Total:
              </td>
              <td colSpan={2} className="px-3 py-2 text-right font-black text-[12px]">
                R$ {sale.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── PAGAMENTOS ────────────────────────────────── */}
        <div className="px-4 py-3 border-b border-black">
          <p className="text-[11.5px] font-medium">
            {(sale.payments || []).map(p => `${p.method}: $ ${p.amount.toFixed(2)}`).join(' / ')}
            {' /'}
          </p>
        </div>

        {/* ── RETIRA / MOSTRUÁRIO + DATA ─────────────────── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-black">
          <div className="flex gap-10">
            <span className="text-[11.5px]"><strong>Retira:</strong>&nbsp;Sim&nbsp;(&nbsp;&nbsp;&nbsp;)&nbsp;&nbsp;&nbsp;Não&nbsp;(&nbsp;&nbsp;&nbsp;)</span>
            <span className="text-[11.5px]"><strong>Mostruário:</strong>&nbsp;Sim&nbsp;(&nbsp;&nbsp;&nbsp;)&nbsp;&nbsp;&nbsp;Não&nbsp;(&nbsp;&nbsp;&nbsp;)</span>
          </div>
          <span className="text-[10.5px] font-bold">
            Rio de Janeiro, {new Date(sale.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </span>
        </div>

        {/* ── AVISOS ────────────────────────────────────── */}
        <div className="grid grid-cols-2 border-b border-black text-[9.5px]">
          <div className="border-r border-black px-3 py-3 leading-relaxed">
            <strong>OBS:</strong> O Atacadão dos Móveis não possui carro de entregas! Frete por conta do cliente.
            Conferir no ato do recebimento, sendo identificado alguma avaria ou falta de volumes entrar em
            contato com a loja antes do recebimento.
          </div>
          <div className="px-3 py-3 leading-relaxed">
            <strong>Atenção:</strong> Em caso de necessidade de Assistência Técnica o prazo para envio da(s) peça(s) faltante
            ou danificada são de 30 dias úteis.<br />
            Não trocamos peças de mostruário.
          </div>
        </div>

        {/* ── ASSINATURA ────────────────────────────────── */}
        <div className="flex justify-center" style={{ paddingTop: '60px', paddingBottom: '24px' }}>
          <div className="text-center">
            <div className="border-t border-black mb-1" style={{ width: '280px' }} />
            <p className="text-[10.5px] font-bold uppercase">Assinatura do Cliente</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SaleReceipt;



