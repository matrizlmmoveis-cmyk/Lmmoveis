-- Adiciona a coluna customer_signature_url
ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS customer_signature_url text;

-- Cria o bucket publico para os recibos (se não existir)
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Permite acesso publico para leitura
CREATE POLICY "Public Access for receipts" ON storage.objects
  FOR SELECT USING (bucket_id = 'receipts');

-- Permite acesso publico para escrita (anonimo pode subir assinatura)
CREATE POLICY "Public Upload for receipts" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'receipts');
