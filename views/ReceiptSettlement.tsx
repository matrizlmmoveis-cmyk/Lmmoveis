import React, { useState, useEffect } from 'react';
import { supabaseService } from '../services/supabaseService';
import { Sale, Payment, Employee, Store, Product, Customer } from '../types';
import { CheckCircle2, DollarSign, Clock, HelpCircle, User, MapPin, X, FileText, Calendar, ShoppingBag, Package } from 'lucide-react';
import SaleReceipt from './SaleReceipt';

interface ReceiptSettlementProps {
    sales: Sale[];
    setSales: React.Dispatch<React.SetStateAction<Sale[]>>;
    employees: Employee[];
    stores: Store[];
    products: Product[];
    customers: Customer[];
}

const ReceiptSettlement: React.FC<ReceiptSettlementProps> = ({ sales, setSales, employees, stores, products, customers }) => {
    const [activeTab, setActiveTab] = useState<'AGUARDANDO' | 'CONFERIDOS' | 'ATACADO'>('AGUARDANDO');
    const [selectedSaleForReceipt, setSelectedSaleForReceipt] = useState<Sale | null>(null);
    const [wholesaleReservations, setWholesaleReservations] = useState<any[]>([]);
    const [loadingWholesale, setLoadingWholesale] = useState(false);

    const loadWholesale = async () => {
        setLoadingWholesale(true);
        try {
            const data = await supabaseService.getWholesaleReservations();
            // Filtrar apenas EFETIVADAS (saíram do CD) e que ainda não foram pagas
            setWholesaleReservations(data.filter(r => r.status === 'EFETIVADA'));
        } catch (err) {
            console.error("Erro ao carregar atacado para acerto:", err);
        } finally {
            setLoadingWholesale(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'ATACADO') {
            loadWholesale();
        }
    }, [activeTab]);

    // Find all 'Entrega' payments
    const deliveryPayments = sales.flatMap(sale =>
        (sale.payments || [])
            .filter(p => p.method === 'Entrega')
            .map(p => ({
                sale,
                payment: p,
                driver: employees.find(e => e.id === sale.assignedDriverId),
                store: stores.find(s => s.id === sale.storeId)
            }))
    );

    const pendingSettlements = deliveryPayments.filter(dp =>
        dp.payment.status === 'PENDENTE_ENTREGA' || dp.payment.status === 'AGUARDANDO_ACERTO' || dp.payment.status === 'PAGO_EM_LOJA'
    );
    const completedSettlements = deliveryPayments.filter(dp =>
        dp.payment.status === 'CONFERIDO'
    );

    const handleConfirmar = async (saleId: string, amount: number) => {
        try {
            await supabaseService.confirmPaymentStatus(saleId, amount);

            // Local update (for immediate UI response without reload)
            setSales(prev => prev.map(s => {
                if (s.id === saleId) {
                    return {
                        ...s,
                        payments: s.payments.map(p =>
                            (p.method === 'Entrega' && p.amount === amount)
                                ? { ...p, status: 'CONFERIDO' }
                                : p
                        )
                    }
                }
                return s;
            }));

            alert('Pagamento marcado como CONFERIDO!');
        } catch (e) {
            console.error(e);
            alert('Erro ao confirmar pagamento.');
        }
    };
    const handleConfirmarAtacado = async (res: any) => {
        try {
            await supabaseService.confirmWholesalePayment(res.id, 'Financeiro');
            setWholesaleReservations(prev => prev.filter(r => r.id !== res.id));
            alert('Pagamento de ATACADO confirmado!');
        } catch (e) {
            console.error(e);
            alert('Erro ao confirmar pagamento de atacado.');
        }
    };

    const groupSettlementsByStore = (settlements: any[]) => {
        const groups: { [key: string]: any[] } = {};
        settlements.forEach(dp => {
            const storeName = dp.store?.name || 'Loja Desconhecida';
            if (!groups[storeName]) groups[storeName] = [];
            groups[storeName].push(dp);
        });
        return groups;
    };

    const renderCard = (dp: any, isConferido: boolean) => (
        <div key={`${dp.sale.id}-${dp.payment.amount}`} className={`p-5 rounded-2xl border mb-4 font-bold ${isConferido ? 'bg-slate-50 border-slate-200' : dp.payment.status === 'PAGO_EM_LOJA' ? 'bg-violet-50 border-violet-300 shadow-sm' : 'bg-white border-blue-100 shadow-sm'}`}>
            {/* Banner de aviso para Pago na Loja */}
            {dp.payment.status === 'PAGO_EM_LOJA' && (
                <div className="flex items-center gap-2 bg-violet-600 text-white text-xs font-black uppercase px-4 py-2 rounded-xl mb-4">
                    <DollarSign className="w-4 h-4 shrink-0" />
                    <span>⚠️ PAGO NA LOJA — Motorista NÃO deve ser cobrado. Apenas confirmar o acerto.</span>
                </div>
            )}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex-1 space-y-3">
                    <div className="flex justify-between items-start">
                        <div className="flex flex-col">
                            <span className="text-xl text-slate-900 tracking-tight">Venda Nº {dp.sale.id}</span>
                            <span className="text-xs text-slate-500 uppercase flex items-center gap-1 mt-1">
                                <MapPin className="w-3 h-3" /> {dp.store?.name || 'Loja Desconhecida'}
                            </span>
                        </div>
                        <div className="text-right">
                            <span className="text-lg text-emerald-600 block">R$ {dp.payment.amount.toFixed(2)}</span>
                            <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full inline-block mt-1 ${dp.payment.status === 'PAGO_EM_LOJA' ? 'bg-violet-100 text-violet-700' :
                                dp.payment.status === 'AGUARDANDO_ACERTO' ? 'bg-amber-100 text-amber-700' :
                                    dp.payment.status === 'PENDENTE_ENTREGA' ? 'bg-slate-100 text-slate-500' :
                                        'bg-emerald-100 text-emerald-700'
                                }`}>
                                {dp.payment.status === 'PENDENTE_ENTREGA' ? 'Na Rua (Motorista)' :
                                    dp.payment.status === 'AGUARDANDO_ACERTO' ? 'Aguardando Acerto' :
                                        dp.payment.status === 'PAGO_EM_LOJA' ? 'Pago na Loja' :
                                            dp.payment.status}
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-4 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-lg">
                            <User className="w-4 h-4 text-slate-400" />
                            <span className="uppercase">Cli: {dp.sale.customerName}</span>
                        </div>
                        {dp.driver && (
                            <div className="flex items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-lg text-blue-700">
                                <Clock className="w-4 h-4" />
                                <span className="uppercase">Mot: {dp.driver.name}</span>
                            </div>
                        )}
                        {dp.payment.status === 'AGUARDANDO_ACERTO' && dp.sale.deliveryDate && (
                            <div className="flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-lg text-emerald-700 border border-emerald-100">
                                <Calendar className="w-4 h-4" />
                                <span className="uppercase font-black text-[10px]">Entregue em: {new Date(dp.sale.deliveryDate).toLocaleDateString()}</span>
                            </div>
                        )}
                        {dp.payment.status === 'PAGO_EM_LOJA' && (
                            <div className="flex items-center gap-1.5 bg-violet-50 px-3 py-1.5 rounded-lg text-violet-700 border border-violet-100">
                                <Calendar className="w-4 h-4" />
                                <span className="uppercase font-black text-[10px]">Pago na Loja Hoje</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 md:border-l md:pl-6 shrink-0 w-full md:w-auto">
                    <button
                        onClick={() => setSelectedSaleForReceipt(dp.sale)}
                        className="flex-1 md:flex-none bg-blue-50 text-blue-600 hover:bg-blue-100 p-3 rounded-2xl transition-all flex items-center justify-center gap-2"
                        title="Ver Nota"
                    >
                        <FileText className="w-5 h-5" />
                        <span className="md:hidden text-xs font-black uppercase">Ver Nota</span>
                    </button>
                    {!isConferido && (
                        <button
                            onClick={() => handleConfirmar(dp.sale.id, dp.payment.amount)}
                            className="flex-[2] md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
                        >
                            <DollarSign className="w-4 h-4" /> Receber
                        </button>
                    )}
                </div>
            </div>
        </div>
    );

    const renderWholesaleCard = (res: any) => (
        <div key={res.id} className="p-5 rounded-2xl border mb-4 font-bold bg-blue-50/50 border-blue-200 shadow-sm transition-all hover:bg-blue-50">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex-1 space-y-3">
                    <div className="flex justify-between items-start">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Reserva Atacado</span>
                            <span className="text-xl text-slate-900 tracking-tight">{res.wholesalerName}</span>
                            <span className="text-xs text-slate-500 uppercase flex items-center gap-1 mt-1">
                                <Package className="w-3 h-3" /> {res.productName} ({res.quantity} un)
                            </span>
                        </div>
                        <div className="text-right">
                            <span className="text-lg text-blue-700 block">R$ {(res.wholesalePrice * res.quantity).toFixed(2)}</span>
                            <span className="text-[10px] uppercase px-2 py-0.5 rounded-full inline-block mt-1 bg-blue-100 text-blue-700">
                                Aguardando Pagamento
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-4 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5 bg-white/50 px-3 py-1.5 rounded-lg border border-blue-100">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            <span className="uppercase">Saída: {res.dispatchedAt ? new Date(res.dispatchedAt).toLocaleDateString() : 'N/D'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white/50 px-3 py-1.5 rounded-lg border border-blue-100">
                            <User className="w-4 h-4 text-slate-400" />
                            <span className="uppercase">Conf: {res.dispatchedBy || 'Sist.'}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 md:border-l md:pl-6 shrink-0 w-full md:w-auto">
                    <button
                        onClick={() => handleConfirmarAtacado(res)}
                        className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-2xl text-xs font-black uppercase shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                        <DollarSign className="w-4 h-4" /> Receber Atacado
                    </button>
                </div>
            </div>
        </div>
    );

    const groupedData = groupSettlementsByStore(activeTab === 'AGUARDANDO' ? pendingSettlements : completedSettlements);

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in slide-in-from-left duration-500 pb-20">
            <header className="bg-slate-900 p-8 rounded-[2rem] text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
                <div className="flex items-center gap-4 relative z-10">
                    <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-sm">
                        <DollarSign className="w-8 h-8 text-emerald-400" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black uppercase tracking-tight">Acerto de Entregadores</h1>
                        <p className="text-slate-400 font-medium mt-1">Gerencie os valores recebidos em campo pelas equipes de entrega</p>
                    </div>
                </div>
            </header>

            <div className="flex gap-2 p-1.5 bg-slate-200/50 rounded-2xl">
                <button
                    onClick={() => setActiveTab('AGUARDANDO')}
                    className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${activeTab === 'AGUARDANDO'
                        ? 'bg-white text-slate-900 shadow-md ring-1 ring-slate-900/5 scale-[1.02]'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                        }`}
                >
                    Entregadores ({pendingSettlements.length})
                </button>
                <button
                    onClick={() => setActiveTab('ATACADO')}
                    className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${activeTab === 'ATACADO'
                        ? 'bg-white text-blue-600 shadow-md ring-1 ring-slate-900/5 scale-[1.02]'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                        }`}
                >
                    Atacado ({wholesaleReservations.length})
                </button>
                <button
                    onClick={() => setActiveTab('CONFERIDOS')}
                    className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${activeTab === 'CONFERIDOS'
                        ? 'bg-white text-emerald-600 shadow-md ring-1 ring-slate-900/5 scale-[1.02]'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                        }`}
                >
                    Recebidos ({completedSettlements.length})
                </button>
            </div>

            <div className="space-y-8">
                {activeTab === 'ATACADO' ? (
                    loadingWholesale ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Carregando atacado...</p>
                        </div>
                    ) : wholesaleReservations.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 font-bold uppercase text-sm italic">Nenhuma reserva de atacado pendente de acerto.</div>
                    ) : (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                             <div className="flex items-center gap-3 px-2 mb-6">
                                <div className="h-[1px] flex-1 bg-slate-200"></div>
                                <h2 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                                    <ShoppingBag className="w-3 h-3" /> Cobranças Localizadas ({wholesaleReservations.length})
                                </h2>
                                <div className="h-[1px] flex-1 bg-slate-200"></div>
                            </div>
                            {wholesaleReservations.map(res => renderWholesaleCard(res))}
                        </div>
                    )
                ) : Object.keys(groupedData).length === 0 ? (
                    <div className="text-center py-12 text-slate-500 font-bold uppercase text-sm">Nenhum acerto nesta aba.</div>
                ) : (
                    Object.entries(groupedData).map(([storeName, items]) => (
                        <div key={storeName} className="space-y-4 animate-in fade-in duration-300">
                            <div className="flex items-center gap-3 px-2">
                                <div className="h-[1px] flex-1 bg-slate-200"></div>
                                <h2 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                                    <MapPin className="w-3 h-3" /> {storeName} ({items.length})
                                </h2>
                                <div className="h-[1px] flex-1 bg-slate-200"></div>
                            </div>
                            <div className="grid grid-cols-1 gap-1">
                                {items.map(dp => renderCard(dp, activeTab === 'CONFERIDOS'))}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal de Visualização da Nota */}
            {selectedSaleForReceipt && (
                <div className="fixed inset-0 z-[60] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-4xl shadow-2xl relative animate-in zoom-in-95 duration-200 my-auto">
                        <button
                            onClick={() => setSelectedSaleForReceipt(null)}
                            className="absolute top-6 right-6 p-3 bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-500 rounded-2xl transition-all z-10"
                        >
                            <X className="w-6 h-6" />
                        </button>
                        <div className="p-1 md:p-8 max-h-[85vh] overflow-y-auto custom-scrollbar">
                            <SaleReceipt
                                sale={selectedSaleForReceipt}
                                stores={stores}
                                products={products}
                                employees={employees}
                                customers={customers}
                                onBack={() => setSelectedSaleForReceipt(null)}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReceiptSettlement;

