
import { OrderStatus, Store, Product, InventoryItem, Sale, Seller, Customer, Employee, Supplier } from './types.ts';

export const STORES: Store[] = [
  { id: 'ST01', name: 'PIABETÁ', location: 'Av. Santos Dumont, 2869 - Bongaba', phones: ['(21) 97682-7927'] },
  { id: 'ST02', name: 'MAGÉ', location: 'Centro - Magé', phones: ['(21) 99387-6381'] },
  { id: 'ST03', name: 'LOTE XV', location: 'Belford Roxo', phones: ['(21) 96678-8870'] },
  { id: 'ST04', name: 'SANTA CRUZ DA SERRA', location: 'Duque de Caxias', phones: ['(21) 90000-0000'] },
  { id: 'ST05', name: 'ITABORAÍ', location: 'Centro - Itaboraí', phones: ['(21) 90000-0000'] },
];

export const SUPPLIERS: Supplier[] = [
  { id: 'S1', name: 'FORNECEDOR A', active: true },
  { id: 'S2', name: 'FORNECEDOR B', active: true },
];

export const CATEGORIES = ['Quarto', 'Sala', 'Cozinha', 'Banheiro', 'Escritório', 'Outros'];

export const EMPLOYEES: Employee[] = [
  { id: 'E1', name: 'Marcos Silva', role: 'MOTORISTA', username: 'marcos', password: '123', active: true },
  { id: 'E2', name: 'Joao Montador', role: 'MONTADOR', username: 'joao', password: '123', active: true },
  { id: 'E3', name: 'Carlos Conferente', role: 'CONFERENTE', username: 'carlos', password: '123', active: true },
  { id: 'E4', name: 'Ana Gerente', role: 'GERENTE', username: 'ana', password: '123', active: true, storeId: 'ST01' },
  { id: 'E5', name: 'Pedro Gerente', role: 'GERENTE', username: 'pedro', password: '123', active: true, storeId: 'ST02' },
  { id: 'E6', name: 'Mariana Vendedora', role: 'VENDEDOR', username: 'mariana', password: '123', active: true, storeId: 'ST01' },
  { id: 'E7', name: 'Fernando Vendedor', role: 'VENDEDOR', username: 'fernando', password: '123', active: true, storeId: 'ST02' },
];

export const SELLERS: Seller[] = [
  { id: 'V01', name: 'Juliana', storeId: 'ST01', active: true },
  { id: 'V02', name: 'Ricardo', storeId: 'ST02', active: true },
];

export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'C1',
    type: 'PF',
    name: 'Willian da costa ribeiro junior',
    document: '214.204.107-84',
    email: 'ntem@gmail.com',
    phone: '21969140502',
    zipCode: '25900-000',
    address: 'Maurimarcia rua 8',
    number: '992',
    complement: '',
    neighborhood: 'Piabetá',
    city: 'Magé',
    state: 'RJ',
    reference: 'enfrente ao campo do maurimarcia'
  },
  {
    id: 'C2',
    type: 'PF',
    name: 'Maria Oliveira Santos',
    document: '123.456.789-00',
    email: 'maria@email.com',
    phone: '21988887777',
    zipCode: '25900-111',
    address: 'Rua das Flores',
    number: '15',
    complement: 'Casa A',
    neighborhood: 'Centro',
    city: 'Magé',
    state: 'RJ',
    reference: 'Próximo à padaria central'
  }
];

export const PRODUCTS: Product[] = [
  {
    id: 'P1',
    name: 'BASE CASAL COMUM LINHÃO PRETO',
    category: 'Quarto',
    price: 400.00,
    costPrice: 250.00,
    assemblyPrice: 30.00,
    sku: 'BAS-001',
    imageUrl: 'https://images.unsplash.com/photo-1505693419148-5da1b1569061?q=80&w=500&auto=format&fit=crop',
    supplierId: 'S1'
  },
  {
    id: 'P2',
    name: 'COLCHÃO D33 CASAL AMÉRICA',
    category: 'Quarto',
    price: 700.00,
    costPrice: 450.00,
    assemblyPrice: 0,
    sku: 'COL-001',
    imageUrl: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?q=80&w=500&auto=format&fit=crop',
    supplierId: 'S1'
  },
  {
    id: 'P3',
    name: 'SOFÁ RETRÁTIL 3 LUGARES VELUDO',
    category: 'Sala',
    price: 1850.00,
    costPrice: 1200.00,
    assemblyPrice: 50.00,
    sku: 'SOF-001',
    imageUrl: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?q=80&w=500&auto=format&fit=crop',
    supplierId: 'S2'
  },
  {
    id: 'P4',
    name: 'MESA DE JANTAR 6 CADEIRAS MADEIRA',
    category: 'Cozinha',
    price: 2400.00,
    costPrice: 1600.00,
    assemblyPrice: 80.00,
    sku: 'MES-001',
    imageUrl: 'https://images.unsplash.com/photo-1577145946459-39a587ed503e?q=80&w=500&auto=format&fit=crop',
    supplierId: 'S2'
  },
  {
    id: 'P5',
    name: 'GUARDA-ROUPA 6 PORTAS ESPELHADO',
    category: 'Quarto',
    price: 1200.00,
    costPrice: 800.00,
    assemblyPrice: 120.00,
    sku: 'GUA-001',
    imageUrl: 'https://images.unsplash.com/photo-1595428774223-ef52624120d2?q=80&w=500&auto=format&fit=crop',
    supplierId: 'S1'
  },
  {
    id: 'P6',
    name: 'ARMÁRIO DE COZINHA COMPLETO MODULADO',
    category: 'Cozinha',
    price: 3500.00,
    costPrice: 2200.00,
    assemblyPrice: 200.00,
    sku: 'ARM-001',
    imageUrl: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?q=80&w=500&auto=format&fit=crop',
    supplierId: 'S2'
  },
  {
    id: 'P7',
    name: 'CADEIRA DE ESCRITÓRIO ERGONÔMICA',
    category: 'Escritório',
    price: 850.00,
    costPrice: 500.00,
    assemblyPrice: 20.00,
    sku: 'CAD-001',
    imageUrl: 'https://images.unsplash.com/photo-1505797149-43b0069ec26b?q=80&w=500&auto=format&fit=crop',
    supplierId: 'S1'
  },
  {
    id: 'P8',
    name: 'CRIADO-MUDO 2 GAVETAS BRANCO',
    category: 'Quarto',
    price: 180.00,
    costPrice: 100.00,
    assemblyPrice: 15.00,
    sku: 'CRI-001',
    imageUrl: 'https://images.unsplash.com/photo-1532323544230-7191fd51bc1b?q=80&w=500&auto=format&fit=crop',
    supplierId: 'S2'
  },
];

