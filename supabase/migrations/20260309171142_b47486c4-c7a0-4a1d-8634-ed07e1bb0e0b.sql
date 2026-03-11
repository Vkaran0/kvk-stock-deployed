
-- Udhari (Credit) table to track outstanding amounts on bills
CREATE TABLE public.udhari (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  bill_number text NOT NULL,
  customer_name text NOT NULL,
  customer_phone text DEFAULT '',
  total_amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  remaining_amount numeric NOT NULL DEFAULT 0,
  staff_id uuid,
  staff_name text DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Udhari payments table for tracking individual payments against credit
CREATE TABLE public.udhari_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  udhari_id uuid NOT NULL REFERENCES public.udhari(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  payment_mode text NOT NULL DEFAULT 'cash',
  notes text DEFAULT '',
  received_by uuid,
  received_by_name text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.udhari ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.udhari_payments ENABLE ROW LEVEL SECURITY;

-- RLS for udhari
CREATE POLICY "Authenticated can view udhari" ON public.udhari FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert udhari" ON public.udhari FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can update udhari" ON public.udhari FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete udhari" ON public.udhari FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS for udhari_payments
CREATE POLICY "Authenticated can view udhari payments" ON public.udhari_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert udhari payments" ON public.udhari_payments FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete udhari payments" ON public.udhari_payments FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
