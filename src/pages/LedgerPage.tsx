import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Search, Download, CheckCircle, Clock, IndianRupee, Users, FileText, Banknote, CreditCard, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { exportToCSV, exportToPDF, dataToHTMLTable } from '@/lib/exportUtils';

const LedgerPage = () => {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'partial' | 'paid'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedUdhari, setSelectedUdhari] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'online'>('cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  // Fetch udhari records
  const { data: udhariList = [], isLoading } = useQuery({
    queryKey: ['udhari', isAdmin, user?.id],
    queryFn: async () => {
      let query = supabase.from('udhari').select('*').order('created_at', { ascending: false });
      if (!isAdmin && user) {
        query = query.eq('staff_id', user.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch payments for selected udhari
  const { data: payments = [] } = useQuery({
    queryKey: ['udhari-payments', selectedUdhari],
    queryFn: async () => {
      if (!selectedUdhari) return [];
      const { data, error } = await supabase
        .from('udhari_payments')
        .select('*')
        .eq('udhari_id', selectedUdhari)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedUdhari,
  });

  // Fetch profiles for staff filter
  const { data: staffList = [] } = useQuery({
    queryKey: ['profiles-all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, name');
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  const [staffFilter, setStaffFilter] = useState('all');

  // Record payment mutation
  const payMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUdhari || paymentAmount <= 0) throw new Error('Invalid payment');
      const udhari = udhariList.find(u => u.id === selectedUdhari);
      if (!udhari) throw new Error('Udhari not found');

      const newPaid = Number(udhari.paid_amount) + paymentAmount;
      const newRemaining = Number(udhari.total_amount) - newPaid;
      const newStatus = newRemaining <= 0 ? 'paid' : 'partial';

      // Insert payment record
      const { error: payError } = await supabase.from('udhari_payments').insert({
        udhari_id: selectedUdhari,
        amount: paymentAmount,
        payment_mode: paymentMode,
        notes: paymentNotes,
        received_by: user?.id,
        received_by_name: '',
      });
      if (payError) throw payError;

      // Update udhari record
      const { error: updateError } = await supabase.from('udhari').update({
        paid_amount: newPaid,
        remaining_amount: Math.max(0, newRemaining),
        status: newStatus,
        updated_at: new Date().toISOString(),
      }).eq('id', selectedUdhari);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['udhari'] });
      queryClient.invalidateQueries({ queryKey: ['udhari-payments', selectedUdhari] });
      setShowPayDialog(false);
      setPaymentAmount(0);
      setPaymentNotes('');
      toast.success('Payment recorded successfully!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Filter & search
  const filtered = useMemo(() => {
    let list = udhariList;
    if (statusFilter !== 'all') list = list.filter(u => u.status === statusFilter);
    if (staffFilter !== 'all' && isAdmin) list = list.filter(u => u.staff_id === staffFilter);
    if (dateFrom) list = list.filter(u => u.created_at && u.created_at >= dateFrom);
    if (dateTo) list = list.filter(u => u.created_at && u.created_at <= dateTo + 'T23:59:59');
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(u =>
        u.customer_name.toLowerCase().includes(s) ||
        u.customer_phone?.toLowerCase().includes(s) ||
        u.bill_number.toLowerCase().includes(s)
      );
    }
    return list;
  }, [udhariList, statusFilter, staffFilter, dateFrom, dateTo, search, isAdmin]);

  // Summary stats
  const totalUdhari = useMemo(() => filtered.reduce((s, u) => s + Number(u.remaining_amount), 0), [filtered]);
  const totalCollected = useMemo(() => filtered.reduce((s, u) => s + Number(u.paid_amount), 0), [filtered]);
  const pendingCount = filtered.filter(u => u.status === 'pending' || u.status === 'partial').length;
  const paidCount = filtered.filter(u => u.status === 'paid').length;

  // Customer-wise grouping
  const customerSummary = useMemo(() => {
    const map = new Map<string, { name: string; phone: string; totalCredit: number; totalPaid: number; remaining: number; count: number }>();
    filtered.forEach(u => {
      const key = u.customer_phone || u.customer_name;
      const existing = map.get(key) || { name: u.customer_name, phone: u.customer_phone || '', totalCredit: 0, totalPaid: 0, remaining: 0, count: 0 };
      existing.totalCredit += Number(u.total_amount);
      existing.totalPaid += Number(u.paid_amount);
      existing.remaining += Number(u.remaining_amount);
      existing.count += 1;
      map.set(key, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.remaining - a.remaining);
  }, [filtered]);

  const selectedUdhariData = udhariList.find(u => u.id === selectedUdhari);

  const handleExportCSV = () => {
    exportToCSV(filtered.map(u => ({
      'Bill Number': u.bill_number,
      'Customer': u.customer_name,
      'Phone': u.customer_phone,
      'Total Amount': u.total_amount,
      'Paid': u.paid_amount,
      'Remaining': u.remaining_amount,
      'Status': u.status,
      'Staff': u.staff_name,
      'Date': u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN') : '',
    })), 'udhari_ledger');
  };

  const handleExportPDF = () => {
    const columns = [
      { key: 'bill_number', label: 'Bill #' },
      { key: 'customer_name', label: 'Customer' },
      { key: 'total_amount', label: 'Total' },
      { key: 'paid_amount', label: 'Paid' },
      { key: 'remaining_amount', label: 'Remaining' },
      { key: 'status', label: 'Status' },
      { key: 'date', label: 'Date' },
    ];
    const rows = filtered.map(u => ({
      ...u,
      total_amount: `₹${Number(u.total_amount).toLocaleString()}`,
      paid_amount: `₹${Number(u.paid_amount).toLocaleString()}`,
      remaining_amount: `₹${Number(u.remaining_amount).toLocaleString()}`,
      date: u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN') : '',
    }));
    exportToPDF('Ledger Report', dataToHTMLTable(rows, columns));
  };

  const openPayDialog = (udhariId: string) => {
    setSelectedUdhari(udhariId);
    const u = udhariList.find(x => x.id === udhariId);
    setPaymentAmount(u ? Number(u.remaining_amount) : 0);
    setShowPayDialog(true);
  };

  const openDetailDialog = (udhariId: string) => {
    setSelectedUdhari(udhariId);
    setShowDetailDialog(true);
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'paid': return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">Paid</Badge>;
      case 'partial': return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0">Partial</Badge>;
      default: return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0">Pending</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <IndianRupee className="w-4 h-4" />
            <span className="text-xs font-medium">Total Pending</span>
          </div>
          <p className="text-2xl font-bold text-destructive">₹{totalUdhari.toLocaleString()}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <CheckCircle className="w-4 h-4" />
            <span className="text-xs font-medium">Collected</span>
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">₹{totalCollected.toLocaleString()}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-medium">Pending</span>
          </div>
          <p className="text-2xl font-bold">{pendingCount}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <FileText className="w-4 h-4" />
            <span className="text-xs font-medium">Cleared</span>
          </div>
          <p className="text-2xl font-bold">{paidCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search customer, phone, bill..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', 'pending', 'partial', 'paid'].map(s => (
            <Button key={s} size="sm" variant={statusFilter === s ? 'default' : 'outline'} onClick={() => setStatusFilter(s as any)} className="capitalize">
              {s}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36" />
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36" />
        </div>
        {isAdmin && (
          <select value={staffFilter} onChange={e => setStaffFilter(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
            <option value="all">All Staff</option>
            {staffList.map((s: any) => <option key={s.user_id} value={s.user_id}>{s.name}</option>)}
          </select>
        )}
      </div>

      {/* Export buttons */}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={handleExportCSV}>
          <Download className="w-4 h-4 mr-1" /> Export CSV
        </Button>
        <Button size="sm" variant="outline" onClick={handleExportPDF}>
          <Download className="w-4 h-4 mr-1" /> Export PDF
        </Button>
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">All Entries</TabsTrigger>
          <TabsTrigger value="customers">Customer Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No udhari records found</div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Bill #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead>Status</TableHead>
                    {isAdmin && <TableHead>Staff</TableHead>}
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(u => (
                    <TableRow key={u.id}>
                      <TableCell className="text-xs">{u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN') : '-'}</TableCell>
                      <TableCell className="font-mono text-xs">{u.bill_number}</TableCell>
                      <TableCell className="font-medium">{u.customer_name}</TableCell>
                      <TableCell className="text-xs">{u.customer_phone || '-'}</TableCell>
                      <TableCell className="text-right font-medium">₹{Number(u.total_amount).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-emerald-600 dark:text-emerald-400">₹{Number(u.paid_amount).toLocaleString()}</TableCell>
                      <TableCell className="text-right font-bold text-destructive">₹{Number(u.remaining_amount).toLocaleString()}</TableCell>
                      <TableCell>{statusBadge(u.status)}</TableCell>
                      {isAdmin && <TableCell className="text-xs">{u.staff_name}</TableCell>}
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openDetailDialog(u.id)} title="View Details">
                            <Eye className="w-4 h-4" />
                          </Button>
                          {isAdmin && u.status !== 'paid' && (
                            <Button size="sm" variant="outline" onClick={() => openPayDialog(u.id)} className="text-xs">
                              <CheckCircle className="w-3 h-3 mr-1" /> Pay
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="customers">
          {customerSummary.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No customer data</div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-center">Invoices</TableHead>
                    <TableHead className="text-right">Total Credit</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customerSummary.map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-xs">{c.phone || '-'}</TableCell>
                      <TableCell className="text-center">{c.count}</TableCell>
                      <TableCell className="text-right">₹{c.totalCredit.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-emerald-600 dark:text-emerald-400">₹{c.totalPaid.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-bold text-destructive">₹{c.remaining.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Payment Dialog (Admin only) */}
      <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              {selectedUdhariData && (
                <span>
                  {selectedUdhariData.customer_name} — Bill: {selectedUdhariData.bill_number} — 
                  Remaining: ₹{Number(selectedUdhariData.remaining_amount).toLocaleString()}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Payment Amount (₹)</Label>
              <Input type="number" value={paymentAmount} onChange={e => setPaymentAmount(+e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Payment Mode</Label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setPaymentMode('cash')} className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${paymentMode === 'cash' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                  <Banknote className="w-4 h-4" /> Cash
                </button>
                <button onClick={() => setPaymentMode('online')} className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${paymentMode === 'online' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                  <CreditCard className="w-4 h-4" /> Online
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Input value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} placeholder="Payment reference etc." />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowPayDialog(false)} className="flex-1">Cancel</Button>
              <Button onClick={() => payMutation.mutate()} className="flex-1" disabled={payMutation.isPending || paymentAmount <= 0}>
                {payMutation.isPending ? 'Processing...' : 'Record Payment'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Udhari Details</DialogTitle>
            <DialogDescription>Complete payment history</DialogDescription>
          </DialogHeader>
          {selectedUdhariData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Customer:</span> <strong>{selectedUdhariData.customer_name}</strong></div>
                <div><span className="text-muted-foreground">Phone:</span> <strong>{selectedUdhariData.customer_phone || '-'}</strong></div>
                <div><span className="text-muted-foreground">Bill:</span> <strong className="font-mono">{selectedUdhariData.bill_number}</strong></div>
                <div><span className="text-muted-foreground">Date:</span> <strong>{selectedUdhariData.created_at ? new Date(selectedUdhariData.created_at).toLocaleDateString('en-IN') : '-'}</strong></div>
                <div><span className="text-muted-foreground">Staff:</span> <strong>{selectedUdhariData.staff_name || '-'}</strong></div>
                <div><span className="text-muted-foreground">Status:</span> {statusBadge(selectedUdhariData.status)}</div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-lg font-bold">₹{Number(selectedUdhariData.total_amount).toLocaleString()}</p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Paid</p>
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">₹{Number(selectedUdhariData.paid_amount).toLocaleString()}</p>
                </div>
                <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Remaining</p>
                  <p className="text-lg font-bold text-destructive">₹{Number(selectedUdhariData.remaining_amount).toLocaleString()}</p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Payment History</h4>
                {payments.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No payments recorded yet</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {payments.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between bg-muted/50 rounded-lg p-2.5 text-sm">
                        <div>
                          <p className="font-medium">₹{Number(p.amount).toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.created_at ? new Date(p.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '-'}
                            {' · '}{p.payment_mode}
                          </p>
                          {p.notes && <p className="text-xs text-muted-foreground mt-0.5">{p.notes}</p>}
                        </div>
                        <Badge variant="outline" className="capitalize">{p.payment_mode}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {isAdmin && selectedUdhariData.status !== 'paid' && (
                <Button onClick={() => { setShowDetailDialog(false); openPayDialog(selectedUdhariData.id); }} className="w-full">
                  <CheckCircle className="w-4 h-4 mr-1" /> Record Payment
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LedgerPage;
