import { useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, TrendingUp, IndianRupee, Receipt, Calendar, Users, ArrowUpDown, Filter, FileText, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area } from 'recharts';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--info))', 'hsl(var(--destructive))', '#8b5cf6', '#f59e0b', '#10b981'];

type TimePeriod = 'today' | '7days' | '30days' | 'month' | 'all' | 'custom';

const AnalysisPage = () => {
  const { user, isAdmin } = useAuth();
  const [dateFilter, setDateFilter] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('all');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('30days');
  const [productSortBy, setProductSortBy] = useState<'revenue' | 'qty' | 'profit'>('revenue');
  const [staffSortBy, setStaffSortBy] = useState<'revenue' | 'bills' | 'profit'>('revenue');
  // Sales Report state
  const [reportOpen, setReportOpen] = useState(false);
  const [reportType, setReportType] = useState<'product' | 'staff'>('product');
  const [reportSearch, setReportSearch] = useState('');
  const [reportSelected, setReportSelected] = useState<string>('');
  const [reportPeriod, setReportPeriod] = useState<'7days' | '30days' | 'month' | 'all'>('30days');

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

  const { data: stock = [] } = useQuery({
    queryKey: ['stock'],
    queryFn: async () => {
      const { data, error } = await supabase.from('stock_items').select('*');
      if (error) throw error;
      return data;
    },
  });

  const { data: staffProfiles = [] } = useQuery({
    queryKey: ['staff-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*, user_roles(role)');
      if (error) throw error;
      return data.filter((p: any) => (p.user_roles as any[])?.some((r: any) => r.role === 'staff'));
    },
    enabled: isAdmin,
  });

  const getDateRange = () => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    switch (timePeriod) {
      case 'today': return { start: today, end: today };
      case '7days': { const d = new Date(now); d.setDate(d.getDate() - 7); return { start: d.toISOString().split('T')[0], end: today }; }
      case '30days': { const d = new Date(now); d.setDate(d.getDate() - 30); return { start: d.toISOString().split('T')[0], end: today }; }
      case 'month': { const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`; return { start, end: today }; }
      case 'custom': return dateFilter ? { start: dateFilter, end: dateFilter } : null;
      case 'all': return null;
    }
  };

  const getReportDateRange = () => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    switch (reportPeriod) {
      case '7days': { const d = new Date(now); d.setDate(d.getDate() - 7); return { start: d.toISOString().split('T')[0], end: today }; }
      case '30days': { const d = new Date(now); d.setDate(d.getDate() - 30); return { start: d.toISOString().split('T')[0], end: today }; }
      case 'month': { const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`; return { start, end: today }; }
      case 'all': return null;
    }
  };

  const analysis = useMemo(() => {
    let relevantBills = isAdmin ? bills : bills.filter(b => b.staff_id === user?.id);
    if (selectedStaffId !== 'all' && isAdmin) relevantBills = relevantBills.filter(b => b.staff_id === selectedStaffId);

    const range = getDateRange();
    if (range) {
      relevantBills = relevantBills.filter(b => {
        const d = b.created_at?.split('T')[0] || '';
        return d >= range.start && d <= range.end;
      });
    }

    const billIds = new Set(relevantBills.map(b => b.id));
    const relevantItems = billItems.filter(bi => billIds.has(bi.bill_id));

    const totalRevenue = relevantBills.reduce((s, b) => s + Number(b.total), 0);
    const totalSubtotal = relevantBills.reduce((s, b) => s + Number(b.subtotal), 0);
    const totalDiscount = relevantBills.reduce((s, b) => s + Number(b.discount), 0);
    const totalGst = relevantBills.reduce((s, b) => s + Number(b.gst_amount), 0);
    const totalCost = relevantItems.reduce((s, item) => {
      const si = stock.find(x => x.id === item.stock_id);
      return s + (Number(si?.buy_price) || 0) * item.quantity;
    }, 0);
    const profit = totalRevenue - totalCost;
    const avgBillValue = relevantBills.length ? totalRevenue / relevantBills.length : 0;
    const totalItemsSold = relevantItems.reduce((s, i) => s + i.quantity, 0);
    const cashBills = relevantBills.filter(b => b.payment_mode === 'cash');
    const onlineBills = relevantBills.filter(b => b.payment_mode === 'online');

    const dailyMap = new Map<string, { revenue: number; bills: number; profit: number; cost: number }>();
    relevantBills.forEach(b => {
      const date = b.created_at?.split('T')[0] || '';
      const existing = dailyMap.get(date) || { revenue: 0, bills: 0, profit: 0, cost: 0 };
      const billItemsForBill = relevantItems.filter(bi => bi.bill_id === b.id);
      const cost = billItemsForBill.reduce((s, item) => {
        const si = stock.find(x => x.id === item.stock_id);
        return s + (Number(si?.buy_price) || 0) * item.quantity;
      }, 0);
      dailyMap.set(date, { revenue: existing.revenue + Number(b.total), bills: existing.bills + 1, profit: existing.profit + (Number(b.total) - cost), cost: existing.cost + cost });
    });
    const dailyData = Array.from(dailyMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([date, data]) => ({ date: date.slice(5), fullDate: date, ...data }));

    const categoryMap = new Map<string, { qty: number; revenue: number; profit: number; cost: number }>();
    relevantItems.forEach(item => {
      const si = stock.find(x => x.id === item.stock_id);
      const cat = si?.category || 'Other';
      const existing = categoryMap.get(cat) || { qty: 0, revenue: 0, profit: 0, cost: 0 };
      const cost = (Number(si?.buy_price) || 0) * item.quantity;
      categoryMap.set(cat, { qty: existing.qty + item.quantity, revenue: existing.revenue + Number(item.total), profit: existing.profit + (Number(item.total) - cost), cost: existing.cost + cost });
    });
    const categoryData = Array.from(categoryMap.entries()).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.revenue - a.revenue);

    const productMap = new Map<string, { qty: number; revenue: number; profit: number; cost: number; buyPrice: number; sellPrice: number }>();
    relevantItems.forEach(item => {
      const si = stock.find(x => x.id === item.stock_id);
      const name = item.name;
      const existing = productMap.get(name) || { qty: 0, revenue: 0, profit: 0, cost: 0, buyPrice: 0, sellPrice: 0 };
      const cost = (Number(si?.buy_price) || 0) * item.quantity;
      productMap.set(name, { qty: existing.qty + item.quantity, revenue: existing.revenue + Number(item.total), profit: existing.profit + (Number(item.total) - cost), cost: existing.cost + cost, buyPrice: Number(si?.buy_price) || 0, sellPrice: Number(item.price) });
    });
    const productData = Array.from(productMap.entries()).map(([name, data]) => ({ name, ...data })).sort((a, b) => b[productSortBy] - a[productSortBy]);

    const staffBreakdown = isAdmin ? staffProfiles.map((s: any) => {
      const sBills = relevantBills.filter(b => b.staff_id === s.user_id);
      const sItems = billItems.filter(bi => sBills.some(b => b.id === bi.bill_id));
      const revenue = sBills.reduce((sum, b) => sum + Number(b.total), 0);
      const cost = sItems.reduce((sum, item) => { const si = stock.find(x => x.id === item.stock_id); return sum + (Number(si?.buy_price) || 0) * item.quantity; }, 0);
      const itemsSold = sItems.reduce((sum, i) => sum + i.quantity, 0);
      return { name: s.name, id: s.user_id, bills: sBills.length, revenue, profit: revenue - cost, cost, itemsSold };
    }).sort((a, b) => b[staffSortBy] - a[staffSortBy]) : [];

    return {
      totalRevenue, totalSubtotal, totalDiscount, totalGst, totalCost, profit, avgBillValue, totalItemsSold,
      totalBills: relevantBills.length,
      profitMargin: totalRevenue > 0 ? (profit / totalRevenue * 100) : 0,
      cashBills: cashBills.length, onlineBills: onlineBills.length,
      cashRevenue: cashBills.reduce((s, b) => s + Number(b.total), 0),
      onlineRevenue: onlineBills.reduce((s, b) => s + Number(b.total), 0),
      dailyData, categoryData, productData, staffBreakdown,
    };
  }, [bills, billItems, stock, user, isAdmin, timePeriod, dateFilter, selectedStaffId, staffProfiles, productSortBy, staffSortBy]);

  // Sales report data
  const salesReport = useMemo(() => {
    if (!reportSelected) return null;
    const range = getReportDateRange();
    let relevantBills = isAdmin ? bills : bills.filter(b => b.staff_id === user?.id);
    if (range) relevantBills = relevantBills.filter(b => { const d = b.created_at?.split('T')[0] || ''; return d >= range.start && d <= range.end; });

    if (reportType === 'product') {
      const billIds = new Set(relevantBills.map(b => b.id));
      const items = billItems.filter(bi => billIds.has(bi.bill_id) && bi.name === reportSelected);
      const si = stock.find(x => x.name === reportSelected);
      const dailyMap = new Map<string, { qty: number; revenue: number; cost: number; profit: number }>();
      items.forEach(item => {
        const bill = relevantBills.find(b => b.id === item.bill_id);
        const date = bill?.created_at?.split('T')[0] || '';
        const existing = dailyMap.get(date) || { qty: 0, revenue: 0, cost: 0, profit: 0 };
        const cost = (Number(si?.buy_price) || 0) * item.quantity;
        dailyMap.set(date, { qty: existing.qty + item.quantity, revenue: existing.revenue + Number(item.total), cost: existing.cost + cost, profit: existing.profit + Number(item.total) - cost });
      });
      const dailyData = Array.from(dailyMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([date, d]) => ({ date: date.slice(5), fullDate: date, ...d }));
      const totalQty = items.reduce((s, i) => s + i.quantity, 0);
      const totalRevenue = items.reduce((s, i) => s + Number(i.total), 0);
      const totalCost = (Number(si?.buy_price) || 0) * totalQty;
      return { name: reportSelected, dailyData, totalQty, totalRevenue, totalCost, totalProfit: totalRevenue - totalCost, buyPrice: Number(si?.buy_price) || 0, currentStock: si?.quantity || 0 };
    } else {
      const staffBills = relevantBills.filter(b => b.staff_id === reportSelected);
      const staffItemsList = billItems.filter(bi => staffBills.some(b => b.id === bi.bill_id));
      const dailyMap = new Map<string, { bills: number; revenue: number; cost: number; profit: number; items: number }>();
      staffBills.forEach(b => {
        const date = b.created_at?.split('T')[0] || '';
        const existing = dailyMap.get(date) || { bills: 0, revenue: 0, cost: 0, profit: 0, items: 0 };
        const bItems = staffItemsList.filter(bi => bi.bill_id === b.id);
        const cost = bItems.reduce((s, item) => { const si = stock.find(x => x.id === item.stock_id); return s + (Number(si?.buy_price) || 0) * item.quantity; }, 0);
        const itemCount = bItems.reduce((s, i) => s + i.quantity, 0);
        dailyMap.set(date, { bills: existing.bills + 1, revenue: existing.revenue + Number(b.total), cost: existing.cost + cost, profit: existing.profit + Number(b.total) - cost, items: existing.items + itemCount });
      });
      const dailyData = Array.from(dailyMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([date, d]) => ({ date: date.slice(5), fullDate: date, ...d }));
      const staffProfile = staffProfiles.find((s: any) => s.user_id === reportSelected);
      const totalRevenue = staffBills.reduce((s, b) => s + Number(b.total), 0);
      const totalCost = staffItemsList.reduce((s, item) => { const si = stock.find(x => x.id === item.stock_id); return s + (Number(si?.buy_price) || 0) * item.quantity; }, 0);
      return { name: staffProfile?.name || 'Unknown', dailyData, totalBills: staffBills.length, totalRevenue, totalCost, totalProfit: totalRevenue - totalCost, totalItems: staffItemsList.reduce((s, i) => s + i.quantity, 0) };
    }
  }, [reportSelected, reportType, reportPeriod, bills, billItems, stock, staffProfiles]);

  const productNames = useMemo(() => [...new Set(billItems.map(bi => bi.name))], [billItems]);
  const filteredReportOptions = reportType === 'product'
    ? productNames.filter(n => n.toLowerCase().includes(reportSearch.toLowerCase()))
    : staffProfiles.filter((s: any) => s.name.toLowerCase().includes(reportSearch.toLowerCase()));

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={timePeriod} onValueChange={(v) => setTimePeriod(v as TimePeriod)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="7days">Last 7 Days</SelectItem>
            <SelectItem value="30days">Last 30 Days</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="custom">Custom Date</SelectItem>
          </SelectContent>
        </Select>
        {timePeriod === 'custom' && (
          <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-auto" />
        )}
        {isAdmin && (
          <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
            <SelectTrigger className="w-48"><SelectValue placeholder="All Staff" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Staff</SelectItem>
              {staffProfiles.map((s: any) => (
                <SelectItem key={s.user_id} value={s.user_id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button variant="outline" onClick={() => { setReportOpen(true); setReportSelected(''); setReportSearch(''); }} className="ml-auto">
          <FileText className="w-4 h-4 mr-1" /> Sales Report
        </Button>
      </div>

      {/* Stats Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card"><div className="flex items-center gap-2 mb-1"><Receipt className="w-4 h-4 text-primary" /><span className="text-xs text-muted-foreground">Total Bills</span></div><p className="text-2xl font-bold">{analysis.totalBills}</p></div>
        <div className="stat-card"><div className="flex items-center gap-2 mb-1"><IndianRupee className="w-4 h-4 text-success" /><span className="text-xs text-muted-foreground">Revenue</span></div><p className="text-2xl font-bold">₹{analysis.totalRevenue.toLocaleString()}</p></div>
        {isAdmin && <div className="stat-card"><div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-primary" /><span className="text-xs text-muted-foreground">Profit</span></div><p className="text-2xl font-bold text-success">₹{analysis.profit.toLocaleString()}</p></div>}
        {isAdmin && <div className="stat-card"><div className="flex items-center gap-2 mb-1"><BarChart3 className="w-4 h-4 text-info" /><span className="text-xs text-muted-foreground">Total Cost</span></div><p className="text-2xl font-bold text-destructive">₹{analysis.totalCost.toLocaleString()}</p></div>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card"><p className="text-xs text-muted-foreground">Items Sold</p><p className="text-2xl font-bold">{analysis.totalItemsSold}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">Avg Bill Value</p><p className="text-2xl font-bold">₹{Math.round(analysis.avgBillValue).toLocaleString()}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">Discount Given</p><p className="text-2xl font-bold text-warning">₹{analysis.totalDiscount.toLocaleString()}</p></div>
        {isAdmin && <div className="stat-card"><p className="text-xs text-muted-foreground">Profit Margin</p><p className="text-2xl font-bold text-success">{analysis.profitMargin.toFixed(1)}%</p></div>}
      </div>

      {/* Revenue & Profit Chart */}
      {analysis.dailyData.length > 0 && (
        <div className="stat-card">
          <h3 className="font-semibold text-sm mb-4">Revenue & Profit Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={analysis.dailyData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} formatter={(v: number) => `₹${v.toLocaleString()}`} />
              <Legend />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorRevenue)" />
              {isAdmin && <Area type="monotone" dataKey="profit" name="Profit" stroke="hsl(var(--success))" fillOpacity={1} fill="url(#colorProfit)" />}
              {isAdmin && <Area type="monotone" dataKey="cost" name="Cost" stroke="hsl(var(--destructive))" fillOpacity={0} fill="transparent" strokeDasharray="5 5" />}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Category & Payment */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {analysis.categoryData.length > 0 && (
          <div className="stat-card">
            <h3 className="font-semibold text-sm mb-4">Category Sales</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={analysis.categoryData} dataKey="revenue" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(entry) => `${entry.name}: ₹${entry.revenue.toLocaleString()}`}>
                  {analysis.categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => `₹${v.toLocaleString()}`} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
            {isAdmin && (
              <div className="mt-3 space-y-1">
                {analysis.categoryData.map((c, i) => (
                  <div key={c.name} className="flex items-center justify-between text-xs p-1.5 bg-muted/50 rounded">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      <span>{c.name}</span>
                    </div>
                    <div className="flex gap-3">
                      <span>{c.qty} pcs</span>
                      <span className="text-success">Profit: ₹{c.profit.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="stat-card">
          <h3 className="font-semibold text-sm mb-3">Payment Mode</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <span className="text-sm">💵 Cash</span>
              <div className="text-right"><p className="font-bold">{analysis.cashBills} bills</p><p className="text-xs text-muted-foreground">₹{analysis.cashRevenue.toLocaleString()}</p></div>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <span className="text-sm">💳 Online</span>
              <div className="text-right"><p className="font-bold">{analysis.onlineBills} bills</p><p className="text-xs text-muted-foreground">₹{analysis.onlineRevenue.toLocaleString()}</p></div>
            </div>
            {analysis.totalBills > 0 && (
              <div className="mt-2">
                <div className="h-3 rounded-full bg-muted overflow-hidden flex">
                  <div className="bg-success h-full transition-all" style={{ width: `${(analysis.cashBills / analysis.totalBills) * 100}%` }} />
                  <div className="bg-info h-full transition-all" style={{ width: `${(analysis.onlineBills / analysis.totalBills) * 100}%` }} />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Cash {analysis.totalBills ? Math.round((analysis.cashBills / analysis.totalBills) * 100) : 0}%</span>
                  <span>Online {analysis.totalBills ? Math.round((analysis.onlineBills / analysis.totalBills) * 100) : 0}%</span>
                </div>
              </div>
            )}
          </div>

          {analysis.totalGst > 0 && (
            <div className="mt-4 pt-3 border-t border-border">
              <h4 className="text-xs font-semibold text-muted-foreground mb-2">TAX SUMMARY</h4>
              <div className="flex justify-between text-sm"><span>Subtotal</span><span>₹{analysis.totalSubtotal.toLocaleString()}</span></div>
              <div className="flex justify-between text-sm"><span>GST Collected</span><span className="text-primary">₹{analysis.totalGst.toLocaleString()}</span></div>
            </div>
          )}
        </div>
      </div>

      {/* Product Sales Top Sellers */}
      {analysis.productData.length > 0 && (
        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">🏆 Top Sellers</h3>
            <Select value={productSortBy} onValueChange={(v) => setProductSortBy(v as any)}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="revenue">By Revenue</SelectItem>
                <SelectItem value="qty">By Quantity</SelectItem>
                {isAdmin && <SelectItem value="profit">By Profit</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            {analysis.productData.slice(0, 3).map((p, i) => (
              <div key={p.name} className={`rounded-xl p-4 border ${i === 0 ? 'bg-warning/5 border-warning/30' : i === 1 ? 'bg-muted/50 border-border' : 'bg-muted/30 border-border'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                  <p className="text-sm font-bold truncate">{p.name}</p>
                </div>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Qty Sold</span><span className="font-bold">{p.qty}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Revenue</span><span className="font-bold text-primary">₹{p.revenue.toLocaleString()}</span></div>
                  {isAdmin && (
                    <>
                      <div className="flex justify-between"><span className="text-muted-foreground">Cost</span><span className="text-destructive">₹{p.cost.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Profit</span><span className="text-success font-bold">₹{p.profit.toLocaleString()}</span></div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-border bg-muted/30">
                <th className="text-left px-3 py-2 font-medium">#</th>
                <th className="text-left px-3 py-2 font-medium">Product</th>
                <th className="text-right px-3 py-2 font-medium">Qty</th>
                {isAdmin && <th className="text-right px-3 py-2 font-medium">Buy ₹</th>}
                <th className="text-right px-3 py-2 font-medium">Sell ₹</th>
                <th className="text-right px-3 py-2 font-medium">Revenue</th>
                {isAdmin && <th className="text-right px-3 py-2 font-medium">Cost</th>}
                {isAdmin && <th className="text-right px-3 py-2 font-medium">Profit</th>}
              </tr></thead>
              <tbody>
                {analysis.productData.map((p, i) => (
                  <tr key={p.name} className="border-b border-border/30 last:border-0">
                    <td className="px-3 py-2 font-bold text-primary">{i + 1}</td>
                    <td className="px-3 py-2 font-medium">{p.name}</td>
                    <td className="px-3 py-2 text-right">{p.qty}</td>
                    {isAdmin && <td className="px-3 py-2 text-right text-muted-foreground">₹{p.buyPrice}</td>}
                    <td className="px-3 py-2 text-right">₹{p.sellPrice}</td>
                    <td className="px-3 py-2 text-right font-bold">₹{p.revenue.toLocaleString()}</td>
                    {isAdmin && <td className="px-3 py-2 text-right text-destructive">₹{p.cost.toLocaleString()}</td>}
                    {isAdmin && <td className="px-3 py-2 text-right text-success font-bold">₹{p.profit.toLocaleString()}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Staff Ranking */}
      {isAdmin && analysis.staffBreakdown.length > 0 && (
        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm flex items-center gap-2"><Users className="w-4 h-4" /> Staff Sales Ranking</h3>
            <Select value={staffSortBy} onValueChange={(v) => setStaffSortBy(v as any)}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="revenue">By Revenue</SelectItem>
                <SelectItem value="bills">By Bills</SelectItem>
                <SelectItem value="profit">By Profit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            {analysis.staffBreakdown.map((s, i) => (
              <div key={s.name} className={`flex items-center gap-4 p-3 rounded-lg ${i === 0 ? 'bg-warning/5 border border-warning/20' : 'bg-muted/50'}`}>
                <span className="text-lg font-bold text-primary w-8">#{i + 1}</span>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.bills} bills · {s.itemsSold} items sold</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">₹{s.revenue.toLocaleString()}</p>
                  <div className="flex gap-2 text-xs">
                    <span className="text-destructive">Cost: ₹{s.cost.toLocaleString()}</span>
                    <span className="text-success">Profit: ₹{s.profit.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sales Report Dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="w-5 h-5" /> Sales Report</DialogTitle>
            <DialogDescription>Generate detailed sales report for a product or staff member</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-3">
              <Select value={reportType} onValueChange={(v) => { setReportType(v as any); setReportSelected(''); setReportSearch(''); }}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="product">Product</SelectItem>
                  {isAdmin && <SelectItem value="staff">Staff</SelectItem>}
                </SelectContent>
              </Select>
              <Select value={reportPeriod} onValueChange={(v) => setReportPeriod(v as any)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7days">Last 7 Days</SelectItem>
                  <SelectItem value="30days">Last 30 Days</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder={`Search ${reportType}...`} value={reportSearch} onChange={e => setReportSearch(e.target.value)} className="pl-10" />
            </div>

            {!reportSelected && (
              <div className="max-h-48 overflow-y-auto border border-border rounded-lg">
                {reportType === 'product' ? (
                  (filteredReportOptions as string[]).map(name => (
                    <button key={name} onClick={() => setReportSelected(name)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted border-b border-border/30 last:border-0">{name}</button>
                  ))
                ) : (
                  (filteredReportOptions as any[]).map((s: any) => (
                    <button key={s.user_id} onClick={() => setReportSelected(s.user_id)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted border-b border-border/30 last:border-0">{s.name}</button>
                  ))
                )}
                {filteredReportOptions.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No results found</p>}
              </div>
            )}

            {salesReport && (
              <div className="space-y-4 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg">{salesReport.name}</h3>
                  <Button variant="ghost" size="sm" onClick={() => setReportSelected('')}>Change</Button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {reportType === 'product' ? (
                    <>
                      <div className="stat-card !p-3"><p className="text-xs text-muted-foreground">Qty Sold</p><p className="text-xl font-bold">{(salesReport as any).totalQty}</p></div>
                      <div className="stat-card !p-3"><p className="text-xs text-muted-foreground">Revenue</p><p className="text-xl font-bold text-primary">₹{(salesReport as any).totalRevenue.toLocaleString()}</p></div>
                      {isAdmin && <div className="stat-card !p-3"><p className="text-xs text-muted-foreground">Cost</p><p className="text-xl font-bold text-destructive">₹{(salesReport as any).totalCost.toLocaleString()}</p></div>}
                      {isAdmin && <div className="stat-card !p-3"><p className="text-xs text-muted-foreground">Profit</p><p className="text-xl font-bold text-success">₹{(salesReport as any).totalProfit.toLocaleString()}</p></div>}
                    </>
                  ) : (
                    <>
                      <div className="stat-card !p-3"><p className="text-xs text-muted-foreground">Bills</p><p className="text-xl font-bold">{(salesReport as any).totalBills}</p></div>
                      <div className="stat-card !p-3"><p className="text-xs text-muted-foreground">Revenue</p><p className="text-xl font-bold text-primary">₹{(salesReport as any).totalRevenue.toLocaleString()}</p></div>
                      {isAdmin && <div className="stat-card !p-3"><p className="text-xs text-muted-foreground">Cost</p><p className="text-xl font-bold text-destructive">₹{(salesReport as any).totalCost.toLocaleString()}</p></div>}
                      {isAdmin && <div className="stat-card !p-3"><p className="text-xs text-muted-foreground">Profit</p><p className="text-xl font-bold text-success">₹{(salesReport as any).totalProfit.toLocaleString()}</p></div>}
                    </>
                  )}
                </div>

                {isAdmin && reportType === 'product' && (
                  <div className="flex gap-4 text-xs bg-muted/50 rounded-lg p-3">
                    <span>Buy Price: <strong>₹{(salesReport as any).buyPrice}</strong></span>
                    <span>Current Stock: <strong>{(salesReport as any).currentStock}</strong></span>
                  </div>
                )}

                {salesReport.dailyData.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Daily Breakdown</h4>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={salesReport.dailyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                        <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }} formatter={(v: number) => `₹${v.toLocaleString()}`} />
                        <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Revenue" />
                        {isAdmin && <Bar dataKey="profit" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} name="Profit" />}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <div className="bg-card rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-3 py-2">Date</th>
                      {reportType === 'product' ? (
                        <><th className="text-right px-3 py-2">Qty</th></>
                      ) : (
                        <><th className="text-right px-3 py-2">Bills</th><th className="text-right px-3 py-2">Items</th></>
                      )}
                      <th className="text-right px-3 py-2">Revenue</th>
                      {isAdmin && <th className="text-right px-3 py-2">Cost</th>}
                      {isAdmin && <th className="text-right px-3 py-2">Profit</th>}
                    </tr></thead>
                    <tbody>
                      {salesReport.dailyData.map((d: any) => (
                        <tr key={d.fullDate} className="border-b border-border/30 last:border-0">
                          <td className="px-3 py-2">{d.fullDate}</td>
                          {reportType === 'product' ? (
                            <td className="px-3 py-2 text-right">{d.qty}</td>
                          ) : (
                            <><td className="px-3 py-2 text-right">{d.bills}</td><td className="px-3 py-2 text-right">{d.items}</td></>
                          )}
                          <td className="px-3 py-2 text-right font-bold">₹{d.revenue.toLocaleString()}</td>
                          {isAdmin && <td className="px-3 py-2 text-right text-destructive">₹{d.cost.toLocaleString()}</td>}
                          {isAdmin && <td className="px-3 py-2 text-right text-success font-bold">₹{d.profit.toLocaleString()}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AnalysisPage;
