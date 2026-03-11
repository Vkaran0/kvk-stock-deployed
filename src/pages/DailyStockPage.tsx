import { useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ArrowUpDown, TrendingUp, Package, IndianRupee } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type SortKey = 'name' | 'sold' | 'opening' | 'closing' | 'revenue' | 'profit';

const DailyStockPage = () => {
  const { user, isAdmin } = useAuth();
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortKey>('sold');
  const [sortAsc, setSortAsc] = useState(false);

  const { data: stock = [] } = useQuery({
    queryKey: ['stock'],
    queryFn: async () => {
      const { data, error } = await supabase.from('stock_items').select('*');
      if (error) throw error;
      return data;
    },
  });

  const { data: bills = [] } = useQuery({
    queryKey: ['bills'],
    queryFn: async () => {
      const { data, error } = await supabase.from('bills').select('*');
      if (error) throw error;
      return data;
    },
  });

  const { data: billItems = [] } = useQuery({
    queryKey: ['all-bill-items'],
    queryFn: async () => {
      const { data, error } = await supabase.from('bill_items').select('*');
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

  const computeData = (filterStaffId?: string) => {
    let dayBills = bills.filter(b => b.created_at?.startsWith(dateFilter));
    if (filterStaffId) dayBills = dayBills.filter(b => b.staff_id === filterStaffId);
    const dayBillIds = new Set(dayBills.map(b => b.id));
    const dayItems = billItems.filter(bi => dayBillIds.has(bi.bill_id));

    const totalSold = dayItems.reduce((s, i) => s + i.quantity, 0);
    const totalRevenue = dayBills.reduce((s, b) => s + Number(b.total), 0);
    const totalDiscount = dayBills.reduce((s, b) => s + Number(b.discount), 0);
    const totalGst = dayBills.reduce((s, b) => s + Number(b.gst_amount), 0);
    const totalCost = dayItems.reduce((s, item) => {
      const si = stock.find(x => x.id === item.stock_id);
      return s + (Number(si?.buy_price) || 0) * item.quantity;
    }, 0);
    const currentTotal = stock.reduce((s, i) => s + i.quantity, 0);

    const productBreakdown = stock.map(s => {
      const sold = dayItems.filter(bi => bi.stock_id === s.id).reduce((sum, bi) => sum + bi.quantity, 0);
      const revenue = dayItems.filter(bi => bi.stock_id === s.id).reduce((sum, bi) => sum + Number(bi.total), 0);
      const cost = sold * Number(s.buy_price);
      return {
        id: s.id, name: s.name, item_code: s.item_code, category: s.category,
        buyPrice: Number(s.buy_price), sellPrice: Number(s.sell_price),
        sold, closing: s.quantity, opening: s.quantity + sold,
        revenue, cost, profit: revenue - cost,
      };
    }).filter(p => p.sold > 0);

    // Sort
    productBreakdown.sort((a: any, b: any) => {
      const aVal = a[sortBy] ?? 0;
      const bVal = b[sortBy] ?? 0;
      if (typeof aVal === 'string') return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      return sortAsc ? aVal - bVal : bVal - aVal;
    });

    return {
      totalBills: dayBills.length, totalSold, totalRevenue, totalDiscount, totalGst,
      totalCost, totalProfit: totalRevenue - totalCost,
      openingStock: currentTotal + totalSold, closingStock: currentTotal,
      productBreakdown,
    };
  };

  const dailyData = useMemo(() => computeData(), [bills, billItems, stock, dateFilter, sortBy, sortAsc]);
  const staffDailyData = useMemo(() => (selectedStaffId !== 'all' ? computeData(selectedStaffId) : null), [bills, billItems, stock, dateFilter, selectedStaffId, sortBy, sortAsc]);
  const myDailyData = useMemo(() => (!isAdmin && user ? computeData(user.id) : null), [bills, billItems, stock, dateFilter, user, isAdmin, sortBy, sortAsc]);

  const staffName = staffProfiles.find((s: any) => s.user_id === selectedStaffId)?.name;

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortAsc(!sortAsc);
    else { setSortBy(key); setSortAsc(false); }
  };

  const SortHeader = ({ label, sortKey }: { label: string; sortKey: SortKey }) => (
    <th onClick={() => toggleSort(sortKey)} className="text-right px-4 py-2.5 font-medium cursor-pointer hover:text-primary select-none">
      <span className="inline-flex items-center gap-1">{label} <ArrowUpDown className="w-3 h-3" /></span>
    </th>
  );

  const renderStockTable = (data: any[], showCost = false) => (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-muted/30">
            <th onClick={() => toggleSort('name')} className="text-left px-4 py-2.5 font-medium cursor-pointer hover:text-primary">
              <span className="inline-flex items-center gap-1">Product <ArrowUpDown className="w-3 h-3" /></span>
            </th>
            <th className="text-left px-4 py-2.5 font-medium">Code</th>
            <SortHeader label="Opening" sortKey="opening" />
            <SortHeader label="Sold" sortKey="sold" />
            <SortHeader label="Closing" sortKey="closing" />
            {showCost && <th className="text-right px-4 py-2.5 font-medium">Buy ₹</th>}
            <th className="text-right px-4 py-2.5 font-medium">Sell ₹</th>
            <SortHeader label="Revenue" sortKey="revenue" />
            {showCost && <SortHeader label="Cost" sortKey="profit" />}
            {showCost && <SortHeader label="Profit" sortKey="profit" />}
          </tr></thead>
          <tbody>
            {data.map((p: any) => (
              <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                <td className="px-4 py-2.5 font-medium">{p.name}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{p.item_code}</td>
                <td className="px-4 py-2.5 text-right">{p.opening}</td>
                <td className="px-4 py-2.5 text-right text-destructive font-bold">-{p.sold}</td>
                <td className="px-4 py-2.5 text-right font-bold">{p.closing}</td>
                {showCost && <td className="px-4 py-2.5 text-right text-muted-foreground">₹{p.buyPrice}</td>}
                <td className="px-4 py-2.5 text-right">₹{p.sellPrice}</td>
                <td className="px-4 py-2.5 text-right font-bold text-primary">₹{p.revenue.toLocaleString()}</td>
                {showCost && <td className="px-4 py-2.5 text-right text-destructive">₹{p.cost.toLocaleString()}</td>}
                {showCost && <td className="px-4 py-2.5 text-right text-success font-bold">₹{p.profit.toLocaleString()}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.length === 0 && <div className="text-center py-8 text-muted-foreground text-sm">No sales on this date</div>}
    </div>
  );

  const StatCards = ({ data, showCost = false }: { data: any; showCost?: boolean }) => (
    <div className={`grid grid-cols-2 ${showCost ? 'md:grid-cols-4 lg:grid-cols-6' : 'md:grid-cols-4'} gap-3`}>
      <div className="stat-card"><p className="text-xs text-muted-foreground">Opening Stock</p><p className="text-xl font-bold">{data.openingStock ?? '-'}</p></div>
      <div className="stat-card"><p className="text-xs text-muted-foreground">Items Sold</p><p className="text-xl font-bold text-destructive">-{data.totalSold}</p></div>
      <div className="stat-card"><p className="text-xs text-muted-foreground">Closing Stock</p><p className="text-xl font-bold">{data.closingStock ?? '-'}</p></div>
      <div className="stat-card"><p className="text-xs text-muted-foreground">Bills</p><p className="text-xl font-bold">{data.totalBills}</p></div>
      <div className="stat-card"><p className="text-xs text-muted-foreground">Revenue</p><p className="text-xl font-bold text-primary">₹{data.totalRevenue.toLocaleString()}</p></div>
      {showCost && <div className="stat-card"><p className="text-xs text-muted-foreground">Cost</p><p className="text-xl font-bold text-destructive">₹{data.totalCost.toLocaleString()}</p></div>}
      {showCost && <div className="stat-card"><p className="text-xs text-muted-foreground">Profit</p><p className="text-xl font-bold text-success">₹{data.totalProfit.toLocaleString()}</p></div>}
      {data.totalDiscount > 0 && <div className="stat-card"><p className="text-xs text-muted-foreground">Discount</p><p className="text-xl font-bold text-warning">₹{data.totalDiscount.toLocaleString()}</p></div>}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <CalendarDays className="w-4 h-4 text-muted-foreground" />
        <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-auto" />
      </div>

      {isAdmin ? (
        <Tabs defaultValue="overall">
          <TabsList>
            <TabsTrigger value="overall">Overall</TabsTrigger>
            <TabsTrigger value="staff">Staff Wise</TabsTrigger>
          </TabsList>

          <TabsContent value="overall" className="space-y-4">
            <StatCards data={dailyData} showCost />
            <h3 className="font-semibold text-sm">Product-wise Breakdown</h3>
            {renderStockTable(dailyData.productBreakdown, true)}
          </TabsContent>

          <TabsContent value="staff" className="space-y-4">
            <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
              <SelectTrigger className="w-64"><SelectValue placeholder="Select Staff" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Select a staff member</SelectItem>
                {staffProfiles.map((s: any) => (
                  <SelectItem key={s.user_id} value={s.user_id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {staffDailyData && selectedStaffId !== 'all' && (
              <>
                <StatCards data={{ ...staffDailyData, openingStock: undefined, closingStock: undefined }} showCost />
                <h3 className="font-semibold text-sm">Products Sold by {staffName}</h3>
                {renderStockTable(staffDailyData.productBreakdown, true)}
              </>
            )}
          </TabsContent>
        </Tabs>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="stat-card"><p className="text-xs text-muted-foreground">My Bills Today</p><p className="text-2xl font-bold">{myDailyData?.totalBills || 0}</p></div>
            <div className="stat-card"><p className="text-xs text-muted-foreground">Items Sold</p><p className="text-2xl font-bold">{myDailyData?.totalSold || 0}</p></div>
            <div className="stat-card"><p className="text-xs text-muted-foreground">Revenue</p><p className="text-2xl font-bold text-primary">₹{(myDailyData?.totalRevenue || 0).toLocaleString()}</p></div>
          </div>
          {myDailyData && myDailyData.productBreakdown.length > 0 && (
            <>
              <h3 className="font-semibold text-sm">Products I Sold</h3>
              {renderStockTable(myDailyData.productBreakdown, false)}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default DailyStockPage;
