import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const today = new Date().toISOString().split('T')[0];

    // Check if today's record already exists
    const { data: existing } = await supabase
      .from('daily_stock')
      .select('id')
      .eq('date', today)
      .is('staff_id', null)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ message: 'Daily stock summary already exists for today' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all stock items
    const { data: stockItems } = await supabase.from('stock_items').select('*');
    const totalStock = (stockItems || []).reduce((sum, s) => sum + s.quantity, 0);

    // Get today's bills
    const { data: todayBills } = await supabase
      .from('bills')
      .select('*')
      .gte('created_at', `${today}T00:00:00`)
      .lt('created_at', `${today}T23:59:59`);

    // Get today's bill items
    const billIds = (todayBills || []).map(b => b.id);
    let totalItemsSold = 0;
    let totalRevenue = 0;
    let totalCost = 0;

    if (billIds.length > 0) {
      const { data: items } = await supabase
        .from('bill_items')
        .select('*')
        .in('bill_id', billIds);

      totalItemsSold = (items || []).reduce((sum, i) => sum + i.quantity, 0);
      totalRevenue = (todayBills || []).reduce((sum, b) => sum + Number(b.total), 0);

      // Calculate cost
      for (const item of items || []) {
        if (item.stock_id) {
          const stockItem = (stockItems || []).find(s => s.id === item.stock_id);
          if (stockItem) {
            totalCost += Number(stockItem.buy_price) * item.quantity;
          }
        }
      }
    }

    // Insert daily stock summary
    const { error } = await supabase.from('daily_stock').insert({
      date: today,
      opening_stock: totalStock + totalItemsSold, // what we had before selling
      closing_stock: totalStock,
      total_items_sold: totalItemsSold,
      total_revenue: totalRevenue,
      total_profit: totalRevenue - totalCost,
    });

    if (error) throw error;

    return new Response(JSON.stringify({ message: 'Daily stock summary generated', date: today }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
