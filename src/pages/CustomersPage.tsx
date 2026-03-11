import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Users, IndianRupee, ShoppingCart, TrendingUp, Phone, MapPin, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { exportToCSV } from '@/lib/exportUtils';
import { Download } from 'lucide-react';

const CustomersPage = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'spent' | 'recent'>('recent');

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('customers').select('*').order('updated_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Staff filter for admin
  const { data: staffList = [] } = useQuery({
    queryKey: ['profiles-staff'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, name');
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  const [staffFilter, setStaffFilter] = useState('all');

  const filtered = useMemo(() => {
    let list = customers;
    if (staffFilter !== 'all' && isAdmin) {
      list = list.filter(c => c.primary_staff_id === staffFilter);
    }
    if (!isAdmin && user) {
      list = list.filter(c => c.primary_staff_id === user.id || !c.primary_staff_id);
    }
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(s) ||
        (c.phone && c.phone.toLowerCase().includes(s)) ||
        (c.email && c.email.toLowerCase().includes(s))
      );
    }
    if (sortBy === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === 'spent') list = [...list].sort((a, b) => Number(b.total_spent) - Number(a.total_spent));
    else list = [...list].sort((a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime());
    return list;
  }, [customers, search, sortBy, staffFilter, isAdmin, user]);

  const totalCustomers = filtered.length;
  const totalSpent = filtered.reduce((s, c) => s + Number(c.total_spent || 0), 0);
  const totalPurchases = filtered.reduce((s, c) => s + Number(c.total_purchases || 0), 0);

  const handleExport = () => {
    exportToCSV(filtered.map(c => ({
      Name: c.name, Phone: c.phone, Address: c.address, Email: c.email,
      'Total Purchases': c.total_purchases, 'Total Spent': c.total_spent,
      'Last Purchase': c.last_purchase_date ? new Date(c.last_purchase_date).toLocaleDateString('en-IN') : '-',
      Staff: c.primary_staff_name,
    })), 'customers_list');
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Users className="w-4 h-4" />
            <span className="text-xs font-medium">Total Customers</span>
          </div>
          <p className="text-2xl font-bold">{totalCustomers}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <IndianRupee className="w-4 h-4" />
            <span className="text-xs font-medium">Total Revenue</span>
          </div>
          <p className="text-2xl font-bold text-primary">₹{totalSpent.toLocaleString()}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <ShoppingCart className="w-4 h-4" />
            <span className="text-xs font-medium">Total Orders</span>
          </div>
          <p className="text-2xl font-bold">{totalPurchases}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search customer name, phone, email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <div className="flex gap-2">
          {(['recent', 'name', 'spent'] as const).map(s => (
            <Button key={s} size="sm" variant={sortBy === s ? 'default' : 'outline'} onClick={() => setSortBy(s)} className="capitalize text-xs">
              {s === 'recent' ? 'Recent' : s === 'name' ? 'A-Z' : 'Top Spender'}
            </Button>
          ))}
        </div>
        {isAdmin && (
          <select value={staffFilter} onChange={e => setStaffFilter(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
            <option value="all">All Staff</option>
            {staffList.map((s: any) => <option key={s.user_id} value={s.user_id}>{s.name}</option>)}
          </select>
        )}
        <Button size="sm" variant="outline" onClick={handleExport}>
          <Download className="w-4 h-4 mr-1" /> Export
        </Button>
      </div>

      {/* Customer List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading customers...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No customers found</p>
          <p className="text-xs mt-1">Customers are automatically created when you generate bills</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(customer => (
            <button
              key={customer.id}
              onClick={() => navigate(`/customers/${customer.id}`)}
              className="stat-card text-left hover:border-primary/40 transition-all group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                    {customer.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{customer.name}</h3>
                    {customer.phone && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {customer.phone}
                      </p>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
              </div>

              {customer.address && (
                <p className="text-xs text-muted-foreground mt-2 flex items-start gap-1 line-clamp-1">
                  <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" /> {customer.address}
                </p>
              )}

              <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{Number(customer.total_purchases || 0)} orders</span>
                </div>
                <span className="text-sm font-bold text-primary">₹{Number(customer.total_spent || 0).toLocaleString()}</span>
              </div>

              {customer.primary_staff_name && (
                <p className="text-[10px] text-muted-foreground/60 mt-1">Staff: {customer.primary_staff_name}</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomersPage;
