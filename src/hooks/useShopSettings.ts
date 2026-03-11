import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ShopSettings {
  id: string;
  shop_name: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  gst_number: string;
  logo_url: string;
}

export const useShopSettings = () => {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['shop-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shop_settings')
        .select('*')
        .limit(1)
        .single();
      if (error) throw error;
      return data as ShopSettings;
    },
  });

  const updateSettings = useMutation({
    mutationFn: async (updates: Partial<ShopSettings>) => {
      if (!settings?.id) throw new Error('No settings found');
      const { error } = await supabase
        .from('shop_settings')
        .update(updates)
        .eq('id', settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop-settings'] });
      toast.success('Shop settings saved!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    settings: settings || {
      id: '', shop_name: 'MobiStock', tagline: 'Mobile Accessories & More',
      address: '', phone: '', email: '', gst_number: '', logo_url: '',
    },
    isLoading,
    updateSettings,
  };
};
