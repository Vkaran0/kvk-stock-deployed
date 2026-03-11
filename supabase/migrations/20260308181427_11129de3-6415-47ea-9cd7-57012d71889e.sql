
-- Fix permissive bills INSERT policy
DROP POLICY "Authenticated can create bills" ON public.bills;
CREATE POLICY "Authenticated can create own bills" ON public.bills FOR INSERT TO authenticated WITH CHECK (auth.uid() = staff_id);

-- Fix permissive bill items INSERT policy  
DROP POLICY "Authenticated can create bill items" ON public.bill_items;
CREATE POLICY "Authenticated can create bill items" ON public.bill_items FOR INSERT TO authenticated 
WITH CHECK (EXISTS (SELECT 1 FROM public.bills WHERE id = bill_id AND staff_id = auth.uid()));

-- Fix permissive daily_stock INSERT policy
DROP POLICY "Authenticated can insert daily stock" ON public.daily_stock;
CREATE POLICY "Authenticated can insert own daily stock" ON public.daily_stock FOR INSERT TO authenticated WITH CHECK (auth.uid() = staff_id);

-- Fix permissive daily_stock UPDATE policy
DROP POLICY "Authenticated can update daily stock" ON public.daily_stock;
CREATE POLICY "Authenticated can update own daily stock" ON public.daily_stock FOR UPDATE TO authenticated USING (auth.uid() = staff_id);
