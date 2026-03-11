
-- Create stock_invoices table for multiple invoices per stock item
CREATE TABLE public.stock_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id uuid NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  invoice_url text NOT NULL DEFAULT '',
  quantity_added integer NOT NULL DEFAULT 0,
  buy_price numeric NOT NULL DEFAULT 0,
  sell_price numeric NOT NULL DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stock_invoices ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can view stock invoices" ON public.stock_invoices FOR SELECT USING (true);
CREATE POLICY "Admins can manage stock invoices" ON public.stock_invoices FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can insert stock invoices" ON public.stock_invoices FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
