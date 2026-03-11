import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Search, Receipt, Eye, Printer, Copy, Download } from 'lucide-react';
import { toast } from 'sonner';
import { exportToCSV } from '@/lib/exportUtils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useShopSettings } from '@/hooks/useShopSettings';

const BillsPage = () => {
  const { user, isAdmin } = useAuth();
  const { settings: shop } = useShopSettings();
  const [search, setSearch] = useState('');
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest' | 'lowest'>('newest');
  const [dateFilter, setDateFilter] = useState('');
  const [billViewType, setBillViewType] = useState<'customer' | 'admin'>('customer');

  const { data: bills = [], isLoading } = useQuery({
    queryKey: ['bills'],
    queryFn: async () => {
      let query = supabase.from('bills').select('*').order('created_at', { ascending: false });
      if (!isAdmin) query = query.eq('staff_id', user?.id);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: selectedBillItems = [] } = useQuery({
    queryKey: ['bill-items', selectedBillId],
    queryFn: async () => {
      if (!selectedBillId) return [];
      const { data, error } = await supabase.from('bill_items').select('*').eq('bill_id', selectedBillId);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedBillId,
  });

  const { data: stock = [] } = useQuery({
    queryKey: ['stock-all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('stock_items').select('*');
      if (error) throw error;
      return data;
    },
  });

  const selectedBill = bills.find(b => b.id === selectedBillId);

  const filtered = useMemo(() => {
    let result = bills;
    if (search) {
      result = result.filter(b =>
        b.bill_number.toLowerCase().includes(search.toLowerCase()) ||
        b.customer_name.toLowerCase().includes(search.toLowerCase()) ||
        (b.staff_name || '').toLowerCase().includes(search.toLowerCase())
      );
    }
    if (dateFilter) {
      result = result.filter(b => b.created_at?.startsWith(dateFilter));
    }
    switch (sortBy) {
      case 'newest': result = [...result].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')); break;
      case 'oldest': result = [...result].sort((a, b) => (a.created_at || '').localeCompare(b.created_at || '')); break;
      case 'highest': result = [...result].sort((a, b) => Number(b.total) - Number(a.total)); break;
      case 'lowest': result = [...result].sort((a, b) => Number(a.total) - Number(b.total)); break;
    }
    return result;
  }, [bills, search, sortBy, dateFilter]);

  const getBuyPrice = (stockId: string | null) => {
    if (!stockId) return 0;
    return Number(stock.find(s => s.id === stockId)?.buy_price || 0);
  };

  const printBill = (viewType: 'customer' | 'admin') => {
    if (!selectedBill) return;
    const isAdminCopy = viewType === 'admin' && isAdmin;
    const totalCost = selectedBillItems.reduce((s, i) => s + getBuyPrice(i.stock_id) * i.quantity, 0);
    const netProfit = Number(selectedBill.total) - totalCost;

    const w = window.open('', '_blank', 'width=600,height=800');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Bill ${selectedBill.bill_number}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Space Grotesk',system-ui,sans-serif;padding:20px;max-width:500px;margin:0 auto;color:#1a1a1a}
.header{text-align:center;border-bottom:2px solid #1a1a1a;padding-bottom:12px;margin-bottom:12px}
.header h1{font-size:24px;font-weight:700}
.header p{font-size:11px;color:#666}
.admin-badge{background:#ff6b35;color:#fff;font-size:10px;padding:2px 8px;border-radius:4px;display:inline-block;margin-top:4px}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:11px;border-bottom:1px solid #ddd;padding-bottom:10px;margin-bottom:10px}
.info-grid .label{color:#666}
.customer{border-bottom:1px solid #ddd;padding-bottom:10px;margin-bottom:10px;font-size:12px}
.customer .name{font-weight:700;font-size:14px}
table{width:100%;border-collapse:collapse;font-size:11px;margin:10px 0}
th{border-bottom:2px solid #333;padding:6px 4px;text-align:left;font-weight:600}
td{border-bottom:1px solid #eee;padding:5px 4px}
.text-right{text-align:right}
.totals{border-top:2px solid #333;padding-top:10px;margin-top:10px}
.totals .row{display:flex;justify-content:space-between;font-size:12px;padding:3px 0}
.totals .total-row{font-size:18px;font-weight:700;border-top:2px solid #333;padding-top:8px;margin-top:4px}
.profit-row{color:#2d9e8a;font-weight:700}
.cost-row{color:#666}
.footer{text-align:center;border-top:1px solid #ddd;padding-top:12px;margin-top:16px;font-size:11px;color:#666}
@media print{body{padding:10px}}
</style></head><body>
<div class="header">
  <h1>${shop.shop_name}</h1>
  <p>${shop.address} | ${shop.phone}${shop.email ? ' | ' + shop.email : ''}</p>
  <p>GSTIN: ${shop.gst_number}</p>
  ${isAdminCopy ? '<div class="admin-badge">⚡ ADMIN COPY - COST DETAILS</div>' : ''}
</div>
<div class="info-grid">
  <div><span class="label">Bill No:</span><br/><strong>${selectedBill.bill_number}</strong></div>
  <div style="text-align:right"><span class="label">Date:</span><br/><strong>${selectedBill.created_at ? new Date(selectedBill.created_at).toLocaleString() : ''}</strong></div>
  <div><span class="label">Staff:</span><br/>${selectedBill.staff_name || ''}</div>
  <div style="text-align:right"><span class="label">Payment:</span><br/><strong>${(selectedBill.payment_mode || '').toUpperCase()}</strong></div>
</div>
<div class="customer">
  <span class="label" style="color:#666;font-size:10px">BILL TO:</span>
  <div class="name">${selectedBill.customer_name}</div>
  ${selectedBill.customer_phone ? `<div>Phone: ${selectedBill.customer_phone}</div>` : ''}
  ${selectedBill.customer_address ? `<div>Address: ${selectedBill.customer_address}</div>` : ''}
  ${selectedBill.customer_gst ? `<div>GST: ${selectedBill.customer_gst}</div>` : ''}
</div>
<table>
  <thead><tr>
    <th>#</th><th>Item</th><th class="text-right">Qty</th>
    ${isAdminCopy ? '<th class="text-right">Buy ₹</th>' : ''}
    <th class="text-right">Price</th><th class="text-right">Total</th>
    ${isAdminCopy ? '<th class="text-right">Profit</th>' : ''}
  </tr></thead>
  <tbody>
    ${selectedBillItems.map((item, i) => {
      const buyP = getBuyPrice(item.stock_id);
      const itemProfit = Number(item.total) - buyP * item.quantity;
      return `<tr>
        <td>${i + 1}</td><td>${item.name}</td><td class="text-right">${item.quantity}</td>
        ${isAdminCopy ? `<td class="text-right" style="color:#666">₹${buyP}</td>` : ''}
        <td class="text-right">₹${Number(item.price)}</td><td class="text-right"><strong>₹${Number(item.total)}</strong></td>
        ${isAdminCopy ? `<td class="text-right" style="color:#2d9e8a">₹${itemProfit}</td>` : ''}
      </tr>`;
    }).join('')}
  </tbody>
</table>
<div class="totals">
  <div class="row"><span>Subtotal</span><span>₹${Number(selectedBill.subtotal).toLocaleString()}</span></div>
  ${Number(selectedBill.discount) > 0 ? `<div class="row"><span>Discount</span><span style="color:red">-₹${Number(selectedBill.discount)}</span></div>` : ''}
  ${Number(selectedBill.gst_amount) > 0 ? `<div class="row"><span>GST</span><span>+₹${Number(selectedBill.gst_amount).toFixed(2)}</span></div>` : ''}
  <div class="row total-row"><span>Total</span><span>₹${Number(selectedBill.total).toLocaleString()}</span></div>
  ${isAdminCopy ? `<div class="row cost-row"><span>Total Cost</span><span>₹${totalCost.toLocaleString()}</span></div><div class="row profit-row"><span>Net Profit</span><span>₹${netProfit.toLocaleString()}</span></div>` : ''}
</div>
${selectedBill.notes ? `<div style="font-size:11px;color:#666;margin-top:10px;border-top:1px solid #ddd;padding-top:8px"><strong>Notes:</strong> ${selectedBill.notes}</div>` : ''}
<div class="footer">
  <p>Thank you for your purchase!</p>
  <p style="margin-top:4px;font-size:10px">This is a computer generated invoice</p>
</div>
</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 500);
  };

  if (isLoading) return <div className="flex justify-center py-16"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by bill no, customer, staff..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-auto" />
        {dateFilter && <button onClick={() => setDateFilter('')} className="text-xs text-primary hover:underline">Clear</button>}
        <Button variant="outline" size="sm" onClick={() => {
          exportToCSV(filtered.map(b => ({
            BillNo: b.bill_number, Customer: b.customer_name, Phone: b.customer_phone, Total: b.total, Discount: b.discount, GST: b.gst_amount, Payment: b.payment_mode, Staff: b.staff_name, Date: b.created_at?.split('T')[0]
          })), 'bills_report');
          toast.success('Bills report exported!');
        }}>
          <Download className="w-4 h-4 mr-1" /> Export
        </Button>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
            <SelectItem value="highest">Highest Amount</SelectItem>
            <SelectItem value="lowest">Lowest Amount</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="text-xs text-muted-foreground">{filtered.length} bills found</div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-3 font-medium">Bill #</th>
              <th className="text-left px-4 py-3 font-medium">Customer</th>
              <th className="text-left px-4 py-3 font-medium">Staff</th>
              <th className="text-right px-4 py-3 font-medium">Total</th>
              <th className="text-center px-4 py-3 font-medium">Payment</th>
              <th className="text-left px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3"></th>
            </tr></thead>
            <tbody>
              {filtered.map(bill => (
                <tr key={bill.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs">{bill.bill_number}</td>
                  <td className="px-4 py-3">{bill.customer_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{bill.staff_name}</td>
                  <td className="px-4 py-3 text-right font-bold">₹{Number(bill.total).toLocaleString()}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${bill.payment_mode === 'cash' ? 'bg-success/10 text-success' : 'bg-info/10 text-info'}`}>
                      {bill.payment_mode}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{bill.created_at ? new Date(bill.created_at).toLocaleString() : ''}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => setSelectedBillId(bill.id)} className="p-1 rounded hover:bg-muted"><Eye className="w-4 h-4 text-muted-foreground" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Receipt className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>No bills found</p>
          </div>
        )}
      </div>

      <Dialog open={!!selectedBill} onOpenChange={() => setSelectedBillId(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bill Details</DialogTitle>
            <DialogDescription>View and print the bill</DialogDescription>
          </DialogHeader>
          {selectedBill && (
            <div className="space-y-4 text-sm">
              {isAdmin && (
                <Tabs value={billViewType} onValueChange={(v) => setBillViewType(v as any)}>
                  <TabsList className="w-full">
                    <TabsTrigger value="customer" className="flex-1"><Copy className="w-3 h-3 mr-1" /> Customer Copy</TabsTrigger>
                    <TabsTrigger value="admin" className="flex-1"><Eye className="w-3 h-3 mr-1" /> Admin Copy</TabsTrigger>
                  </TabsList>
                </Tabs>
              )}

              <div className="border border-border rounded-xl p-4 space-y-3">
                <div className="text-center border-b border-border pb-3">
                  <h3 className="font-display font-bold text-xl">{shop.shop_name}</h3>
                  <p className="text-xs text-muted-foreground">{shop.address} | {shop.phone}</p>
                  <p className="text-xs text-muted-foreground">GSTIN: {shop.gst_number}</p>
                  {billViewType === 'admin' && isAdmin && (
                    <p className="text-xs font-bold text-primary mt-1">⚡ ADMIN COPY - WITH COST DETAILS</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs border-b border-border pb-3">
                  <div>
                    <p className="font-mono font-bold">{selectedBill.bill_number}</p>
                    <p className="text-muted-foreground">{selectedBill.created_at ? new Date(selectedBill.created_at).toLocaleString() : ''}</p>
                  </div>
                  <div className="text-right">
                    <p>Staff: {selectedBill.staff_name}</p>
                    <p>Payment: <span className="font-bold uppercase">{selectedBill.payment_mode}</span></p>
                  </div>
                </div>

                <div className="border-b border-border pb-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">BILL TO:</p>
                  <p className="font-bold">{selectedBill.customer_name}</p>
                  {selectedBill.customer_phone && <p>Phone: {selectedBill.customer_phone}</p>}
                  {selectedBill.customer_address && <p>Address: {selectedBill.customer_address}</p>}
                  {selectedBill.customer_gst && <p>GST: {selectedBill.customer_gst}</p>}
                </div>

                <table className="w-full text-xs">
                  <thead><tr className="border-b border-border">
                    <th className="text-left py-1.5 font-semibold">#</th>
                    <th className="text-left py-1.5 font-semibold">Item</th>
                    <th className="text-right py-1.5 font-semibold">Qty</th>
                    {billViewType === 'admin' && isAdmin && <th className="text-right py-1.5 font-semibold">Buy ₹</th>}
                    <th className="text-right py-1.5 font-semibold">Price</th>
                    <th className="text-right py-1.5 font-semibold">Total</th>
                    {billViewType === 'admin' && isAdmin && <th className="text-right py-1.5 font-semibold">Profit</th>}
                  </tr></thead>
                  <tbody>
                    {selectedBillItems.map((item, i) => {
                      const buyP = getBuyPrice(item.stock_id);
                      const itemProfit = Number(item.total) - buyP * item.quantity;
                      return (
                        <tr key={item.id} className="border-b border-border/30">
                          <td className="py-1.5">{i + 1}</td>
                          <td className="py-1.5">{item.name}</td>
                          <td className="py-1.5 text-right">{item.quantity}</td>
                          {billViewType === 'admin' && isAdmin && <td className="py-1.5 text-right text-muted-foreground">₹{buyP}</td>}
                          <td className="py-1.5 text-right">₹{Number(item.price)}</td>
                          <td className="py-1.5 text-right font-medium">₹{Number(item.total)}</td>
                          {billViewType === 'admin' && isAdmin && <td className="py-1.5 text-right text-success">₹{itemProfit.toLocaleString()}</td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="border-t border-border pt-2 space-y-1">
                  <div className="flex justify-between text-xs"><span>Subtotal</span><span>₹{Number(selectedBill.subtotal).toLocaleString()}</span></div>
                  {Number(selectedBill.discount) > 0 && <div className="flex justify-between text-xs"><span>Discount</span><span className="text-destructive">-₹{Number(selectedBill.discount)}</span></div>}
                  {Number(selectedBill.gst_amount) > 0 && <div className="flex justify-between text-xs"><span>GST</span><span>+₹{Number(selectedBill.gst_amount).toFixed(2)}</span></div>}
                  <div className="flex justify-between text-base font-bold pt-1 border-t border-border"><span>Total</span><span className="text-primary">₹{Number(selectedBill.total).toLocaleString()}</span></div>
                  {billViewType === 'admin' && isAdmin && (
                    <div className="space-y-1 pt-2 border-t border-border">
                      <div className="flex justify-between text-xs text-muted-foreground"><span>Total Cost</span><span>₹{selectedBillItems.reduce((s, i) => s + getBuyPrice(i.stock_id) * i.quantity, 0).toLocaleString()}</span></div>
                      <div className="flex justify-between text-xs text-success font-bold"><span>Net Profit</span><span>₹{(Number(selectedBill.total) - selectedBillItems.reduce((s, i) => s + getBuyPrice(i.stock_id) * i.quantity, 0)).toLocaleString()}</span></div>
                    </div>
                  )}
                </div>

                {selectedBill.notes && (
                  <div className="text-xs text-muted-foreground border-t border-border pt-2"><strong>Notes:</strong> {selectedBill.notes}</div>
                )}

                <div className="text-center border-t border-border pt-3 text-xs text-muted-foreground">
                  <p>Thank you for your purchase!</p>
                  <p className="mt-1 text-[10px]">This is a computer generated invoice</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => printBill('customer')}>
                  <Printer className="w-4 h-4 mr-1" /> Print Customer Copy
                </Button>
                {isAdmin && (
                  <Button variant="outline" className="flex-1" onClick={() => printBill('admin')}>
                    <Printer className="w-4 h-4 mr-1" /> Print Admin Copy
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BillsPage;
