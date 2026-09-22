CREATE TABLE IF NOT EXISTS public.whatsapp_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  api_url text NOT NULL,
  api_key text NOT NULL,
  instance_name text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

TRUNCATE TABLE public.whatsapp_settings RESTART IDENTITY;

INSERT INTO public.whatsapp_settings (api_url, api_key, instance_name)
VALUES ('https://evolution-api-d8bj-production.up.railway.app', '046ac732c84e016dcb525f29e7e947766b4aa33d047b362aea84e07b8528097d', 'lm-moveis');
