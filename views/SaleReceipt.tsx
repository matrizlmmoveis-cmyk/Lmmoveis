
import { Sale, Customer } from '../types.ts';
import { STORES as STORES_DATA, SELLERS as SELLERS_DATA, PRODUCTS as PRODUCTS_DATA, INITIAL_CUSTOMERS } from '../constants.tsx';
import { Printer, ArrowLeft, FileText, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { nfEmailService } from '../services/nfe/nfeService';
import { SEFAZTxtGenerator } from '../services/nfe/sefazGenerator';
import { NFeIssuer, NFeDest, NFeItem } from '../services/nfe/types';

interface SaleReceiptProps {
  sale: Sale;
  onBack: () => void;
}

const SaleReceipt: React.FC<SaleReceiptProps> = ({ sale, onBack }) => {
  const [isEmitting, setIsEmitting] = React.useState(false);
  const [nfeStatus, setNfeStatus] = React.useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = React.useState('');

  const store = STORES_DATA.find(s => s.id === sale.storeId);
  const seller = SELLERS_DATA.find(s => s.id === sale.sellerId);

  const handlePrint = () => {
    window.print();
  };

  const handleEmitNFe = async () => {
    setIsEmitting(true);
    setNfeStatus('idle');
    setErrorMessage('');

    try {
      // 1. Validar / Buscar dados completos do cliente
      const customer = INITIAL_CUSTOMERS.find(c => c.document === sale.customerCpf);
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
        const prod = PRODUCTS_DATA.find(p => p.id === item.productId);
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
    <div className="max-w-4xl mx-auto p-2 md:p-8 bg-white shadow-lg min-h-screen">
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

      <div className="border-2 border-black p-4 text-[12px] text-black leading-snug font-sans bg-white">
        <div className="bg-[#f8fafc] flex items-stretch mb-4 border border-black overflow-hidden">
          <div className="bg-[#1e293b] p-4 flex items-center justify-center w-28 border-r border-black shrink-0">
            <div className="border-2 border-white p-1 rounded-sm text-white font-black text-center">
              LM
            </div>
          </div>
          <div className="flex-1 px-4 py-2 flex flex-col justify-center">
            <h1 className="text-center font-black text-xl mb-0.5 uppercase tracking-tighter">Móveis LM - Gestão Pro</h1>
            <div className="text-[9px] font-bold text-center space-y-0 opacity-80">
              {STORES_DATA.map(s => (
                <p key={s.id} className="leading-tight uppercase">{s.name} - {s.phones?.[0]}</p>
              ))}
            </div>
          </div>
          <div className="px-6 py-2 text-center border-l border-black flex flex-col justify-center bg-white shrink-0">
            <p className="text-[10px] font-black uppercase text-slate-400 mb-0">Código Venda</p>
            <p className="font-black text-[32px] text-blue-700 leading-none">#{sale.id}</p>
            <p className="text-[10px] font-bold mt-1 uppercase opacity-60">Data: {sale.date}</p>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-x-4 gap-y-1 mb-4 border border-black p-3 bg-slate-50/50">
          <div className="col-span-8"><span className="font-black uppercase text-[9px] text-slate-400">Comprador:</span> <p className="font-black uppercase text-[14px]">{sale.customerName}</p></div>
          <div className="col-span-4"><span className="font-black uppercase text-[9px] text-slate-400">CPF/CNPJ:</span> <p className="font-bold">{sale.customerCpf}</p></div>
          <div className="col-span-12 mt-1"><span className="font-black uppercase text-[9px] text-slate-400">Local de Entrega:</span> <p className="font-bold uppercase text-[12px]">{sale.deliveryAddress}</p></div>
          <div className="col-span-12"><span className="font-black uppercase text-[9px] text-slate-400">Referência:</span> <p className="italic uppercase text-[10px] font-medium">{sale.customerReference}</p></div>
          <div className="col-span-6 mt-1"><span className="font-black uppercase text-[9px] text-slate-400">Contato:</span> <p className="font-bold">{sale.customerPhone}</p></div>
          <div className="col-span-6 mt-1"><span className="font-black uppercase text-[9px] text-slate-400">Vendedor(a):</span> <p className="font-bold uppercase">{seller?.name}</p></div>
        </div>

        <table className="w-full border-collapse border border-black mb-4">
          <thead className="bg-slate-100">
            <tr className="border-b border-black text-[10px] font-black uppercase">
              <th className="border-r border-black p-2 text-left">Itens do Pedido</th>
              <th className="border-r border-black p-2 text-center w-14">QTD</th>
              <th className="border-r border-black p-2 text-right w-24">Unit.</th>
              <th className="p-2 text-right w-28">Total Item</th>
            </tr>
          </thead>
          <tbody className="text-[12px]">
            {sale.items.map((item, i) => {
              const prod = PRODUCTS_DATA.find(p => p.id === item.productId);
              return (
                <tr key={i} className="border-b border-black h-10">
                  <td className="border-r border-black px-3 uppercase font-black text-[11px]">{prod?.name}</td>
                  <td className="border-r border-black px-2 text-center font-black">{item.quantity}</td>
                  <td className="border-r border-black px-3 text-right">R$ {item.price.toFixed(2)}</td>
                  <td className="px-3 text-right font-black text-blue-800">R$ {(item.price * item.quantity * (1 - item.discount / 100)).toFixed(2)}</td>
                </tr>
              )
            })}
            {[...Array(4)].map((_, i) => (
              <tr key={`empty-${i}`} className="border-b border-black h-8 opacity-20">
                <td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-black text-[18px] bg-slate-50">
              <td colSpan={3} className="text-right p-3 border-r border-black uppercase tracking-widest text-slate-400">Valor Total do Pedido:</td>
              <td className="p-3 text-right text-blue-700">R$ {sale.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            </tr>
          </tfoot>
        </table>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="border border-black p-3 h-28 bg-amber-50/30">
            <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Informações Adicionais / Entrega:</p>
            <p className="font-bold uppercase text-[11px] leading-relaxed">{sale.deliveryObs || 'Sem observações adicionais.'}</p>
            {sale.assemblyRequired && (
              <p className="mt-2 text-emerald-700 font-black text-[10px] border border-emerald-200 bg-emerald-50 px-2 py-1 rounded inline-block">SOLICITADO MONTAGEM</p>
            )}
          </div>
          <div className="border border-black p-3 flex flex-col justify-end items-center">
            <div className="w-full border-t border-black mb-1"></div>
            <p className="text-[9px] font-black uppercase text-slate-400">Assinatura de Recebimento</p>
          </div>
        </div>

        <div className="text-[8px] text-center font-bold text-slate-400 uppercase tracking-[0.2em] border-t border-slate-100 pt-2">
          Este documento é para controle interno e romaneio - Verifique seus produtos no ato da entrega - ID {sale.id}
        </div>
      </div>
    </div>
  );
};

export default SaleReceipt;
