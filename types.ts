
export enum OrderStatus {
  PENDING = 'Aguardando Entrega',
  SHIPPED = 'Em Rota',
  DELIVERED = 'Entregue - Aguardando Montagem',
  ASSEMBLY_PENDING = 'Montagem Pendente',
  COMPLETED = 'Entregue',
  CANCEL_PENDING = 'Cancelamento Pendente',
  EDIT_PENDING = 'Edição Pendente',
  CANCELED = 'Cancelada'
}



export interface Romaneio {
  id: string;
  type: 'entrega' | 'montagem';
  employeeId: string;
  saleIds: string[];
  createdAt?: string;
  status: 'ATIVO' | 'CONCLUIDO';
}

export type UserRole = 'ADMIN' | 'MOTORISTA' | 'MONTADOR' | 'CONFERENTE' | 'VENDEDOR' | 'GERENTE' | 'SUPERVISOR';

export interface Employee {
  id: string;
  name: string;
  role: UserRole;
  username: string;
  password?: string;
  active: boolean;
  storeId?: string;
}

export interface Store {
  id: string;
  name: string;
  location: string;
  phones?: string[];
  type: 'CD' | 'STORE_STOCK' | 'CD_LOJA';
}

export interface Seller {
  id: string;
  name: string;
  storeId: string;
  active: boolean;
}

export interface Supplier {
  id: string;
  name: string;
  active: boolean;
}

export interface ProductImage {
  id: string;
  productId: string;
  storagePath: string;
  url: string;
  sortOrder: number;
  createdAt?: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  costPrice: number;
  assemblyPrice: number;
  sku: string;
  imageUrl?: string;
  imageUrl2?: string;
  supplierId?: string;
  images?: ProductImage[];
}

export interface Customer {
  id: string;
  type: 'PF' | 'PJ';
  name: string;
  document: string;
  email: string;
  phone: string;
  zipCode: string;
  address: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  reference: string;
}

export interface InventoryItem {
  productId: string;
  locationId: string;
  quantity: number;
  type: 'CD' | 'STORE_STOCK' | 'SHOWROOM';
}

export type PaymentStatus = 'CONFERIDO' | 'PENDENTE_ENTREGA' | 'AGUARDANDO_ACERTO' | 'PAGO_EM_LOJA';


export interface Payment {
  method: 'Dinheiro' | 'PIX' | 'Cartão de Crédito' | 'Cartão de Débito' | 'Boleto' | 'Crediário' | 'Entrega';
  amount: number;
  details?: string;
  status?: PaymentStatus;
}

export interface SaleItem {
  productId: string;
  quantity: number;
  price: number;
  discount: number;
  originalPrice: number;
  locationId: string;
  assemblyRequired: boolean;
}

export interface Sale {
  id: string;
  date: string;
  customerName: string;
  customerCpf: string;
  customerPhone: string;
  customerEmail: string;
  customerReference: string;
  storeId: string;
  sellerId: string;
  items: SaleItem[];
  payments: Payment[];
  total: number;
  status: OrderStatus;
  deliveryDate?: string;
  deliveryAddress: string;
  deliveryObs: string;
  assemblyRequired: boolean; // Global flag for compatibility, though items have their own
  assignedDriverId?: string;
  assignedAssemblerId?: string;
  pixCode?: string;
  deliverySignature?: string; // Assinatura em Base64
  deliveryPhoto?: string;     // Foto em Base64 (baixa resolução)
}
