
-- Add aadhar_photo, signature, address_line2, emergency_contact, emergency_phone to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address_line2 text DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS emergency_contact text DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS emergency_phone text DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS aadhar_photo text DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS signature_photo text DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS staff_id_number text DEFAULT '';
