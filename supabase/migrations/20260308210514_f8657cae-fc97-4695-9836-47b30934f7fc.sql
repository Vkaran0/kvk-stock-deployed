
-- Allow staff to delete their own rejected attendance (for re-submission)
CREATE POLICY "Users can delete own rejected attendance" ON public.attendance FOR DELETE TO authenticated USING (auth.uid() = user_id AND status = 'rejected');
