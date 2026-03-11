
-- Fix 1: Allow authenticated users to update stock_items (for billing deduction)
DROP POLICY IF EXISTS "Staff can update stock quantity" ON public.stock_items;
CREATE POLICY "Staff can update stock quantity"
ON public.stock_items
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Fix 2: Fix attendance RLS - drop restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Admins can manage attendance" ON public.attendance;
DROP POLICY IF EXISTS "Admins can view all attendance" ON public.attendance;
DROP POLICY IF EXISTS "Users can insert own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Users can update own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Users can view own attendance" ON public.attendance;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Users can view own attendance"
ON public.attendance FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all attendance"
ON public.attendance FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own attendance"
ON public.attendance FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own attendance"
ON public.attendance FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage attendance"
ON public.attendance FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
