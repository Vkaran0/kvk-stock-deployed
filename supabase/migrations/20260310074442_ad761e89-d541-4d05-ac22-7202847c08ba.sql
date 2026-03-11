
-- Customers table
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text DEFAULT '',
  address text DEFAULT '',
  gst_number text DEFAULT '',
  email text DEFAULT '',
  notes text DEFAULT '',
  primary_staff_id uuid DEFAULT NULL,
  primary_staff_name text DEFAULT '',
  total_purchases numeric NOT NULL DEFAULT 0,
  total_spent numeric NOT NULL DEFAULT 0,
  last_purchase_date timestamptz DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Everyone can view customers
CREATE POLICY "Authenticated can view customers" ON public.customers
  FOR SELECT TO authenticated USING (true);

-- Authenticated can insert customers
CREATE POLICY "Authenticated can insert customers" ON public.customers
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- Authenticated can update customers
CREATE POLICY "Authenticated can update customers" ON public.customers
  FOR UPDATE TO authenticated USING (true);

-- Admins can delete customers
CREATE POLICY "Admins can delete customers" ON public.customers
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Customer reminders table
CREATE TABLE public.customer_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL DEFAULT 'Follow up',
  message text DEFAULT '',
  frequency text NOT NULL DEFAULT 'once',
  next_reminder_date date NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.customer_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view reminders" ON public.customer_reminders
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage reminders" ON public.customer_reminders
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can insert reminders" ON public.customer_reminders
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- Add customer_id to bills table for linking
ALTER TABLE public.bills ADD COLUMN customer_id uuid REFERENCES public.customers(id) DEFAULT NULL;
