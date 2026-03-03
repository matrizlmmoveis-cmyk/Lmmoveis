import React, { useState, useEffect, useCallback } from 'react';
import { Employee, Store, OrderStatus, Sale, Product } from '../types.ts';
import { supabase } from '../services/supabase.ts';
import { supabaseService } from '../services/supabaseService.ts';
import {
    CheckCircle, Clock, AlertTriangle, Package, RefreshCw, Search,
    ChevronDown, ChevronUp, Clipboard, XCircle, Plus, Send, MessageSquare,
    Bell, User, X
} from 'lucide-react';

interface Task {
    id: string;
    title: string;
    description?: string;
    type: string;
    status: string;
    priority: string;
    created_by?: string;
    assigned_to?: string;
    assigned_to_user_id?: string;
    store_id?: string;
    source_store_id?: string;
    sale_id?: string;
    product_name?: string;
    created_at: string;
    resolved_at?: string;
    notes?: string;
    response?: string;
    responded_by?: string;
    responded_at?: string;
    proposal_snapshot?: any;
}

interface TarefasProps {
    user: Employee | { id: string, name: string, role: string, storeId?: string, username?: string } | null;
    stores: Store[];
    products: Product[];
    sales?: Sale[];
    setSales?: React.Dispatch<React.SetStateAction<Sale[]>>;
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

const Tarefas: React.FC<TarefasProps> = ({ user, stores, products, sales, setSales }) => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('ABERTA');
    const [filterType, setFilterType] = useState('TODOS'); // TODOS | TAREFA | AVISO
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [notes, setNotes] = useState<Record<string, string>>({});
    const [responses, setResponses] = useState<Record<string, string>>({});
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [stats, setStats] = useState({ abertas: 0, andamento: 0, concluidas: 0 });
    const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
    const [newTaskForm, setNewTaskForm] = useState({
        title: '',
        description: '',
        priority: 'MEDIA',
        assigned_to_user_id: '',
        store_id: user?.storeId || '',
    });
    const [savingTask, setSavingTask] = useState(false);
    const [stockReturnModal, setStockReturnModal] = useState<{ task: Task; selectedLocationId: string } | null>(null);
    const [returningStock, setReturningStock] = useState(false);
    const [editApprovalModal, setEditApprovalModal] = useState<{ task: Task; processing: boolean } | null>(null);

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const loadEmployees = useCallback(async () => {
        try {
            const data = await supabaseService.getEmployees();
            setEmployees(data);
        } catch (err) {
            console.error('Erro ao carregar funcionários:', err);
        }
    }, []);

