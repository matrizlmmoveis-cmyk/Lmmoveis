-- 1. Adicionar coluna 'active' em products (se não existir)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- 2. Criar a tabela inventory_movements (se não existir)
CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id TEXT REFERENCES public.products(id) ON DELETE CASCADE,
    location_id TEXT REFERENCES public.stores(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    type TEXT CHECK (type IN ('ENTRADA', 'SAIDA')) NOT NULL,
    reference_id TEXT, -- Pode ser o sale_id, task_id, etc.
    reason TEXT NOT NULL, -- 'VENDA', 'DEVOLUCAO', 'AJUSTE', 'COMPRA', 'CANCELAMENTO'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT -- Nome do usuário ou sistema
);

-- 3. Backfill: Preencher histórico com as vendas passadas
-- Insere um movimento de SAÍDA para cada item vendido (que não esteja cancelado/devolvido)
INSERT INTO public.inventory_movements (product_id, location_id, quantity, type, reference_id, reason, created_at, created_by)
SELECT 
    si.product_id,
    si.location_id,
    si.quantity,
    'SAIDA' AS type,
    si.sale_id AS reference_id,
    'VENDA' AS reason,
    s.date AS created_at,
    s.seller_id AS created_by
FROM 
    public.sale_items si
JOIN 
    public.sales s ON s.id = si.sale_id
WHERE 
    si.location_id IS NOT NULL 
    AND si.location_id NOT IN ('ST-ENCOMENDA', 'ST-MOSTRUARIO')
    AND si.dispatch_status NOT IN ('CANCELADO', 'DEVOLVER', 'DEVOLVIDO');
