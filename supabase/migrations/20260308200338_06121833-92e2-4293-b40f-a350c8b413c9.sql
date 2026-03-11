
-- Fix: Allow admins to update ANY profile (not just their own)
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Create shop_settings table to store shop details in DB instead of localStorage
CREATE TABLE public.shop_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_name text NOT NULL DEFAULT 'KVK POINTS',
  tagline text DEFAULT 'Mobile Accessories & More',
  address text DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  gst_number text DEFAULT '',
  logo_url text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.shop_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view shop settings"
ON public.shop_settings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage shop settings"
ON public.shop_settings FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Insert default row
INSERT INTO public.shop_settings (shop_name, tagline, address, phone, gst_number)
VALUES ('MobiStock', 'Mobile Accessories & More', 'Main Market, City Center', '+91 98765 43210', 'GST123456789');

-- Create custom_fields table for dynamic fields on stock/billing
CREATE TABLE public.custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('stock', 'billing')),
  field_name text NOT NULL,
  field_type text NOT NULL DEFAULT 'text' CHECK (field_type IN ('text', 'number', 'date', 'boolean')),
  is_required boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view custom fields"
ON public.custom_fields FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Admins can manage custom fields"
ON public.custom_fields FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Custom field values for stock items
CREATE TABLE public.custom_field_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id uuid REFERENCES public.custom_fields(id) ON DELETE CASCADE NOT NULL,
  entity_id uuid NOT NULL,
  value text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.custom_field_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view custom field values"
ON public.custom_field_values FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Admins can manage custom field values"
ON public.custom_field_values FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