    const loadTasks = useCallback(async () => {
        setLoading(true);
        try {
            let query = supabase.from('tasks').select('*').order('created_at', { ascending: false });

            if (filterStatus !== 'TODOS') {
                query = query.eq('status', filterStatus);
            }

            // Gerentes veem apenas as tarefas da sua loja
            if (user?.role === 'GERENTE' && user?.storeId) {
                query = query.eq('store_id', user.storeId);
            }

            // Filtro de tipo
            if (filterType === 'AVISO') {
                query = query.eq('type', 'AVISO_SAIDA_ESTOQUE');
            } else if (filterType === 'TAREFA') {
                query = query.neq('type', 'AVISO_SAIDA_ESTOQUE');
            }

            const { data, error } = await query;
            if (error) throw error;

            // Para usuários comuns (não ADMIN/SUPERVISOR/MASTER), filtrar apenas tarefas que lhe foram atribuídas ou por eles criadas
            let filteredData = data || [];
            if (user?.role === 'GERENTE') {
                // Gerente vê: avisos da sua loja + tarefas atribuídas a ele + tarefas que ele criou
                filteredData = filteredData.filter((t: Task) => {
                    const isStoreAlert = t.type === 'AVISO_SAIDA_ESTOQUE' && t.store_id === user.storeId;
                    const isAssignedToMe = t.assigned_to_user_id === user.id;
                    const isCreatedByMe = t.created_by === user.name;
                    return isStoreAlert || isAssignedToMe || isCreatedByMe;
                });
            }

            if (user?.role === 'VENDEDOR') {
                // Vendedor vê: tarefas manuais da sua loja ou atribuídas diretamente a ele
                filteredData = filteredData.filter((t: Task) => {
                    const isAssignedToMe = t.assigned_to_user_id === user.id;
                    const isManualTaskForMyStore = t.type === 'TAREFA_MANUAL' && t.store_id === user.storeId;
                    return isAssignedToMe || isManualTaskForMyStore;
                });
            }

            setTasks(filteredData);

            // Stats totais (para a loja do gerente, se for gerente)
            let statsQuery = supabase.from('tasks').select('status');
            if (user?.role === 'GERENTE' && user?.storeId) {
                statsQuery = statsQuery.eq('store_id', user.storeId);
            }
            const { data: all } = await statsQuery;
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
    }, [filterStatus, filterType, user]);

    useEffect(() => { loadTasks(); loadEmployees(); }, [loadTasks, loadEmployees]);

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

    const handleRespond = async (task: Task) => {
        const responseText = responses[task.id];
        if (!responseText?.trim()) return;
        setProcessingId(task.id);
        try {
            await supabaseService.respondTask(task.id, responseText, user?.name || 'Usuário');
            setTasks(prev => prev.map(t => t.id === task.id ? {
                ...t,
                response: responseText,
                responded_by: user?.name,
                responded_at: new Date().toISOString()
            } : t));
            setResponses(prev => { const n = { ...prev }; delete n[task.id]; return n; });
            showToast('✉️ Resposta enviada!');
        } catch (err) {
            showToast('Erro ao enviar resposta.', 'error');
        } finally {
            setProcessingId(null);
        }
    };

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskForm.title.trim() || !newTaskForm.assigned_to_user_id) return;
        setSavingTask(true);
        try {
            const assignedUser = employees.find(e => e.id === newTaskForm.assigned_to_user_id);
            await supabaseService.createTask({
                title: newTaskForm.title,
                description: newTaskForm.description || undefined,
                type: 'TAREFA_MANUAL',
                priority: newTaskForm.priority,
                status: 'ABERTA',
                created_by: user?.name || 'Sistema',
                assigned_to: assignedUser?.role || 'FUNCIONARIO',
                assigned_to_user_id: newTaskForm.assigned_to_user_id,
                store_id: newTaskForm.store_id || undefined,
            });
            showToast('✅ Tarefa criada com sucesso!');
            setIsNewTaskModalOpen(false);
            setNewTaskForm({ title: '', description: '', priority: 'MEDIA', assigned_to_user_id: '', store_id: user?.storeId || '' });
            loadTasks();
        } catch (err) {
            showToast('Erro ao criar tarefa.', 'error');
        } finally {
            setSavingTask(false);
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

    const getAssigneeName = (userId?: string) => {
        if (!userId) return null;
        return employees.find(e => e.id === userId)?.name;
    };

    const canCreateTask = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR' || user?.role === 'GERENTE' || user?.username === 'Master';
    const canManageTask = (task: Task) => {
        if (['ADMIN', 'SUPERVISOR', 'MASTER'].includes(user?.role) || user?.username === 'Master') return true;
        return task.assigned_to_user_id === user?.id;
    };
    const isTaskCreator = (task: Task) => task.created_by === user?.name;
    const isTaskRecipient = (task: Task) => task.assigned_to_user_id === user?.id;

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
                    <h1 className="text-2xl font-black text-slate-900">📋 Tarefas/Avisos</h1>
                    <p className="text-slate-500 text-sm mt-0.5">Pendências, comunicados e avisos da equipe</p>
                </div>
                <div className="flex gap-2">
                    {canCreateTask && (
                        <button
                            onClick={() => setIsNewTaskModalOpen(true)}
                            className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-800 transition-all"
                        >
                            <Plus className="w-4 h-4" />
                            Nova Tarefa
                        </button>
                    )}
                    <button onClick={loadTasks} disabled={loading} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all disabled:opacity-50">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Atualizar
                    </button>
                </div>
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
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar tarefa ou aviso..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div className="flex gap-2 flex-wrap">
                    <button onClick={() => setFilterStatus('TODOS')} className={`px-4 py-2 rounded-xl text-sm font-bold border ${filterStatus === 'TODOS' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>
                        Todos
                    </button>
                    <button onClick={() => setFilterType('TODOS')} className={`px-3 py-2 rounded-xl text-xs font-bold border ${filterType === 'TODOS' ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                        Todos Tipos
                    </button>
                    <button onClick={() => setFilterType('TAREFA')} className={`px-3 py-2 rounded-xl text-xs font-bold border ${filterType === 'TAREFA' ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                        Tarefas
                    </button>
                    <button onClick={() => setFilterType('AVISO')} className={`px-3 py-2 rounded-xl text-xs font-bold border ${filterType === 'AVISO' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                        Avisos
                    </button>
                </div>
            </div>

            {/* Lista */}
            {loading ? (
                <div className="flex items-center justify-center p-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
                </div>
            ) : filteredTasks.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl border border-slate-100">
                    <Clipboard className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-xl font-black text-slate-900">Sem resultados</h3>
                    <p className="text-slate-500 mt-2">Nenhuma tarefa ou aviso encontrado com os filtros atuais.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredTasks.map(task => {
                        const isExpanded = expandedId === task.id;
                        const isProcessing = processingId === task.id;
                        const isConcluida = task.status === 'CONCLUIDA';
                        const isAviso = task.type === 'AVISO_SAIDA_ESTOQUE';
                        const assigneeName = getAssigneeName(task.assigned_to_user_id);

                        return (
                            <div key={task.id} className={`bg-white rounded-2xl border-2 overflow-hidden shadow-sm transition-all ${statusColors[task.status] || 'border-slate-200'}`}>
                                <button
                                    onClick={() => setExpandedId(isExpanded ? null : task.id)}
                                    className="w-full flex items-start gap-4 p-4 text-left hover:bg-white/70 transition-colors"
                                >
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isAviso ? 'bg-red-100' : task.status === 'CONCLUIDA' ? 'bg-emerald-100' : task.status === 'EM_ANDAMENTO' ? 'bg-blue-100' : 'bg-amber-100'}`}>
                                        {isAviso ? <Bell className="w-5 h-5 text-red-500" /> :
                                            task.status === 'CONCLUIDA' ? <CheckCircle className="w-5 h-5 text-emerald-600" /> :
                                                task.status === 'EM_ANDAMENTO' ? <RefreshCw className="w-5 h-5 text-blue-600" /> :
                                                    <AlertTriangle className="w-5 h-5 text-amber-600" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className={`font-black text-sm ${isConcluida ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{task.title}</p>
                                            <span className={`text-[10px] font-black border px-2 py-0.5 rounded-full uppercase ${priorityColors[task.priority] || ''}`}>{task.priority}</span>
                                            {isAviso && <span className="text-[10px] font-black bg-red-100 text-red-700 border-red-200 border px-2 py-0.5 rounded-full uppercase">AVISO</span>}
                                            {!isAviso && <span className="text-[10px] font-black bg-orange-100 text-orange-700 border-orange-200 border px-2 py-0.5 rounded-full uppercase">TAREFA</span>}
                                            {task.response && <span className="text-[10px] font-black bg-blue-100 text-blue-700 border-blue-200 border px-2 py-0.5 rounded-full uppercase flex items-center gap-1"><MessageSquare className="w-2.5 h-2.5" />Respondida</span>}
                                        </div>
                                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                                            <span className="text-xs text-slate-500">{getStoreName(task.store_id)}</span>
                                            <span className="text-xs text-slate-400">·</span>
                                            <span className="text-xs text-slate-500">Por: {task.created_by || 'N/D'}</span>
                                            {assigneeName && <><span className="text-xs text-slate-400">·</span><span className="text-xs text-blue-600 font-bold flex items-center gap-0.5"><User className="w-3 h-3" />{assigneeName}</span></>}
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

                                        {isConcluida && task.resolved_at && (
                                            <div className="bg-emerald-50 rounded-xl p-3 flex items-center gap-2">
                                                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                                                <div>
                                                    <p className="text-xs font-black text-emerald-600 uppercase">Concluída em</p>
                                                    <p className="text-sm text-slate-700">{new Date(task.resolved_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Resposta do destinatário */}
                                        {task.response && (
                                            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                                                <p className="text-xs font-black text-indigo-600 uppercase mb-1 flex items-center gap-1">
                                                    <MessageSquare className="w-3 h-3" />
                                                    Resposta de {task.responded_by}
                                                    {task.responded_at && <span className="text-indigo-400 font-normal lowercase normal-case ml-1">· {new Date(task.responded_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>}
                                                </p>
                                                <p className="text-sm text-slate-700 whitespace-pre-line">{task.response}</p>
                                            </div>
                                        )}

                                        {/* Campo de resposta para o destinatário */}
                                        {!isConcluida && isTaskRecipient(task) && !task.response && (
                                            <div className="space-y-2">
                                                <p className="text-xs font-black text-slate-500 uppercase">Responder ao criador</p>
                                                <textarea
                                                    placeholder="Digite sua resposta..."
                                                    value={responses[task.id] || ''}
                                                    onChange={e => setResponses(prev => ({ ...prev, [task.id]: e.target.value }))}
                                                    className="w-full p-3 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    rows={2}
                                                />
                                                <button
                                                    onClick={() => handleRespond(task)}
                                                    disabled={isProcessing || !responses[task.id]?.trim()}
                                                    className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-black transition-all disabled:opacity-50"
                                                >
                                                    <Send className="w-3.5 h-3.5" /> Enviar Resposta
                                                </button>
                                            </div>
                                        )}

                                        {/* Observação antes de concluir */}
                                        {!isConcluida && canManageTask(task) && (
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

                                        {/* Botões de ação */}
                                        <div className="flex gap-2 flex-wrap">
                                            {canManageTask(task) && task.status === 'ABERTA' && (
                                                <button onClick={() => updateTaskStatus(task, 'EM_ANDAMENTO')} disabled={isProcessing} className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-black transition-all disabled:opacity-50">
                                                    <RefreshCw className="w-3.5 h-3.5" /> Em Andamento
                                                </button>
                                            )}
                                            {/* Botão especial para EDICAO_PENDENTE */}
                                            {canManageTask(task) && !isConcluida && task.type === 'EDICAO_PENDENTE' && (
                                                <button
                                                    onClick={() => setEditApprovalModal({ task, processing: false })}
                                                    disabled={isProcessing}
                                                    className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-xs font-black transition-all disabled:opacity-50 shadow-md shadow-amber-500/20"
                                                >
                                                    ✏️ Ver Proposta de Edição
                                                </button>
                                            )}
                                            {canManageTask(task) && !isConcluida && task.type === 'CANCELAMENTO_PENDENTE' && task.sale_id && (
                                                <button
                                                    onClick={() => setStockReturnModal({ task, selectedLocationId: stores[0]?.id || '' })}
                                                    disabled={isProcessing}
                                                    className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-xs font-black transition-all disabled:opacity-50 shadow-md shadow-red-500/20"
                                                >
                                                    <Package className="w-3.5 h-3.5" /> Autorizar e Devolver Saldo
                                                </button>
                                            )}
                                            {canManageTask(task) && !isConcluida && task.type !== 'CANCELAMENTO_PENDENTE' && (
                                                <button onClick={() => updateTaskStatus(task, 'CONCLUIDA')} disabled={isProcessing} className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-black transition-all disabled:opacity-50 shadow-md shadow-emerald-500/20">
                                                    {isProcessing ? <div className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                                                    Concluir
                                                </button>
                                            )}
                                            {isConcluida && (canManageTask(task) || isTaskCreator(task)) && (
                                                <button onClick={() => updateTaskStatus(task, 'ABERTA')} disabled={isProcessing} className="flex items-center gap-1.5 bg-slate-400 hover:bg-slate-500 text-white px-4 py-2 rounded-xl text-xs font-black transition-all">
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

            {/* Modal de Aprovação de Edição de Venda (EDICAO_PENDENTE) */}
            {editApprovalModal && (() => {
                const { task, processing } = editApprovalModal;
                const snap = task.proposal_snapshot as any;
                const orig = snap?.original || {};
                const prop = snap?.proposed || {};
                const origItems: any[] = orig.items || [];
                const propItems: any[] = prop.items || [];

                const renderItems = (items: any[], highlight?: 'add' | 'remove') => items.map((item: any, idx: number) => {
                    const prod = products.find(p => p.id === item.productId);
                    return (
                        <div key={idx} className={`flex justify-between items-center py-1.5 px-2 rounded-lg text-xs ${highlight === 'add' ? 'bg-emerald-50' : highlight === 'remove' ? 'bg-red-50' : 'bg-slate-50'}`}>
                            <span className="font-bold text-slate-700 truncate flex-1">{prod?.name || item.productId}</span>
                            <span className="text-slate-500 ml-2">Qtd: {item.quantity}</span>
                            <span className="text-slate-500 ml-2">R$ {(item.price || 0).toFixed(2)}</span>
                        </div>
                    );
                });

                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4 bg-slate-900/80 backdrop-blur-sm">
                        <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
                            <div className="px-6 py-4 bg-amber-50 border-b border-amber-100 flex justify-between items-center shrink-0">
                                <div>
                                    <h2 className="text-base font-black text-amber-800 uppercase">✏️ Aprovação de Edição — Venda Nº {task.sale_id}</h2>
                                    <p className="text-[10px] text-amber-600">{task.description}</p>
                                </div>
                                <button onClick={() => setEditApprovalModal(null)} className="p-2 hover:bg-amber-100 rounded-full"><X className="w-4 h-4 text-amber-500" /></button>
                            </div>

                            <div className="overflow-y-auto flex-1 p-5">
                                <div className="grid grid-cols-2 gap-4">
                                    {/* Original */}
                                    <div>
                                        <p className="text-xs font-black text-slate-500 uppercase mb-2">Venda Original</p>
                                        <div className="space-y-1">{renderItems(origItems)}</div>
                                        <div className="mt-3 pt-3 border-t border-slate-100">
                                            <p className="text-xs text-slate-500">Total: <span className="font-black text-slate-800">R$ {(orig.total || 0).toFixed(2)}</span></p>
                                            <div className="space-y-1 mt-1">
                                                {(orig.payments || []).map((p: any, i: number) => (
                                                    <p key={i} className="text-xs text-slate-500">{p.method}: R$ {(p.amount || 0).toFixed(2)}</p>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    {/* Proposto */}
                                    <div>
                                        <p className="text-xs font-black text-amber-600 uppercase mb-2">Proposta do Gerente</p>
                                        <div className="space-y-1">
                                            {propItems.map((item: any, idx: number) => {
                                                const isNew = !origItems.some((o: any) => o.productId === item.productId);
                                                const origItem = origItems.find((o: any) => o.productId === item.productId);
                                                const changed = origItem && (origItem.quantity !== item.quantity || origItem.price !== item.price);
                                                const prod = products.find(p => p.id === item.productId);
                                                return <div key={idx} className={`flex justify-between items-center py-1.5 px-2 rounded-lg text-xs ${isNew ? 'bg-emerald-50 border border-emerald-200' : changed ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'}`}>
                                                    <span className="font-bold text-slate-700 truncate flex-1">{prod?.name || item.productId}</span>
                                                    {isNew && <span className="text-[9px] text-emerald-700 font-black mr-1">NOVO</span>}
                                                    {changed && !isNew && <span className="text-[9px] text-amber-700 font-black mr-1">ALTERADO</span>}
                                                    <span className="text-slate-500">Qtd: {item.quantity}</span>
                                                    <span className="text-slate-500 ml-2">R$ {(item.price || 0).toFixed(2)}</span>
                                                </div>;
                                            })}
                                            {origItems.filter((o: any) => !propItems.some((p: any) => p.productId === o.productId)).map((item: any, idx: number) => {
                                                const prod = products.find(p => p.id === item.productId);
                                                return (
                                                    <div key={`removed-${idx}`} className="flex justify-between items-center py-1.5 px-2 rounded-lg text-xs bg-red-50 border border-red-200">
                                                        <span className="font-bold text-red-500 line-through truncate flex-1">{prod?.name || item.productId}</span>
                                                        <span className="text-[9px] text-red-600 font-black">REMOVIDO</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="mt-3 pt-3 border-t border-slate-100">
                                            <p className="text-xs text-slate-500">Total: <span className="font-black text-amber-700">R$ {(prop.total || 0).toFixed(2)}</span></p>
                                            <div className="space-y-1 mt-1">
                                                {(prop.payments || []).map((p: any, i: number) => (
                                                    <p key={i} className="text-xs text-slate-500">{p.method}: R$ {(p.amount || 0).toFixed(2)}</p>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="px-5 py-4 border-t border-slate-100 flex gap-3 shrink-0">
                                <button onClick={() => setEditApprovalModal(null)} className="flex-1 py-3 text-slate-500 font-bold uppercase text-xs border border-slate-200 rounded-2xl hover:bg-slate-50">Fechar</button>
                                <button
                                    disabled={processing}
                                    onClick={async () => {
                                        if (!window.confirm('Rejeitar esta proposta de edição? A venda volta ao estado original.')) return;
                                        setEditApprovalModal(m => m ? { ...m, processing: true } : null);
                                        try {
                                            await supabaseService.rejectSaleEdit({ saleId: task.sale_id!, taskId: task.id, rejectedBy: user?.name || user?.username });
                                            setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'CONCLUIDA' } : t));

                                            // Sincronizar estado global de vendas (voltar status original)
                                            if (setSales && task.sale_id) {
                                                setSales(prev => prev.map(s => s.id === task.sale_id ? { ...s, status: OrderStatus.PENDING } : s));
                                            }

                                            setEditApprovalModal(null);
                                            showToast('❌ Edição rejeitada.');
                                        } catch { showToast('Erro ao rejeitar.', 'error'); setEditApprovalModal(m => m ? { ...m, processing: false } : null); }
                                    }}
                                    className="flex-1 py-3 bg-slate-700 text-white rounded-2xl font-black uppercase text-xs hover:bg-slate-800 disabled:opacity-50"
                                >
                                    {processing ? 'Processando...' : '❌ Rejeitar'}
                                </button>
                                <button
                                    disabled={processing}
                                    onClick={async () => {
                                        if (!window.confirm('Autorizar esta edição? As alterações serão aplicadas na venda imediatamente.')) return;
                                        setEditApprovalModal(m => m ? { ...m, processing: true } : null);
                                        try {
                                            await supabaseService.applySaleEdit({
                                                saleId: task.sale_id!,
                                                taskId: task.id,
                                                authorizedBy: user?.name || user?.username,
                                                originalSnapshot: snap?.original,
                                                proposedSnapshot: snap?.proposed,
                                                stores,
                                            });
                                            setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'CONCLUIDA' } : t));

                                            // Sincronizar estado global de vendas com novos dados
                                            if (setSales && task.sale_id && snap?.proposed) {
                                                const prop = snap.proposed;
                                                const prevStatus = snap.original?.prevStatus || OrderStatus.PENDING;
                                                setSales(prev => prev.map(s => s.id === task.sale_id ? {
                                                    ...s,
                                                    items: prop.items,
                                                    payments: prop.payments,
                                                    total: prop.total,
                                                    status: prevStatus
                                                } : s));
                                            }

                                            setEditApprovalModal(null);
                                            showToast('✅ Edição autorizada e aplicada!');
                                        } catch { showToast('Erro ao autorizar.', 'error'); setEditApprovalModal(m => m ? { ...m, processing: false } : null); }
                                    }}
                                    className="flex-1 py-3 bg-emerald-600 text-white rounded-2xl font-black uppercase text-xs shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 disabled:opacity-50"
                                >
                                    {processing ? 'Aplicando...' : '✅ Autorizar Edição'}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Modal de Devolução de Saldo (CANCELAMENTO_PENDENTE) */}
            {stockReturnModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 bg-red-50 border-b border-red-100 flex justify-between items-center">
                            <div>
                                <h2 className="text-base font-black text-red-800 uppercase">Autorizar Cancelamento</h2>
                                <p className="text-[10px] text-red-500 font-medium">Venda Nº {stockReturnModal.task.sale_id} · Escolha o CD para devolver o saldo dos itens</p>
                            </div>
                            <button onClick={() => setStockReturnModal(null)} className="p-2 hover:bg-red-100 rounded-full">
                                <X className="w-4 h-4 text-red-400" />
                            </button>
                        </div>
                        <div className="p-6 space-y-5">
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                                <p className="text-xs font-black text-amber-700 uppercase mb-1">Atenção</p>
                                <p className="text-xs text-amber-700">Ao confirmar, a venda será <strong>cancelada</strong> e cada item da venda terá o saldo <strong>devolvido ao CD selecionado</strong>.</p>
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase mb-2">Devolver saldo para o CD / Loja</label>
                                <select
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-sm text-slate-700"
                                    value={stockReturnModal.selectedLocationId}
                                    onChange={e => setStockReturnModal({ ...stockReturnModal, selectedLocationId: e.target.value })}
                                >
                                    <option value="">Selecione o CD destino</option>
                                    {stores.map(s => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.type})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setStockReturnModal(null)}
                                    className="flex-1 py-3 text-slate-500 font-bold uppercase text-xs border border-slate-200 rounded-2xl hover:bg-slate-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    disabled={!stockReturnModal.selectedLocationId || returningStock}
                                    onClick={async () => {
                                        if (!stockReturnModal.selectedLocationId) return;
                                        setReturningStock(true);
                                        try {
                                            await supabaseService.restoreInventoryToLocation(stockReturnModal.task.sale_id!, stockReturnModal.selectedLocationId);
                                            await supabase.from('tasks').update({ status: 'CONCLUIDA', resolved_at: new Date().toISOString(), notes: `Saldo devolvido ao CD: ${stores.find(s => s.id === stockReturnModal.selectedLocationId)?.name}` }).eq('id', stockReturnModal.task.id);
                                            setTasks(prev => prev.map(t => t.id === stockReturnModal.task.id ? { ...t, status: 'CONCLUIDA', resolved_at: new Date().toISOString() } : t));

                                            // Sincronizar estado global de vendas para Cancelada
                                            if (setSales && stockReturnModal.task.sale_id) {
                                                setSales(prev => prev.map(s => s.id === stockReturnModal.task.sale_id ? { ...s, status: OrderStatus.CANCELED } : s));
                                            }

                                            setStockReturnModal(null);
                                            showToast('✅ Cancelamento autorizado e saldo devolvido!');
                                            loadTasks();
                                        } catch (err) {
                                            showToast('Erro ao devolver saldo.', 'error');
                                        } finally {
                                            setReturningStock(false);
                                        }
                                    }}
                                    className="flex-1 py-3 bg-red-600 text-white rounded-2xl font-black uppercase text-xs shadow-lg shadow-red-100 hover:bg-red-700 disabled:opacity-50"
                                >
                                    {returningStock ? 'Processando...' : 'Confirmar Cancelamento'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Nova Tarefa */}
            {isNewTaskModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                            <h2 className="text-lg font-black text-slate-900 uppercase">Nova Tarefa / Aviso</h2>
                            <button onClick={() => setIsNewTaskModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateTask} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase mb-1">Título *</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 transition-all outline-none font-bold"
                                    placeholder="Ex: Verificar estoque da loja Norte"
                                    value={newTaskForm.title}
                                    onChange={e => setNewTaskForm({ ...newTaskForm, title: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase mb-1">Descrição</label>
                                <textarea
                                    rows={3}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 transition-all outline-none resize-none text-sm"
                                    placeholder="Detalhes da tarefa..."
                                    value={newTaskForm.description}
                                    onChange={e => setNewTaskForm({ ...newTaskForm, description: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase mb-1">Prioridade</label>
                                    <select
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 transition-all outline-none font-bold text-sm"
                                        value={newTaskForm.priority}
                                        onChange={e => setNewTaskForm({ ...newTaskForm, priority: e.target.value })}
                                    >
                                        <option value="BAIXA">Baixa</option>
                                        <option value="MEDIA">Média</option>
                                        <option value="ALTA">Alta</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase mb-1">Loja</label>
                                    <select
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 transition-all outline-none text-sm"
                                        value={newTaskForm.store_id}
                                        onChange={e => setNewTaskForm({ ...newTaskForm, store_id: e.target.value })}
                                    >
                                        <option value="">Todas</option>
                                        {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase mb-1">Destinatário *</label>
                                <select
                                    required
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 transition-all outline-none font-bold text-sm"
                                    value={newTaskForm.assigned_to_user_id}
                                    onChange={e => setNewTaskForm({ ...newTaskForm, assigned_to_user_id: e.target.value })}
                                >
                                    <option value="">Selecione um usuário...</option>
                                    {employees.filter(emp => emp.id !== user?.id && emp.active).map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={savingTask || !newTaskForm.title.trim() || !newTaskForm.assigned_to_user_id}
                                    className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl font-black shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {savingTask ? <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" /> : <Send className="w-5 h-5" />}
                                    Criar Tarefa
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Tarefas;
