import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase.ts';
import { CheckCircle, Clock, AlertTriangle, Package, RefreshCw, Search, ChevronDown, ChevronUp, Filter, Clipboard, XCircle } from 'lucide-react';

interface Task {
    id: string;
    title: string;
    description?: string;
    type: string;
    status: string;
    priority: string;
    created_by?: string;
    assigned_to?: string;
    store_id?: string;
    sale_id?: string;
    product_name?: string;
    created_at: string;
    resolved_at?: string;
    notes?: string;
}

interface TarefasProps {
    user: any;
    stores: any[];
}

const priorityColors: Record<string, string> = {
    ALTA: 'bg-red-100 text-red-700 border-red-200',
    MEDIA: 'bg-amber-100 text-amber-700 border-amber-200',
    BAIXA: 'bg-green-100 text-green-700 border-green-200',
};

const statusColors: Record<string, string> = {
    ABERTA: 'bg-amber-50 border-amber-300',
    EM_ANDAMENTO: 'bg-blue-50 border-blue-300',
    CONCLUIDA: 'bg-emerald-50 border-emerald-300',
};

const Tarefas: React.FC<TarefasProps> = ({ user, stores }) => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('ABERTA');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [notes, setNotes] = useState<Record<string, string>>({});
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [stats, setStats] = useState({ abertas: 0, andamento: 0, concluidas: 0 });

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const loadTasks = useCallback(async () => {
        setLoading(true);
        try {
            const query = supabase
                .from('tasks')
                .select('*')
                .order('created_at', { ascending: false });

            if (filterStatus !== 'TODOS') {
                query.eq('status', filterStatus);
            }

            const { data, error } = await query;
            if (error) throw error;
            setTasks(data || []);

            // Stats
            const { data: all } = await supabase.from('tasks').select('status');
            const s = { abertas: 0, andamento: 0, concluidas: 0 };
            (all || []).forEach((t: any) => {
                if (t.status === 'ABERTA') s.abertas++;
                else if (t.status === 'EM_ANDAMENTO') s.andamento++;
                else if (t.status === 'CONCLUIDA') s.concluidas++;
            });
            setStats(s);
        } catch (err) {
            console.error('Erro ao carregar tarefas:', err);
        } finally {
            setLoading(false);
        }
    }, [filterStatus]);

    useEffect(() => { loadTasks(); }, [loadTasks]);

    const updateTaskStatus = async (task: Task, newStatus: string) => {
        setProcessingId(task.id);
        try {
            const updates: any = { status: newStatus };
            if (newStatus === 'CONCLUIDA') {
                updates.resolved_at = new Date().toISOString();
                if (notes[task.id]) updates.notes = notes[task.id];
            }

            const { error } = await supabase.from('tasks').update(updates).eq('id', task.id);
            if (error) throw error;

            if (filterStatus !== 'TODOS' && filterStatus !== newStatus) {
                setTasks(prev => prev.filter(t => t.id !== task.id));
            } else {
                setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...updates } : t));
            }

            const messages: Record<string, string> = {
                CONCLUIDA: '✅ Tarefa marcada como concluída!',
                EM_ANDAMENTO: '🔄 Tarefa em andamento!',
                ABERTA: '🔓 Tarefa reaberta!',
            };
            showToast(messages[newStatus] || 'Status atualizado!');
        } catch (err) {
            showToast('Erro ao atualizar tarefa.', 'error');
        } finally {
            setProcessingId(null);
        }
    };

    const filteredTasks = tasks.filter(t => {
        if (!search) return true;
        const s = search.toLowerCase();
        return t.title.toLowerCase().includes(s) ||
            t.product_name?.toLowerCase().includes(s) ||
            t.created_by?.toLowerCase().includes(s) ||
            t.description?.toLowerCase().includes(s);
    });

    const getStoreName = (storeId?: string) => {
        if (!storeId) return 'N/D';
        return stores.find(s => s.id === storeId)?.name || storeId;
    };

    return (
        <div className="space-y-6 relative">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-6 right-6 z-50 px-6 py-3 rounded-2xl text-white font-bold shadow-2xl text-sm transition-all ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-900">📋 Tarefas</h1>
                    <p className="text-slate-500 text-sm mt-0.5">Pendências e tarefas do supervisor</p>
                </div>
                <button onClick={loadTasks} disabled={loading} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all disabled:opacity-50">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Atualizar
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <button onClick={() => setFilterStatus('ABERTA')} className={`p-4 text-center rounded-2xl border-2 transition-all ${filterStatus === 'ABERTA' ? 'border-amber-400 bg-amber-50' : 'border-transparent bg-amber-50 hover:border-amber-200'}`}>
                    <p className="text-2xl font-black text-amber-700">{stats.abertas}</p>
                    <p className="text-xs font-bold text-amber-600 uppercase tracking-wide mt-1">Abertas</p>
                </button>
                <button onClick={() => setFilterStatus('EM_ANDAMENTO')} className={`p-4 text-center rounded-2xl border-2 transition-all ${filterStatus === 'EM_ANDAMENTO' ? 'border-blue-400 bg-blue-50' : 'border-transparent bg-blue-50 hover:border-blue-200'}`}>
                    <p className="text-2xl font-black text-blue-700">{stats.andamento}</p>
                    <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mt-1">Em Andamento</p>
                </button>
                <button onClick={() => setFilterStatus('CONCLUIDA')} className={`p-4 text-center rounded-2xl border-2 transition-all ${filterStatus === 'CONCLUIDA' ? 'border-emerald-400 bg-emerald-50' : 'border-transparent bg-emerald-50 hover:border-emerald-200'}`}>
                    <p className="text-2xl font-black text-emerald-700">{stats.concluidas}</p>
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide mt-1">Concluídas</p>
                </button>
            </div>

            {/* Filtros */}
            <div className="flex gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar tarefa..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <button
                    onClick={() => setFilterStatus('TODOS')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold border ${filterStatus === 'TODOS' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}
                >
                    Todos
                </button>
            </div>

            {/* Lista */}
            {loading ? (
                <div className="flex items-center justify-center p-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
                </div>
            ) : filteredTasks.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl border border-slate-100">
                    <Clipboard className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-xl font-black text-slate-900">Sem tarefas</h3>
                    <p className="text-slate-500 mt-2">Nenhuma tarefa encontrada com os filtros atuais.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredTasks.map(task => {
                        const isExpanded = expandedId === task.id;
                        const isProcessing = processingId === task.id;
                        const isConcluida = task.status === 'CONCLUIDA';

                        return (
                            <div key={task.id} className={`bg-white rounded-2xl border-2 overflow-hidden shadow-sm transition-all ${statusColors[task.status] || 'border-slate-200'}`}>
                                <button
                                    onClick={() => setExpandedId(isExpanded ? null : task.id)}
                                    className="w-full flex items-start gap-4 p-4 text-left hover:bg-white/70 transition-colors"
                                >
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${task.status === 'CONCLUIDA' ? 'bg-emerald-100' : task.status === 'EM_ANDAMENTO' ? 'bg-blue-100' : 'bg-amber-100'}`}>
                                        {task.status === 'CONCLUIDA' ? <CheckCircle className="w-5 h-5 text-emerald-600" /> :
                                            task.status === 'EM_ANDAMENTO' ? <RefreshCw className="w-5 h-5 text-blue-600" /> :
                                                <AlertTriangle className="w-5 h-5 text-amber-600" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className={`font-black text-sm ${isConcluida ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{task.title}</p>
                                            <span className={`text-[10px] font-black border px-2 py-0.5 rounded-full uppercase ${priorityColors[task.priority] || ''}`}>{task.priority}</span>
                                        </div>
                                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                                            <span className="text-xs text-slate-500">{getStoreName(task.store_id)}</span>
                                            <span className="text-xs text-slate-400">·</span>
                                            <span className="text-xs text-slate-500">Por: {task.created_by || 'N/D'}</span>
                                            <span className="text-xs text-slate-400">·</span>
                                            <div className="flex items-center gap-1 text-xs text-slate-400">
                                                <Clock className="w-3 h-3" />
                                                {new Date(task.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </div>
                                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0 mt-1" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 mt-1" />}
                                </button>

                                {isExpanded && (
                                    <div className="border-t border-slate-100 p-4 space-y-4 bg-white">
                                        {task.description && (
                                            <div className="bg-slate-50 rounded-xl p-3">
                                                <p className="text-xs font-black text-slate-500 uppercase mb-1">Descrição</p>
                                                <p className="text-sm text-slate-700 whitespace-pre-line">{task.description}</p>
                                            </div>
                                        )}

                                        {task.product_name && (
                                            <div className="flex items-center gap-2 bg-blue-50 rounded-xl p-3">
                                                <Package className="w-4 h-4 text-blue-500 shrink-0" />
                                                <div>
                                                    <p className="text-xs font-black text-blue-600 uppercase">Produto</p>
                                                    <p className="text-sm font-bold text-slate-800">{task.product_name}</p>
                                                </div>
                                            </div>
                                        )}

                                        {task.notes && (
                                            <div className="bg-emerald-50 rounded-xl p-3">
                                                <p className="text-xs font-black text-emerald-600 uppercase mb-1">Observações</p>
                                                <p className="text-sm text-slate-700">{task.notes}</p>
                                            </div>
                                        )}

                                        {!isConcluida && (
                                            <div>
                                                <textarea
                                                    placeholder="Adicionar observação antes de concluir..."
                                                    value={notes[task.id] || ''}
                                                    onChange={e => setNotes(prev => ({ ...prev, [task.id]: e.target.value }))}
                                                    className="w-full p-3 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    rows={2}
                                                />
                                            </div>
                                        )}

                                        <div className="flex gap-2 flex-wrap">
                                            {task.status === 'ABERTA' && (
                                                <button
                                                    onClick={() => updateTaskStatus(task, 'EM_ANDAMENTO')}
                                                    disabled={isProcessing}
                                                    className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-black transition-all disabled:opacity-50"
                                                >
                                                    <RefreshCw className="w-3.5 h-3.5" /> Em Andamento
                                                </button>
                                            )}
                                            {!isConcluida && (
                                                <button
                                                    onClick={() => updateTaskStatus(task, 'CONCLUIDA')}
                                                    disabled={isProcessing}
                                                    className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-black transition-all disabled:opacity-50 shadow-md shadow-emerald-500/20"
                                                >
                                                    {isProcessing ? <div className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                                                    Concluir Tarefa
                                                </button>
                                            )}
                                            {isConcluida && (
                                                <button
                                                    onClick={() => updateTaskStatus(task, 'ABERTA')}
                                                    disabled={isProcessing}
                                                    className="flex items-center gap-1.5 bg-slate-400 hover:bg-slate-500 text-white px-4 py-2 rounded-xl text-xs font-black transition-all"
                                                >
                                                    <XCircle className="w-3.5 h-3.5" /> Reabrir
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default Tarefas;
