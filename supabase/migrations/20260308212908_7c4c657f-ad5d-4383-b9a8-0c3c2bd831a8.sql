
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS invoice_url text DEFAULT '';
