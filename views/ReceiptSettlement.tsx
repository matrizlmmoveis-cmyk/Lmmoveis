import React, { useState, useEffect } from 'react';
import { supabaseService } from '../services/supabaseService';
import { Sale, Payment, Employee, Store } from '../types';
import { CheckCircle2, DollarSign, Clock, HelpCircle, User, MapPin } from 'lucide-react';

interface ReceiptSettlementProps {
    sales: Sale[];
    setSales: React.Dispatch<React.SetStateAction<Sale[]>>;
    employees: Employee[];
    stores: Store[];
}

const ReceiptSettlement: React.FC<ReceiptSettlementProps> = ({ sales, setSales, employees, stores }) => {
    const [activeTab, setActiveTab] = useState<'AGUARDANDO' | 'CONFERIDOS'>('AGUARDANDO');

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
                    </div>
                </div>

                {!isConferido && (
                    <div className="md:border-l md:pl-6 shrink-0 w-full md:w-auto">
                        <button
                            onClick={() => handleConfirmar(dp.sale.id, dp.payment.amount)}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
                        >
                            <DollarSign className="w-4 h-4" /> Receber
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

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
                    className={`flex-1 py-3 px-4 rounded-xl text-sm font-black uppercase tracking-wider transition-all duration-200 ${activeTab === 'AGUARDANDO'
                        ? 'bg-white text-slate-900 shadow-md ring-1 ring-slate-900/5 scale-[1.02]'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                        }`}
                >
                    Aguardando Acerto ({pendingSettlements.length})
                </button>
                <button
                    onClick={() => setActiveTab('CONFERIDOS')}
                    className={`flex-1 py-3 px-4 rounded-xl text-sm font-black uppercase tracking-wider transition-all duration-200 ${activeTab === 'CONFERIDOS'
                        ? 'bg-white text-emerald-600 shadow-md ring-1 ring-slate-900/5 scale-[1.02]'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                        }`}
                >
                    Recebidos ({completedSettlements.length})
                </button>
            </div>

            <div>
                {activeTab === 'AGUARDANDO' ? (
                    pendingSettlements.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 font-bold uppercase text-sm">Nenhum acerto pendente no momento.</div>
                    ) : (
                        pendingSettlements.map(dp => renderCard(dp, false))
                    )
                ) : (
                    completedSettlements.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 font-bold uppercase text-sm">Nenhum acerto finalizado.</div>
                    ) : (
                        completedSettlements.map(dp => renderCard(dp, true))
                    )
                )}
            </div>
        </div>
    );
};

export default ReceiptSettlement;
