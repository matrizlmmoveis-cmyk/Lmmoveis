
import React, { useState, useEffect } from 'react';
import { Customer } from '../types.ts';
import { Search, Plus, X, User, Building, MapPin, Loader2, Phone, Mail, CheckCircle2 } from 'lucide-react';
import { supabaseService } from '../services/supabaseService.ts';

interface CustomersProps {
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
}

const Customers: React.FC<CustomersProps> = ({ customers, setCustomers }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoadingApi, setIsLoadingApi] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<Customer>>({
    type: 'PF',
    name: '',
    document: '',
    email: '',
    phone: '',
    zipCode: '',
    address: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    reference: ''
  });

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.document.includes(searchTerm)
  );

  // CEP Auto Search
  useEffect(() => {
    const cep = formData.zipCode?.replace(/\D/g, '');
    if (cep && cep.length === 8) {
      const fetchCep = async () => {
        setIsLoadingApi(true);
        try {
          const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
          const data = await res.json();
          if (!data.erro) {
            setFormData(prev => ({
              ...prev,
              address: data.logradouro,
              neighborhood: data.bairro,
              city: data.localidade,
              state: data.uf
            }));
          }
        } catch (err) {
          console.error("Erro ao buscar CEP", err);
        } finally {
          setIsLoadingApi(false);
        }
      };
      fetchCep();
    }
  }, [formData.zipCode]);

  // CNPJ Auto Search
  useEffect(() => {
    const cnpj = formData.document?.replace(/\D/g, '');
    if (formData.type === 'PJ' && cnpj && cnpj.length === 14) {
      const fetchCnpj = async () => {
        setIsLoadingApi(true);
        try {
          // Using BrasilAPI as it's more reliable and free for most cases
          const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
          const data = await res.json();
          if (res.ok) {
            setFormData(prev => ({
              ...prev,
              name: data.razao_social || data.nome_fantasia,
              zipCode: data.cep,
              address: data.logradouro,
              number: data.numero,
              complement: data.complemento,
              neighborhood: data.bairro,
              city: data.municipio,
              state: data.uf,
              phone: data.ddd_telefone_1 || ''
            }));
          }
        } catch (err) {
          console.error("Erro ao buscar CNPJ", err);
        } finally {
          setIsLoadingApi(false);
        }
      };
      fetchCnpj();
    }
  }, [formData.document, formData.type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing && selectedCustomerId) {
        await supabaseService.updateCustomer(selectedCustomerId, formData);
        setCustomers(customers.map(c => c.id === selectedCustomerId ? { ...c, ...formData } as Customer : c));
      } else {
        const newId = `C${Date.now()}`;
        const newCustomer = {
          ...formData,
          id: newId
        } as Customer;

        await supabaseService.createCustomer(newCustomer);
        setCustomers([newCustomer, ...customers]);
      }
      setIsModalOpen(false);
      resetForm();
    } catch (err) {
      console.error("Erro ao salvar cliente:", err);
      alert("Erro ao salvar cliente no banco de dados.");
    }
  };

  const resetForm = () => {
    setFormData({
      type: 'PF',
      name: '',
      document: '',
      email: '',
      phone: '',
      zipCode: '',
      address: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
      reference: ''
    });
    setIsEditing(false);
    setSelectedCustomerId(null);
  };

  const handleEdit = (customer: Customer) => {
    setFormData({ ...customer });
    setSelectedCustomerId(customer.id);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-500">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cadastro de Clientes</h1>
          <p className="text-slate-500">Gestão completa de compradores PF e PJ</p>
        </div>
        <div className="flex gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Nome ou documento..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-sm transition-all shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 font-bold shadow-lg shadow-blue-100 transition-all"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">Novo Cliente</span>
          </button>
        </div>
      </header>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Cliente</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Documento</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Contato</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Localização</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.map(customer => (
                <tr key={customer.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${customer.type === 'PF' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                        {customer.type}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm uppercase">{customer.name}</p>
                        <p className="text-[10px] text-slate-400 uppercase">ID: {customer.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-600">
                    {customer.document}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Phone className="w-3 h-3" /> {customer.phone}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Mail className="w-3 h-3" /> {customer.email}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">
                    <p className="font-medium text-slate-700">{customer.city}, {customer.state}</p>
                    <p>{customer.neighborhood}</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleEdit(customer)}
                      className="text-blue-600 font-bold text-xs hover:underline"
                    >
                      Detalhes
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl my-auto animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-black text-slate-900 uppercase">
                  {isEditing ? 'Editar Cadastro' : 'Novo Cadastro'}
                </h2>
                {isLoadingApi && <Loader2 className="w-5 h-5 animate-spin text-blue-600" />}
              </div>
              <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="flex bg-slate-100 p-1 rounded-2xl w-fit">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'PF' })}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${formData.type === 'PF' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                >
                  <User className="w-4 h-4" /> PESSOA FÍSICA
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'PJ' })}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${formData.type === 'PJ' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500'}`}
                >
                  <Building className="w-4 h-4" /> PESSOA JURÍDICA
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-1">{formData.type === 'PF' ? 'CPF' : 'CNPJ'}</label>
                  <input
                    required
                    type="text"
                    placeholder={formData.type === 'PF' ? "000.000.000-00" : "00.000.000/0000-00"}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 transition-all outline-none"
                    value={formData.document}
                    onChange={e => setFormData({ ...formData, document: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-1">Nome / Razão Social</label>
                  <input
                    required
                    type="text"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 transition-all outline-none uppercase"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-1">WhatsApp / Telefone</label>
                  <input
                    required
                    type="text"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 transition-all outline-none"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-1">E-mail</label>
                  <input
                    required
                    type="email"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 transition-all outline-none"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div className="col-span-1 md:col-span-2 border-t border-slate-100 pt-4 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-black text-slate-400 uppercase">Endereço de Entrega</h3>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-1">CEP</label>
                  <input
                    required
                    type="text"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 transition-all outline-none"
                    value={formData.zipCode}
                    onChange={e => setFormData({ ...formData, zipCode: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-1">Logradouro</label>
                  <input
                    required
                    type="text"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 transition-all outline-none uppercase"
                    value={formData.address}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase mb-1">Número</label>
                    <input
                      required
                      type="text"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 transition-all outline-none"
                      value={formData.number}
                      onChange={e => setFormData({ ...formData, number: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase mb-1">Bairro</label>
                    <input
                      required
                      type="text"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 transition-all outline-none uppercase"
                      value={formData.neighborhood}
                      onChange={e => setFormData({ ...formData, neighborhood: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase mb-1">Cidade</label>
                    <input
                      required
                      type="text"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 transition-all outline-none uppercase"
                      value={formData.city}
                      onChange={e => setFormData({ ...formData, city: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase mb-1">UF</label>
                    <input
                      required
                      maxLength={2}
                      type="text"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 transition-all outline-none uppercase"
                      value={formData.state}
                      onChange={e => setFormData({ ...formData, state: e.target.value })}
                    />
                  </div>
                </div>

                <div className="col-span-1 md:col-span-2">
                  <label className="block text-xs font-black text-slate-400 uppercase mb-1">Ponto de Referência</label>
                  <textarea
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 transition-all outline-none h-20 uppercase text-xs"
                    value={formData.reference}
                    onChange={e => setFormData({ ...formData, reference: e.target.value })}
                  />
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-bold shadow-xl shadow-blue-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Salvar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
