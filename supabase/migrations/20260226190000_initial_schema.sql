-- SCRIPT DE CRIAÇÃO DO ESQUEMA ERP MÓVEIS LM
-- COPIE ESTE CONTEÚDO E COLE NO SQL EDITOR DO SUPABASE

-- Extensões úteis
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. UNIDADES (LOJAS / CD)
CREATE TABLE IF NOT EXISTS public.stores (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT,
    phones TEXT[] DEFAULT '{}',
    type TEXT CHECK (type IN ('CD', 'STORE_STOCK')) NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. FORNECEDORES
CREATE TABLE IF NOT EXISTS public.suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. PRODUTOS
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    price DECIMAL(12,2) NOT NULL,
    cost_price DECIMAL(12,2),
    assembly_price DECIMAL(12,2),
    sku TEXT UNIQUE,
    image_url TEXT,
    supplier_id TEXT REFERENCES public.suppliers(id),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. FUNCIONÁRIOS (PERFIS)
-- Nota: O campo username será usado para mapear o email do Supabase Auth
CREATE TABLE IF NOT EXISTS public.employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL, -- 'ADMIN', 'MOTORISTA', 'MONTADOR', 'CONFERENTE', 'VENDEDOR', 'GERENTE'
    username TEXT UNIQUE NOT NULL, -- Email correspondente no Auth
    active BOOLEAN DEFAULT true,
    store_id TEXT REFERENCES public.stores(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. CLIENTES
CREATE TABLE IF NOT EXISTS public.customers (
    id TEXT PRIMARY KEY,
    type TEXT CHECK (type IN ('PF', 'PJ')),
    name TEXT NOT NULL,
    document TEXT UNIQUE NOT NULL,
    email TEXT,
    phone TEXT,
    zip_code TEXT,
    address TEXT,
    number TEXT,
    complement TEXT,
    neighborhood TEXT,
    city TEXT,
    state TEXT,
    reference TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ESTOQUE (INVENTÁRIO)
CREATE TABLE IF NOT EXISTS public.inventory (
    id BIGSERIAL PRIMARY KEY,
    product_id TEXT REFERENCES public.products(id) ON DELETE CASCADE,
    location_id TEXT REFERENCES public.stores(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    type TEXT CHECK (type IN ('CD', 'STORE_STOCK', 'SHOWROOM')),
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- 7. VENDAS (CONTRATOS E ORÇAMENTOS)
CREATE TABLE IF NOT EXISTS public.sales (
    id TEXT PRIMARY KEY,
    date TIMESTAMPTZ DEFAULT NOW(),
    customer_name TEXT,
    customer_cpf TEXT,
    customer_phone TEXT,
    customer_email TEXT,
    customer_reference TEXT,
    store_id TEXT REFERENCES public.stores(id),
    seller_id TEXT REFERENCES public.employees(id),
    total DECIMAL(12,2) NOT NULL,
    status TEXT NOT NULL,
    delivery_date DATE,
    delivery_address TEXT,
    delivery_obs TEXT,
    assembly_required BOOLEAN DEFAULT false,
    assigned_driver_id TEXT REFERENCES public.employees(id),
    assigned_assembler_id TEXT REFERENCES public.employees(id),
    pix_code TEXT,
    delivery_signature TEXT, -- Armazenado como Base64 ou URL de Storage
    delivery_photo TEXT,      -- Armazenado como Base64 ou URL de Storage
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. ITENS DA VENDA (SALE ITEMS)
CREATE TABLE IF NOT EXISTS public.sale_items (
    id BIGSERIAL PRIMARY KEY,
    sale_id TEXT REFERENCES public.sales(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES public.products(id),
    quantity INTEGER NOT NULL,
    price DECIMAL(12,2) NOT NULL,
    discount DECIMAL(12,2) DEFAULT 0,
    original_price DECIMAL(12,2),
    location_id TEXT REFERENCES public.stores(id),
    assembly_required BOOLEAN DEFAULT false
);

-- 9. PAGAMENTOS DA VENDA (SALE PAYMENTS)
CREATE TABLE IF NOT EXISTS public.sale_payments (
    id BIGSERIAL PRIMARY KEY,
    sale_id TEXT REFERENCES public.sales(id) ON DELETE CASCADE,
    method TEXT NOT NULL, -- 'Dinheiro', 'PIX', 'Cartão', etc
    amount DECIMAL(12,2) NOT NULL,
    details TEXT
);

-- DESABILITAR RLS POR ENQUANTO PARA TESTES (OPCIONAL)
-- ALTER TABLE stores DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE products DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE employees DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE inventory DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE sales DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE sale_items DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE sale_payments DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE suppliers DISABLE ROW LEVEL SECURITY;
