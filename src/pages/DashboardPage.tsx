import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Package, TrendingUp, Users, Receipt, AlertTriangle, IndianRupee, CreditCard, Mail, Phone, MapPin, Shield, Bell, ChevronRight } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';

const DashboardPage = () => {
  const { user, isAdmin, profile } = useAuth();
  const navigate = useNavigate();

  const { data: stock = [] } = useQuery({
    queryKey: ['stock'],
    queryFn: async () => {
      const { data, error } = await supabase.from('stock_items').select('*');
      if (error) throw error;
      return data;
    },
  });

  const { data: bills = [] } = useQuery({
    queryKey: ['bills', isAdmin, user?.id],
    queryFn: async () => {
      let query = supabase.from('bills').select('*');
      if (!isAdmin && user) query = query.eq('staff_id', user.id);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: billItems = [] } = useQuery({
    queryKey: ['all-bill-items', isAdmin, user?.id],
    queryFn: async () => {
      if (!isAdmin && user) {
        const { data: myBills } = await supabase.from('bills').select('id').eq('staff_id', user.id);
        if (!myBills?.length) return [];
        const billIds = myBills.map(b => b.id);
        const { data, error } = await supabase.from('bill_items').select('*').in('bill_id', billIds);
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase.from('bill_items').select('*');
      if (error) throw error;
      return data;
    },
  });

  const { data: staffProfiles = [] } = useQuery({
    queryKey: ['staff-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*, user_roles(role)').eq('is_active', true);
      if (error) throw error;
      return data.filter((p: any) => (p.user_roles as any[])?.some((r: any) => r.role === 'staff'));
    },
    enabled: isAdmin,
  });

  const { data: fullProfile } = useQuery({
    queryKey: ['full-profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('user_id', user!.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !isAdmin,
  });

  // Fetch due reminders
  const { data: dueReminders = [] } = useQuery({
    queryKey: ['due-reminders'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('customer_reminders')
        .select('*, customers(name, phone)')
        .eq('is_active', true)
        .lte('next_reminder_date', today)
        .order('next_reminder_date');
      if (error) throw error;
      return data;
    },
  });

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayBills = bills.filter(b => b.created_at?.startsWith(today));
    const totalStockValue = stock.reduce((sum, s) => sum + Number(s.sell_price) * s.quantity, 0);
    const totalCostValue = stock.reduce((sum, s) => sum + Number(s.buy_price) * s.quantity, 0);
    const todayRevenue = todayBills.reduce((sum, b) => sum + Number(b.total), 0);
    const totalRevenue = bills.reduce((sum, b) => sum + Number(b.total), 0);
    const totalCost = billItems.reduce((s, item) => {
      const si = stock.find(x => x.id === item.stock_id);
      return s + (Number(si?.buy_price) || 0) * item.quantity;
    }, 0);
    const lowStockItems = stock.filter(s => s.quantity <= s.min_stock);
    const totalItems = stock.reduce((sum, s) => sum + s.quantity, 0);
    return { todayBills: todayBills.length, todayRevenue, totalRevenue, totalCost, totalProfit: totalRevenue - totalCost, totalStockValue, totalCostValue, lowStockItems, totalItems, totalProducts: stock.length };
  }, [stock, bills, billItems]);

  const staffStats = useMemo(() => {
    if (!isAdmin) return [];
    return staffProfiles.map((s: any) => {
      const staffBills = bills.filter(b => b.staff_id === s.user_id);
      const today = new Date().toISOString().split('T')[0];
      const todayBills = staffBills.filter(b => b.created_at?.startsWith(today));
      return { ...s, totalBills: staffBills.length, todayBills: todayBills.length, totalRevenue: staffBills.reduce((sum, b) => sum + Number(b.total), 0), todayRevenue: todayBills.reduce((sum, b) => sum + Number(b.total), 0) };
    });
  }, [staffProfiles, bills, isAdmin]);

  const myStats = useMemo(() => {
    if (isAdmin || !user) return null;
    const myBills = bills.filter(b => b.staff_id === user.id);
    const today = new Date().toISOString().split('T')[0];
    const todayBills = myBills.filter(b => b.created_at?.startsWith(today));
    return { totalBills: myBills.length, todayBills: todayBills.length, totalRevenue: myBills.reduce((sum, b) => sum + Number(b.total), 0), todayRevenue: todayBills.reduce((sum, b) => sum + Number(b.total), 0) };
  }, [bills, user, isAdmin]);

  const statCards = [
    { label: 'Total Products', value: stats.totalProducts, icon: Package, color: 'text-primary' },
    { label: 'Total Items in Stock', value: stats.totalItems, icon: Package, color: 'text-info' },
    { label: "Today's Bills", value: stats.todayBills, icon: Receipt, color: 'text-success' },
    { label: "Today's Revenue", value: `₹${stats.todayRevenue.toLocaleString()}`, icon: IndianRupee, color: 'text-warning' },
    { label: 'Total Revenue', value: `₹${stats.totalRevenue.toLocaleString()}`, icon: TrendingUp, color: 'text-primary' },
    ...(isAdmin ? [
      { label: 'Total Profit', value: `₹${stats.totalProfit.toLocaleString()}`, icon: TrendingUp, color: 'text-success' },
      { label: 'Stock Value (Sell)', value: `₹${stats.totalStockValue.toLocaleString()}`, icon: IndianRupee, color: 'text-info' },
      { label: 'Stock Value (Cost)', value: `₹${stats.totalCostValue.toLocaleString()}`, icon: IndianRupee, color: 'text-warning' },
      { label: 'Active Staff', value: staffProfiles.length, icon: Users, color: 'text-info' },
    ] : []),
    { label: 'Low Stock Alert', value: stats.lowStockItems.length, icon: AlertTriangle, color: 'text-destructive' },
  ];

  return (
    <div className="space-y-6">
      {/* Due Reminders Alert */}
      {dueReminders.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <Bell className="w-4 h-4" /> Customer Reminders Due ({dueReminders.length})
            </h4>
          </div>
          <div className="space-y-2">
            {dueReminders.slice(0, 5).map((r: any) => (
              <button
                key={r.id}
                onClick={() => navigate(`/customers/${r.customer_id}`)}
                className="w-full flex items-center justify-between bg-amber-100/50 dark:bg-amber-900/30 rounded-lg px-3 py-2 text-left hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
              >
                <div>
                  <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                    {(r.customers as any)?.name || 'Customer'} — {r.title}
                  </p>
                  {r.message && <p className="text-[10px] text-amber-700 dark:text-amber-400">{r.message}</p>}
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-[9px] capitalize border-amber-300">{r.frequency}</Badge>
                    <span className="text-[9px] text-amber-600">{new Date(r.next_reminder_date).toLocaleDateString('en-IN')}</span>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-amber-500" />
              </button>
            ))}
            {dueReminders.length > 5 && (
              <p className="text-xs text-amber-600 text-center">+{dueReminders.length - 5} more reminders</p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="stat-card">
            <div className="flex items-center gap-3 mb-2">
              <card.icon className={`w-5 h-5 ${card.color}`} />
              <span className="text-xs text-muted-foreground font-medium">{card.label}</span>
            </div>
            <p className="text-2xl font-display font-bold">{card.value}</p>
          </div>
        ))}
      </div>

      {stats.lowStockItems.length > 0 && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-destructive flex items-center gap-2 mb-3"><AlertTriangle className="w-4 h-4" /> Low Stock Items</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {stats.lowStockItems.map(item => (
              <div key={item.id} className="flex items-center justify-between bg-card rounded-lg px-3 py-2 text-sm">
                <span className="font-medium">{item.name}</span>
                <span className="text-destructive font-bold">{item.quantity} left</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isAdmin && staffStats.length > 0 && (
        <div>
          <h3 className="text-lg font-display font-semibold mb-3">Staff Performance</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {staffStats.map((s: any) => (
              <div key={s.id} className="stat-card">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary overflow-hidden">
                    {s.photo ? <img src={s.photo} className="w-full h-full object-cover" /> : s.name.charAt(0)}
                  </div>
                  <div><p className="font-semibold text-sm">{s.name}</p><p className="text-xs text-muted-foreground">{s.phone || s.email}</p></div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-muted-foreground text-xs">Today Bills</p><p className="font-bold">{s.todayBills}</p></div>
                  <div><p className="text-muted-foreground text-xs">Today Revenue</p><p className="font-bold">₹{s.todayRevenue.toLocaleString()}</p></div>
                  <div><p className="text-muted-foreground text-xs">Total Bills</p><p className="font-bold">{s.totalBills}</p></div>
                  <div><p className="text-muted-foreground text-xs">Total Revenue</p><p className="font-bold">₹{s.totalRevenue.toLocaleString()}</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isAdmin && myStats && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-display font-semibold mb-3">My Performance</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="stat-card"><p className="text-xs text-muted-foreground">Today Bills</p><p className="text-2xl font-bold">{myStats.todayBills}</p></div>
              <div className="stat-card"><p className="text-xs text-muted-foreground">Today Revenue</p><p className="text-2xl font-bold">₹{myStats.todayRevenue.toLocaleString()}</p></div>
              <div className="stat-card"><p className="text-xs text-muted-foreground">Total Bills</p><p className="text-2xl font-bold">{myStats.totalBills}</p></div>
              <div className="stat-card"><p className="text-xs text-muted-foreground">Total Revenue</p><p className="text-2xl font-bold">₹{myStats.totalRevenue.toLocaleString()}</p></div>
            </div>
          </div>

          {fullProfile && (
            <div>
              <h3 className="text-lg font-display font-semibold mb-3 flex items-center gap-2"><CreditCard className="w-5 h-5 text-primary" /> My ID Card</h3>
              <div className="max-w-sm bg-gradient-to-br from-primary/10 via-card to-primary/5 rounded-2xl border-2 border-primary/20 p-5 space-y-4">
                <div className="text-center border-b border-primary/20 pb-3">
                  <h3 className="font-display font-bold text-lg text-primary">KVK POINTS</h3>
                  <p className="text-xs text-muted-foreground">Staff Identity Card</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-24 rounded-xl bg-muted border border-border overflow-hidden flex items-center justify-center">
                    {fullProfile.photo ? <img src={fullProfile.photo} alt={fullProfile.name} className="w-full h-full object-cover" /> : <span className="text-2xl font-bold text-primary">{fullProfile.name.charAt(0)}</span>}
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="font-bold text-lg">{fullProfile.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{(fullProfile as any).staff_id_number || 'N/A'}</p>
                    <span className="inline-block text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">STAFF</span>
                  </div>
                </div>
                <div className="space-y-1.5 text-xs">
                  {fullProfile.email && <p className="flex items-center gap-2"><Mail className="w-3 h-3 text-primary" /> {fullProfile.email}</p>}
                  {fullProfile.phone && <p className="flex items-center gap-2"><Phone className="w-3 h-3 text-primary" /> {fullProfile.phone}</p>}
                  {fullProfile.address && <p className="flex items-center gap-2"><MapPin className="w-3 h-3 text-primary" /> {fullProfile.address}</p>}
                  <p className="flex items-center gap-2"><Shield className="w-3 h-3 text-primary" /> Joined: {fullProfile.join_date || 'N/A'}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
