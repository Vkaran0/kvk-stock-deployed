
-- Create attendance table
CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  check_in_time timestamptz,
  check_out_time timestamptz,
  check_in_selfie text,
  check_out_selfie text,
  check_in_lat numeric,
  check_in_lng numeric,
  check_out_lat numeric,
  check_out_lng numeric,
  check_in_address text DEFAULT '',
  check_out_address text DEFAULT '',
  status text NOT NULL DEFAULT 'present',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Staff can view their own attendance
CREATE POLICY "Users can view own attendance" ON public.attendance
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Staff can insert their own attendance
CREATE POLICY "Users can insert own attendance" ON public.attendance
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Staff can update their own attendance (for check-out)
CREATE POLICY "Users can update own attendance" ON public.attendance
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all attendance
CREATE POLICY "Admins can view all attendance" ON public.attendance
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Admins can manage all attendance
CREATE POLICY "Admins can manage attendance" ON public.attendance
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
