
-- Drop all existing RESTRICTIVE attendance policies
DROP POLICY IF EXISTS "Users can view own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Admins can view all attendance" ON public.attendance;
DROP POLICY IF EXISTS "Users can insert own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Users can update own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Admins can manage attendance" ON public.attendance;
DROP POLICY IF EXISTS "Users can delete own rejected attendance" ON public.attendance;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Users can view own attendance" ON public.attendance FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all attendance" ON public.attendance FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert own attendance" ON public.attendance FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own attendance" ON public.attendance FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage attendance" ON public.attendance FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can delete own rejected attendance" ON public.attendance FOR DELETE TO authenticated USING (auth.uid() = user_id AND status = 'rejected');

-- Also fix other tables that have RESTRICTIVE policies
DROP POLICY IF EXISTS "All can view bill items" ON public.bill_items;
DROP POLICY IF EXISTS "Authenticated can create bill items" ON public.bill_items;
CREATE POLICY "All can view bill items" ON public.bill_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create bill items" ON public.bill_items FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "All can view bills" ON public.bills;
DROP POLICY IF EXISTS "Admins can update bills" ON public.bills;
DROP POLICY IF EXISTS "Admins can delete bills" ON public.bills;
DROP POLICY IF EXISTS "Authenticated can create own bills" ON public.bills;
CREATE POLICY "All can view bills" ON public.bills FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can update bills" ON public.bills FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete bills" ON public.bills FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can create own bills" ON public.bills FOR INSERT TO authenticated WITH CHECK (auth.uid() = staff_id);

DROP POLICY IF EXISTS "All can view stock" ON public.stock_items;
DROP POLICY IF EXISTS "Admins can insert stock" ON public.stock_items;
DROP POLICY IF EXISTS "Admins can update stock" ON public.stock_items;
DROP POLICY IF EXISTS "Admins can delete stock" ON public.stock_items;
DROP POLICY IF EXISTS "Staff can update stock quantity" ON public.stock_items;
CREATE POLICY "All can view stock" ON public.stock_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert stock" ON public.stock_items FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete stock" ON public.stock_items FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can update stock" ON public.stock_items FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can view holidays" ON public.holidays;
DROP POLICY IF EXISTS "Admins can manage holidays" ON public.holidays;
CREATE POLICY "Anyone can view holidays" ON public.holidays FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage holidays" ON public.holidays FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "All can view daily stock" ON public.daily_stock;
DROP POLICY IF EXISTS "Authenticated can insert own daily stock" ON public.daily_stock;
DROP POLICY IF EXISTS "Authenticated can update own daily stock" ON public.daily_stock;
CREATE POLICY "All can view daily stock" ON public.daily_stock FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert daily stock" ON public.daily_stock FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update daily stock" ON public.daily_stock FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can insert profiles" ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete profiles" ON public.profiles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can view roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Users can view roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Anyone can view shop settings" ON public.shop_settings;
DROP POLICY IF EXISTS "Admins can manage shop settings" ON public.shop_settings;
CREATE POLICY "Anyone can view shop settings" ON public.shop_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage shop settings" ON public.shop_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Anyone can view custom fields" ON public.custom_fields;
DROP POLICY IF EXISTS "Admins can manage custom fields" ON public.custom_fields;
CREATE POLICY "Anyone can view custom fields" ON public.custom_fields FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage custom fields" ON public.custom_fields FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Anyone can view custom field values" ON public.custom_field_values;
DROP POLICY IF EXISTS "Admins can manage custom field values" ON public.custom_field_values;
CREATE POLICY "Anyone can view custom field values" ON public.custom_field_values FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage custom field values" ON public.custom_field_values FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
