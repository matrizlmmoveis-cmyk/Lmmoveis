import React, { useState, useEffect } from 'react';
import { supabaseService } from '../services/supabaseService.ts';
import { WholesaleAccount, WholesaleReservation } from '../types.ts';
import { Users, ClipboardList, Plus, UserPlus, Save, X, CheckCircle, XCircle, Clock } from 'lucide-react';

interface WholesaleManagementProps {
    user: any;
    refreshData: (scope?: any) => Promise<void>;
}

const WholesaleManagement: React.FC<WholesaleManagementProps> = ({ user, refreshData }) => {
    const [accounts, setAccounts] = useState<WholesaleAccount[]>([]);
    const [reservations, setReservations] = useState<WholesaleReservation[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'LOGISTAS' | 'RESERVAS'>('LOGISTAS');
    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<WholesaleAccount | null>(null);
    const [accountForm, setAccountForm] = useState({ name: '', username: '', password: '' });

    const loadData = async () => {
        setLoading(true);
        try {
            const [accs, ress] = await Promise.all([
                supabaseService.getWholesaleAccounts(),
                supabaseService.getWholesaleReservations()
            ]);
            setAccounts(accs);
            setReservations(ress);
        } catch (err) {
            console.error('Erro ao carregar dados de atacado:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleSaveAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingAccount) {
                await supabaseService.updateWholesaleAccount({ ...editingAccount, ...accountForm } as WholesaleAccount);
            } else {
                await supabaseService.createWholesaleAccount(accountForm);
            }
            setIsAccountModalOpen(false);
            setEditingAccount(null);
            setAccountForm({ name: '', username: '', password: '' });
            loadData();
        } catch (err) {
            alert('Erro ao salvar lojista.');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-900">🏢 Gestão de Atacado</h1>
                    <p className="text-slate-500 text-sm mt-0.5">Gerencie lojistas parceiros e reservas de estoque</p>
                </div>
                {activeTab === 'LOGISTAS' && (
                    <button
                        onClick={() => { setEditingAccount(null); setAccountForm({ name: '', username: '', password: '' }); setIsAccountModalOpen(true); }}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all"
                    >
                        <UserPlus className="w-4 h-4" />
                        Novo Lojista
                    </button>
                )}
            </div>

            <div className="flex gap-2 p-1.5 bg-slate-200/50 rounded-2xl">
                <button onClick={() => setActiveTab('LOGISTAS')} className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTab === 'LOGISTAS' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>👤 Lojistas Cadastrados</button>
                <button onClick={() => setActiveTab('RESERVAS')} className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTab === 'RESERVAS' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>📋 Reservas Ativas</button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center p-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>
            ) : activeTab === 'LOGISTAS' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {accounts.map(acc => (
                        <div key={acc.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="bg-blue-50 w-12 h-12 rounded-2xl flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                                    <Users className="w-6 h-6 text-blue-600 group-hover:text-white" />
                                </div>
                                <span className={`text-[10px] font-black px-2 py-1 rounded-full ${acc.active ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                    {acc.active ? 'ATIVO' : 'INATIVO'}
                                </span>
                            </div>
                            <h3 className="font-black text-slate-900 truncate">{acc.name}</h3>
                            <p className="text-xs text-slate-400 font-bold mt-1">@ {acc.username}</p>
                            <div className="mt-4 pt-4 border-t border-slate-50 flex gap-2">
                                <button
                                    onClick={() => { setEditingAccount(acc); setAccountForm({ name: acc.name, username: acc.username, password: '' }); setIsAccountModalOpen(true); }}
                                    className="flex-1 py-2 text-xs font-black text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                                >
                                    Editar Conta
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Lojista</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Produto</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Qtd</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor Unit.</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {reservations.map(res => (
                                <tr key={res.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4 text-xs font-bold text-slate-500">{new Date(res.createdAt!).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 text-sm font-black text-slate-900">{res.wholesalerName}</td>
                                    <td className="px-6 py-4 text-sm font-medium text-slate-600">{res.productName}</td>
                                    <td className="px-6 py-4 text-sm font-black text-blue-600 text-center">{res.quantity}</td>
                                    <td className="px-6 py-4 text-xs font-bold text-slate-600 text-right">
                                        {(res as any).wholesalePrice?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00'}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-black text-slate-900 text-right">
                                        {((res as any).wholesalePrice * res.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex justify-center">
                                            <span className={`text-[10px] font-black px-3 py-1 rounded-full ${res.status === 'EFETIVADA' ? 'bg-emerald-50 text-emerald-600' : res.status === 'CANCELADA' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                                                {res.status}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Account Modal */}
            {isAccountModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                            <h2 className="text-xl font-black text-slate-900">{editingAccount ? 'Editar Lojista' : 'Novo Lojista'}</h2>
                            <button onClick={() => setIsAccountModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
                        </div>
                        <form onSubmit={handleSaveAccount} className="p-8 space-y-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Nome da Empresa / Lojista</label>
                                <input required type="text" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-500 font-bold text-slate-900" placeholder="Ex: Móveis Norte Ltda" value={accountForm.name} onChange={e => setAccountForm({ ...accountForm, name: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Usuário de Login</label>
                                <input required type="text" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-500 font-bold text-slate-900" placeholder="usuario_atacado" value={accountForm.username} onChange={e => setAccountForm({ ...accountForm, username: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Senha {editingAccount && '(deixe em branco para manter)'}</label>
                                <input required={!editingAccount} type="text" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-500 font-bold text-slate-900" placeholder="••••••••" value={accountForm.password} onChange={e => setAccountForm({ ...accountForm, password: e.target.value })} />
                            </div>
                            {editingAccount && (
                                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl">
                                    <input type="checkbox" checked={editingAccount.active} onChange={e => setEditingAccount({ ...editingAccount, active: e.target.checked })} className="w-5 h-5 rounded-lg text-blue-600" />
                                    <span className="text-sm font-black text-slate-700 uppercase">Conta Ativa</span>
                                </div>
                            )}
                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setIsAccountModalOpen(false)} className="flex-1 py-4 text-slate-500 font-black uppercase text-xs border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all">Cancelar</button>
                                <button type="submit" className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"><Save className="w-4 h-4" /> Salvar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WholesaleManagement;