export const WAREHOUSES = [
  { id: 'W-NORTE', name: 'Norte' },
  { id: 'W-SUL', name: 'Sul' },
  { id: 'W-MEGA', name: 'Estoque Mega' },
];

export const INITIAL_INVENTORY: InventoryItem[] = [
  { productId: 'P1', locationId: 'W-NORTE', quantity: 50, type: 'CD' },
  { productId: 'P1', locationId: 'ST01', quantity: 5, type: 'STORE_STOCK' },
  { productId: 'P2', locationId: 'W-NORTE', quantity: 30, type: 'CD' },
  { productId: 'P3', locationId: 'W-MEGA', quantity: 12, type: 'CD' },
];

export const INITIAL_SALES: Sale[] = [
  {
    id: '101',
    date: '18/02/2026',
    customerName: 'Willian da costa ribeiro junior',
    customerCpf: '214.204.107-84',
    customerPhone: '21969140502',
    customerEmail: 'ntem@gmail.com',
    customerReference: 'enfrente ao campo do maurimarcia, No quintal do senhor aluiso',
    storeId: 'ST01',
    sellerId: 'V01',
    items: [
      { productId: 'P1', quantity: 1, price: 400.00, discount: 5, originalPrice: 400.00, locationId: 'W-NORTE', assemblyRequired: true },
    ],
    payments: [
      { method: 'Dinheiro', amount: 380.00 }
    ],
    total: 380.00,
    status: OrderStatus.PENDING,
    deliveryAddress: 'Piabetá, Maurimarcia rua 8 numero 992',
    deliveryObs: 'entrega terça-feira parte da manha.',
    assemblyRequired: true,
  },
  {
    id: '102',
    date: '18/02/2026',
    customerName: 'Maria Oliveira Santos',
    customerCpf: '123.456.789-00',
    customerPhone: '21988887777',
    customerEmail: 'maria@email.com',
    customerReference: 'Próximo à padaria central',
    storeId: 'ST02',
    sellerId: 'V02',
    items: [
      { productId: 'P3', quantity: 1, price: 1850.00, discount: 0, originalPrice: 1850.00, locationId: 'W-MEGA', assemblyRequired: true },
    ],
    payments: [
      { method: 'PIX', amount: 1850.00 }
    ],
    total: 1850.00,
    status: OrderStatus.PENDING,
    deliveryAddress: 'Rua das Flores, 15 - Centro, Magé',
    deliveryObs: 'Cliente quer entrega após as 14h.',
    assemblyRequired: true,
  },
  {
    id: '103',
    date: '18/02/2026',
    customerName: 'Willian da costa ribeiro junior',
    customerCpf: '214.204.107-84',
    customerPhone: '21969140502',
    customerEmail: 'ntem@gmail.com',
    customerReference: 'enfrente ao campo do maurimarcia',
    storeId: 'ST01',
    sellerId: 'V01',
    items: [
      { productId: 'P4', quantity: 1, price: 2400.00, discount: 10, originalPrice: 2400.00, locationId: 'W-NORTE', assemblyRequired: true },
    ],
    payments: [
      { method: 'Cartão de Crédito', amount: 2160.00 }
    ],
    total: 2160.00,
    status: OrderStatus.PENDING,
    deliveryAddress: 'Piabetá, Maurimarcia rua 8 numero 992',
    deliveryObs: 'Montagem urgente.',
    assemblyRequired: true,
  }
];
