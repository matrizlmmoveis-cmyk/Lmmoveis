
import React, { useState } from 'react';
import { Employee, UserRole, Store } from '../types.ts';
import { Plus, X, Shield, User, Key, Save, CheckCircle, Trash2, Store as StoreIcon } from 'lucide-react';
import { supabaseService } from '../services/supabaseService.ts';

interface EmployeesProps {
  employees: Employee[];
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
  stores: Store[];
}

const EmployeesView: React.FC<EmployeesProps> = ({ employees, setEmployees, stores }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  const [formData, setFormData] = useState<Partial<Employee>>({
    name: '',
    role: 'VENDEDOR',
    username: '',
    password: '',
    active: true,
    storeId: ''
  });

  const handleOpenModal = (emp?: Employee) => {
    if (emp) {
      setEditingEmployee(emp);
      setFormData(emp);
    } else {
      setEditingEmployee(null);
      setFormData({ name: '', role: 'VENDEDOR', username: '', password: '', active: true, storeId: '' });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingEmployee) {
        const updated = { ...editingEmployee, ...formData } as Employee;
        await supabaseService.updateEmployee(editingEmployee.id, updated);
        setEmployees(employees.map(e => e.id === editingEmployee.id ? updated : e));
      } else {
        const newEmp: Employee = {
          id: `E${Date.now()}`,
          name: formData.name || '',
          role: formData.role || 'VENDEDOR',
          username: formData.username || '',
          password: formData.password || '',
          active: true,
          storeId: formData.storeId || undefined
        };
        await supabaseService.createEmployee(newEmp);
        setEmployees([...employees, newEmp]);
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error("Erro ao salvar funcionário:", err);
      alert("Erro ao salvar no banco de dados.");
    }
  };

  const roles: UserRole[] = ['ADMIN', 'MOTORISTA', 'MONTADOR', 'CONFERENTE', 'VENDEDOR', 'GERENTE'];

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestão de Equipe</h1>
          <p className="text-slate-500">Controle de acessos e perfis do sistema</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-200"
        >
          <Plus className="w-5 h-5" /> Adicionar Funcionário
        </button>
      </header>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <th className="px-6 py-4">Funcionário</th>
              <th className="px-6 py-4">Unidade</th>
              <th className="px-6 py-4">Usuário</th>
              <th className="px-6 py-4">Perfil</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employees.map(emp => (
              <tr key={emp.id} className="hover:bg-slate-50/50 group">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-500 uppercase">
                      {emp.name.substring(0, 2)}
                    </div>
                    <span className="font-bold text-slate-900 uppercase text-sm">{emp.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {emp.storeId ? (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                      <StoreIcon className="w-3 h-3" /> {stores.find(s => s.id === emp.storeId)?.name}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-300 font-bold">GERAL</span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm font-medium text-slate-500">{emp.username}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-lg text-[10px] font-black border ${emp.role === 'ADMIN' ? 'bg-red-50 text-red-600 border-red-100' :
                      emp.role === 'MOTORISTA' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                        emp.role === 'MONTADOR' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                          emp.role === 'GERENTE' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                            'bg-slate-50 text-slate-600 border-slate-200'
                    }`}>
                    {emp.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600">
                    <CheckCircle className="w-3 h-3" /> ATIVO
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => handleOpenModal(emp)} className="text-blue-600 font-bold text-xs hover:underline">Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-black text-slate-900 uppercase">{editingEmployee ? 'Editar Acesso' : 'Novo Funcionário'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-1">Nome Completo</label>
                  <input required type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none uppercase font-bold text-sm" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase mb-1">Usuário de Login</label>
                    <input required type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium text-sm" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase mb-1">Perfil / Cargo</label>
                    <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-sm" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })}>
                      {roles.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-1">Unidade Designada</label>
                  <select
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-sm"
                    value={formData.storeId || ''}
                    onChange={e => setFormData({ ...formData, storeId: e.target.value })}
                  >
                    <option value="">Nenhuma (Geral)</option>
                    {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-1">Senha de Acesso</label>
                  <input required type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-sm" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                </div>
              </div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black shadow-xl shadow-blue-100 transition-all flex items-center justify-center gap-2">
                <Save className="w-5 h-5" /> SALVAR DADOS
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeesView;
