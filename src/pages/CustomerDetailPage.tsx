import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft, Phone, MapPin, Mail, Edit2, Save, X, Receipt,
  TrendingUp, IndianRupee, ShoppingCart, Package, Bell, Plus,
  Calendar, MessageSquare, CheckCircle, Clock, Trash2, ExternalLink,
  Download, User, Banknote
} from 'lucide-react';
import { toast } from 'sonner';
import { exportToCSV, exportToPDF, dataToHTMLTable } from '@/lib/exportUtils';

const CustomerDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin, profile } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({ name: '', phone: '', address: '', email: '', gst_number: '', notes: '' });
  const [showReminderDialog, setShowReminderDialog] = useState(false);
  const [reminderForm, setReminderForm] = useState({ title: 'Follow up', message: '', frequency: 'weekly', next_reminder_date: '' });
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [selectedUdhari, setSelectedUdhari] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'online'>('cash');
  const [paymentNotes, setPaymentNotes] = useState('');

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('customers').select('*').eq('id', id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: bills = [] } = useQuery({
    queryKey: ['customer-bills', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('bills').select('*').eq('customer_id', id!).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const billIds = bills.map(b => b.id);
  const { data: allBillItems = [] } = useQuery({
    queryKey: ['customer-bill-items', billIds],
    queryFn: async () => {
      if (billIds.length === 0) return [];
      const { data, error } = await supabase.from('bill_items').select('*').in('bill_id', billIds);
      if (error) throw error;
      return data;
    },
    enabled: billIds.length > 0,
  });

  const { data: udhariList = [] } = useQuery({
    queryKey: ['customer-udhari', customer?.name, customer?.phone],
    queryFn: async () => {
      if (!customer) return [];
      let query = supabase.from('udhari').select('*').eq('customer_name', customer.name);
      if (customer.phone) query = query.eq('customer_phone', customer.phone);
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!customer,
  });

  const { data: udhariPayments = [] } = useQuery({
    queryKey: ['customer-udhari-payments', selectedUdhari],
    queryFn: async () => {
      if (!selectedUdhari) return [];
      const { data, error } = await supabase.from('udhari_payments').select('*').eq('udhari_id', selectedUdhari).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedUdhari,
  });

  const { data: reminders = [] } = useQuery({
    queryKey: ['customer-reminders', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('customer_reminders').select('*').eq('customer_id', id!).order('next_reminder_date');
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: async (d: typeof editData) => {
      const { error } = await supabase.from('customers').update({
        name: d.name, phone: d.phone, address: d.address,
        email: d.email, gst_number: d.gst_number, notes: d.notes,
        updated_at: new Date().toISOString(),
      }).eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      setEditing(false);
      toast.success('Customer updated!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addReminderMutation = useMutation({
    mutationFn: async () => {
      const nextDate = reminderForm.next_reminder_date || new Date().toISOString().split('T')[0];
      const { error } = await supabase.from('customer_reminders').insert({
        customer_id: id!,
        title: reminderForm.title,
        message: reminderForm.message,
        frequency: reminderForm.frequency,
        next_reminder_date: nextDate,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-reminders', id] });
      setShowReminderDialog(false);
      setReminderForm({ title: 'Follow up', message: '', frequency: 'weekly', next_reminder_date: '' });
      toast.success('Reminder added!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteReminderMutation = useMutation({
    mutationFn: async (remId: string) => {
      const { error } = await supabase.from('customer_reminders').delete().eq('id', remId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-reminders', id] });
      toast.success('Reminder deleted');
    },
  });

  const payMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUdhari || paymentAmount <= 0) throw new Error('Invalid payment');
      const udhari = udhariList.find(u => u.id === selectedUdhari);
      if (!udhari) throw new Error('Not found');
      const newPaid = Number(udhari.paid_amount) + paymentAmount;
      const newRemaining = Number(udhari.total_amount) - newPaid;
      const newStatus = newRemaining <= 0 ? 'paid' : 'partial';

      const { error: payErr } = await supabase.from('udhari_payments').insert({
        udhari_id: selectedUdhari,
        amount: paymentAmount,
        payment_mode: paymentMode,
        notes: paymentNotes,
        received_by: user?.id,
        received_by_name: profile?.name || '',
      });
      if (payErr) throw payErr;

      const { error: upErr } = await supabase.from('udhari').update({
        paid_amount: newPaid,
        remaining_amount: Math.max(0, newRemaining),
        status: newStatus,
      }).eq('id', selectedUdhari);
      if (upErr) throw upErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-udhari'] });
      queryClient.invalidateQueries({ queryKey: ['customer-udhari-payments', selectedUdhari] });
      setShowPayDialog(false);
      setPaymentAmount(0);
      setPaymentNotes('');
      toast.success('Payment recorded!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const productAnalysis = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; total: number }>();
    allBillItems.forEach(item => {
      const key = item.name;
      const existing = map.get(key) || { name: item.name, qty: 0, total: 0 };
      existing.qty += item.quantity;
      existing.total += Number(item.total);
      map.set(key, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty);
  }, [allBillItems]);

  const udhariSummary = useMemo(() => {
    const totalCredit = udhariList.reduce((s, u) => s + Number(u.total_amount), 0);
    const totalPaid = udhariList.reduce((s, u) => s + Number(u.paid_amount), 0);
    const remaining = udhariList.reduce((s, u) => s + Number(u.remaining_amount), 0);
    return { totalCredit, totalPaid, remaining, count: udhariList.length };
  }, [udhariList]);

  const monthlySpending = useMemo(() => {
    const map = new Map<string, number>();
    bills.forEach(b => {
      const month = b.created_at ? new Date(b.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short' }) : 'Unknown';
      map.set(month, (map.get(month) || 0) + Number(b.total));
    });
    return Array.from(map.entries()).slice(0, 6);
  }, [bills]);

  const startEdit = () => {
    if (!customer) return;
    setEditData({
      name: customer.name, phone: customer.phone || '', address: customer.address || '',
      email: customer.email || '', gst_number: customer.gst_number || '', notes: customer.notes || '',
    });
    setEditing(true);
  };

  const openPayDialog = (udhariId: string) => {
    setSelectedUdhari(udhariId);
    setPaymentAmount(0);
    setPaymentNotes('');
    setShowPayDialog(true);
  };

  const todayReminders = reminders.filter(r => r.is_active && r.next_reminder_date <= new Date().toISOString().split('T')[0]);

  const handleExportBills = () => {
    exportToCSV(bills.map(b => ({
      Date: b.created_at ? new Date(b.created_at).toLocaleDateString('en-IN') : '-',
      'Bill #': b.bill_number, Total: b.total, Payment: b.payment_mode, Staff: b.staff_name,
    })), `${customer?.name}_bills`);
  };

  const handleExportLedger = () => {
    exportToCSV(udhariList.map(u => ({
      Date: u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN') : '-',
      'Bill #': u.bill_number, Total: u.total_amount, Paid: u.paid_amount, Remaining: u.remaining_amount, Status: u.status,
    })), `${customer?.name}_ledger`);
  };

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Loading...</div>;
  if (!customer) return <div className="text-center py-12 text-muted-foreground">Customer not found</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/customers')}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
      </div>

      {/* Profile Card */}
      <div className="stat-card">
        <div className="flex flex-col md:flex-row md:items-start gap-4">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-bold text-3xl flex-shrink-0 border-2 border-primary/20">
            {customer.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div><Label className="text-xs">Name</Label><Input value={editData.name} onChange={e => setEditData(d => ({ ...d, name: e.target.value }))} /></div>
                  <div><Label className="text-xs">Phone</Label><Input value={editData.phone} onChange={e => setEditData(d => ({ ...d, phone: e.target.value }))} /></div>
                  <div><Label className="text-xs">Email</Label><Input value={editData.email} onChange={e => setEditData(d => ({ ...d, email: e.target.value }))} /></div>
                  <div><Label className="text-xs">GST</Label><Input value={editData.gst_number} onChange={e => setEditData(d => ({ ...d, gst_number: e.target.value }))} /></div>
                </div>
                <div><Label className="text-xs">Address</Label><Textarea value={editData.address} onChange={e => setEditData(d => ({ ...d, address: e.target.value }))} rows={2} /></div>
                <div><Label className="text-xs">Notes</Label><Textarea value={editData.notes} onChange={e => setEditData(d => ({ ...d, notes: e.target.value }))} rows={2} /></div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => updateMutation.mutate(editData)} disabled={updateMutation.isPending}>
                    <Save className="w-3 h-3 mr-1" /> Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                    <X className="w-3 h-3 mr-1" /> Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-display font-bold">{customer.name}</h2>
                  {customer.gst_number && <Badge variant="outline" className="text-[10px]">GST: {customer.gst_number}</Badge>}
                  <Button variant="ghost" size="sm" onClick={startEdit} className="h-7">
                    <Edit2 className="w-3 h-3" />
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                  {customer.phone && (
                    <a href={`tel:${customer.phone}`} className="flex items-center gap-1 hover:text-primary transition-colors">
                      <Phone className="w-3.5 h-3.5" /> {customer.phone}
                    </a>
                  )}
                  {customer.email && (
                    <a href={`mailto:${customer.email}`} className="flex items-center gap-1 hover:text-primary transition-colors">
                      <Mail className="w-3.5 h-3.5" /> {customer.email}
                    </a>
                  )}
                  {customer.address && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> {customer.address}
                    </span>
                  )}
                </div>

                {customer.primary_staff_name && (
                  <div className="flex items-center gap-1 mt-2">
                    <User className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Staff: </span>
                    <span className="text-xs font-semibold">{customer.primary_staff_name}</span>
                  </div>
                )}
                {customer.notes && <p className="text-xs text-muted-foreground mt-1 italic bg-muted/50 rounded-lg px-3 py-1.5">"{customer.notes}"</p>}

                {/* Quick actions */}
                <div className="flex gap-2 mt-3 flex-wrap">
                  {customer.phone && (
                    <>
                      <a href={`tel:${customer.phone}`} className="inline-flex">
                        <Button size="sm" className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white">
                          <Phone className="w-3 h-3 mr-1" /> Call
                        </Button>
                      </a>
                      <a href={`sms:${customer.phone}`} className="inline-flex">
                        <Button size="sm" variant="outline" className="text-xs h-8">
                          <MessageSquare className="w-3 h-3 mr-1" /> SMS
                        </Button>
                      </a>
                      <a href={`https://wa.me/91${customer.phone.replace(/[^0-9]/g, '')}`} target="_blank" className="inline-flex">
                        <Button size="sm" className="text-xs h-8 bg-green-600 hover:bg-green-700 text-white">
                          <ExternalLink className="w-3 h-3 mr-1" /> WhatsApp
                        </Button>
                      </a>
                    </>
                  )}
                  <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => setShowReminderDialog(true)}>
                    <Bell className="w-3 h-3 mr-1" /> Set Reminder
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4 pt-4 border-t border-border/50">
          <div className="bg-muted/50 rounded-xl p-3 text-center">
            <ShoppingCart className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-lg font-bold">{Number(customer.total_purchases || 0)}</p>
            <p className="text-[10px] text-muted-foreground">Total Orders</p>
          </div>
          <div className="bg-muted/50 rounded-xl p-3 text-center">
            <IndianRupee className="w-4 h-4 mx-auto text-primary mb-1" />
            <p className="text-lg font-bold text-primary">₹{Number(customer.total_spent || 0).toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">Total Spent</p>
          </div>
          <div className="bg-muted/50 rounded-xl p-3 text-center">
            <TrendingUp className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-lg font-bold">₹{bills.length > 0 ? Math.round(Number(customer.total_spent || 0) / bills.length).toLocaleString() : 0}</p>
            <p className="text-[10px] text-muted-foreground">Avg Order</p>
          </div>
          <div className="bg-muted/50 rounded-xl p-3 text-center">
            <Clock className="w-4 h-4 mx-auto text-destructive mb-1" />
            <p className="text-lg font-bold text-destructive">₹{udhariSummary.remaining.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">Pending</p>
          </div>
          <div className="bg-muted/50 rounded-xl p-3 text-center">
            <Bell className="w-4 h-4 mx-auto text-amber-500 mb-1" />
            <p className="text-lg font-bold">{todayReminders.length}</p>
            <p className="text-[10px] text-muted-foreground">Due Reminders</p>
          </div>
        </div>
      </div>

      {/* Alert for due reminders */}
      {todayReminders.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2">
            <Bell className="w-4 h-4" /> Reminders Due
          </h4>
          <div className="mt-2 space-y-1">
            {todayReminders.map(r => (
              <p key={r.id} className="text-xs text-amber-700 dark:text-amber-400">• {r.title}: {r.message || 'Follow up with customer'}</p>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="bills">
        <TabsList className="flex-wrap">
          <TabsTrigger value="bills" className="text-xs">
            <Receipt className="w-3.5 h-3.5 mr-1" /> Bills ({bills.length})
          </TabsTrigger>
          <TabsTrigger value="analysis" className="text-xs">
            <TrendingUp className="w-3.5 h-3.5 mr-1" /> Analysis
          </TabsTrigger>
          <TabsTrigger value="ledger" className="text-xs">
            <Banknote className="w-3.5 h-3.5 mr-1" /> Ledger ({udhariList.length})
          </TabsTrigger>
          <TabsTrigger value="reminders" className="text-xs">
            <Bell className="w-3.5 h-3.5 mr-1" /> Reminders ({reminders.length})
          </TabsTrigger>
        </TabsList>

        {/* Bills Tab */}
        <TabsContent value="bills">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold">Bill History</h3>
            {bills.length > 0 && (
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={handleExportBills}>
                <Download className="w-3 h-3 mr-1" /> Export
              </Button>
            )}
          </div>
          {bills.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Receipt className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No bills yet</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Bill #</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead className="text-right">Discount</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Staff</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bills.map(b => {
                    const itemCount = allBillItems.filter(i => i.bill_id === b.id).length;
                    return (
                      <TableRow key={b.id}>
                        <TableCell className="text-xs">{b.created_at ? new Date(b.created_at).toLocaleDateString('en-IN') : '-'}</TableCell>
                        <TableCell className="font-mono text-xs font-medium">{b.bill_number}</TableCell>
                        <TableCell className="text-xs">{itemCount} items</TableCell>
                        <TableCell className="text-right text-xs">{Number(b.discount) > 0 ? `₹${Number(b.discount).toLocaleString()}` : '-'}</TableCell>
                        <TableCell className="text-right font-bold text-primary">₹{Number(b.total).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] capitalize">{b.payment_mode}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">{b.staff_name || '-'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Analysis Tab */}
        <TabsContent value="analysis">
          {productAnalysis.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No purchase data yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="stat-card">
                  <p className="text-xs text-muted-foreground mb-1">Avg Order Value</p>
                  <p className="text-xl font-bold text-primary">
                    ₹{bills.length > 0 ? Math.round(Number(customer.total_spent || 0) / bills.length).toLocaleString() : 0}
                  </p>
                </div>
                <div className="stat-card">
                  <p className="text-xs text-muted-foreground mb-1">Most Bought</p>
                  <p className="text-lg font-bold truncate">{productAnalysis[0]?.name || '-'}</p>
                  <p className="text-xs text-muted-foreground">{productAnalysis[0]?.qty || 0} times</p>
                </div>
                <div className="stat-card">
                  <p className="text-xs text-muted-foreground mb-1">Unique Products</p>
                  <p className="text-xl font-bold">{productAnalysis.length}</p>
                </div>
                <div className="stat-card">
                  <p className="text-xs text-muted-foreground mb-1">Last Purchase</p>
                  <p className="text-sm font-bold">
                    {customer.last_purchase_date ? new Date(customer.last_purchase_date).toLocaleDateString('en-IN') : '-'}
                  </p>
                </div>
              </div>

              {/* Monthly spending */}
              {monthlySpending.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Monthly Spending</h3>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                    {monthlySpending.map(([month, amount]) => (
                      <div key={month} className="stat-card text-center">
                        <p className="text-[10px] text-muted-foreground">{month}</p>
                        <p className="text-sm font-bold text-primary">₹{amount.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Product table */}
              <div>
                <h3 className="text-sm font-semibold mb-2">Product-wise Breakdown</h3>
                <div className="rounded-xl border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Qty Bought</TableHead>
                        <TableHead className="text-right">Total Spent</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productAnalysis.slice(0, 20).map((p, i) => (
                        <TableRow key={p.name}>
                          <TableCell className="font-bold text-xs">{i + 1}</TableCell>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell className="text-right">{p.qty}</TableCell>
                          <TableCell className="text-right font-bold text-primary">₹{p.total.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Ledger Tab */}
        <TabsContent value="ledger">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold">Ledger</h3>
            {udhariList.length > 0 && (
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={handleExportLedger}>
                <Download className="w-3 h-3 mr-1" /> Export
              </Button>
            )}
          </div>

          {/* Ledger summary */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="stat-card border-l-4 border-l-primary">
              <p className="text-xs text-muted-foreground">Total Credit</p>
              <p className="text-lg font-bold">₹{udhariSummary.totalCredit.toLocaleString()}</p>
            </div>
            <div className="stat-card border-l-4 border-l-emerald-500">
              <p className="text-xs text-muted-foreground">Collected</p>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">₹{udhariSummary.totalPaid.toLocaleString()}</p>
            </div>
            <div className="stat-card border-l-4 border-l-destructive">
              <p className="text-xs text-muted-foreground">Outstanding</p>
              <p className="text-lg font-bold text-destructive">₹{udhariSummary.remaining.toLocaleString()}</p>
            </div>
          </div>

          {udhariList.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Banknote className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No ledger records</p>
            </div>
          ) : (
            <div className="space-y-3">
              {udhariList.map(u => {
                const progress = Number(u.total_amount) > 0 ? (Number(u.paid_amount) / Number(u.total_amount)) * 100 : 0;
                return (
                  <div key={u.id} className="stat-card">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-medium">{u.bill_number}</span>
                          <Badge className={
                            u.status === 'paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 text-[10px]' :
                            u.status === 'partial' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0 text-[10px]' :
                            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0 text-[10px]'
                          }>{u.status}</Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                          {u.staff_name && ` • Staff: ${u.staff_name}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">₹{Number(u.total_amount).toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Paid: <span className="text-emerald-600">₹{Number(u.paid_amount).toLocaleString()}</span> | 
                          Due: <span className="text-destructive font-semibold">₹{Number(u.remaining_amount).toLocaleString()}</span>
                        </p>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full bg-muted rounded-full h-1.5 mt-2">
                      <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.min(100, progress)}%` }} />
                    </div>
                    {/* Action buttons */}
                    <div className="flex gap-2 mt-2">
                      {isAdmin && u.status !== 'paid' && (
                        <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => openPayDialog(u.id)}>
                          <Banknote className="w-3 h-3 mr-1" /> Record Payment
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setSelectedUdhari(u.id)}>
                        History
                      </Button>
                    </div>

                    {/* Payment history inline */}
                    {selectedUdhari === u.id && udhariPayments.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <p className="text-[10px] font-semibold text-muted-foreground mb-2">PAYMENT HISTORY</p>
                        {udhariPayments.map(p => (
                          <div key={p.id} className="flex items-center justify-between py-1.5 text-xs border-b border-border/30 last:border-0">
                            <div>
                              <span className="text-muted-foreground">{p.created_at ? new Date(p.created_at).toLocaleDateString('en-IN') : '-'}</span>
                              <Badge variant="outline" className="text-[9px] ml-2 capitalize">{p.payment_mode}</Badge>
                              {p.notes && <span className="text-muted-foreground/60 ml-2">• {p.notes}</span>}
                            </div>
                            <span className="font-bold text-emerald-600">+₹{Number(p.amount).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Reminders Tab */}
        <TabsContent value="reminders">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Follow-up Reminders</h3>
            <Button size="sm" onClick={() => setShowReminderDialog(true)}>
              <Plus className="w-3 h-3 mr-1" /> Add Reminder
            </Button>
          </div>

          {reminders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No reminders set</p>
              <p className="text-xs mt-1">Set weekly/daily reminders to follow up</p>
            </div>
          ) : (
            <div className="space-y-2">
              {reminders.map(r => {
                const isOverdue = r.is_active && r.next_reminder_date < new Date().toISOString().split('T')[0];
                const isDueToday = r.is_active && r.next_reminder_date === new Date().toISOString().split('T')[0];
                return (
                  <div key={r.id} className={`stat-card flex items-center gap-3 ${isOverdue ? 'border-destructive/50 bg-destructive/5' : isDueToday ? 'border-amber-400/50 bg-amber-50/50 dark:bg-amber-900/10' : ''}`}>
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isOverdue ? 'bg-destructive/10 text-destructive' :
                      isDueToday ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      <Bell className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{r.title}</p>
                      {r.message && <p className="text-xs text-muted-foreground">{r.message}</p>}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {new Date(r.next_reminder_date).toLocaleDateString('en-IN')}
                        </span>
                        <Badge variant="outline" className="text-[10px] capitalize">{r.frequency}</Badge>
                        {isOverdue && <Badge className="bg-destructive/10 text-destructive border-0 text-[10px]">Overdue</Badge>}
                        {isDueToday && <Badge className="bg-amber-100 text-amber-700 border-0 text-[10px]">Due Today</Badge>}
                      </div>
                    </div>
                    {isAdmin && (
                      <Button variant="ghost" size="sm" onClick={() => deleteReminderMutation.mutate(r.id)} className="text-destructive/60 hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Reminder Dialog */}
      <Dialog open={showReminderDialog} onOpenChange={setShowReminderDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Reminder</DialogTitle>
            <DialogDescription>Set a follow-up reminder for {customer.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Title</Label><Input value={reminderForm.title} onChange={e => setReminderForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div><Label className="text-xs">Message</Label><Textarea value={reminderForm.message} onChange={e => setReminderForm(f => ({ ...f, message: e.target.value }))} rows={2} placeholder="e.g., Remind about new screen guards" /></div>
            <div><Label className="text-xs">Reminder Date</Label><Input type="date" value={reminderForm.next_reminder_date || new Date().toISOString().split('T')[0]} onChange={e => setReminderForm(f => ({ ...f, next_reminder_date: e.target.value }))} /></div>
            <div>
              <Label className="text-xs">Frequency</Label>
              <Select value={reminderForm.frequency} onValueChange={v => setReminderForm(f => ({ ...f, frequency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly (Default)</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="once">Once</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => addReminderMutation.mutate()} disabled={addReminderMutation.isPending} className="w-full">
              <Bell className="w-4 h-4 mr-1" /> Set Reminder
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>Record payment for this credit entry</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {selectedUdhari && (() => {
              const u = udhariList.find(x => x.id === selectedUdhari);
              return u ? (
                <div className="bg-muted/50 rounded-lg p-3 text-sm">
                  <p>Bill: <span className="font-mono font-medium">{u.bill_number}</span></p>
                  <p>Remaining: <span className="font-bold text-destructive">₹{Number(u.remaining_amount).toLocaleString()}</span></p>
                </div>
              ) : null;
            })()}
            <div><Label className="text-xs">Amount</Label><Input type="number" value={paymentAmount || ''} onChange={e => setPaymentAmount(Number(e.target.value))} placeholder="Enter amount" /></div>
            <div>
              <Label className="text-xs">Payment Mode</Label>
              <Select value={paymentMode} onValueChange={v => setPaymentMode(v as 'cash' | 'online')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Notes</Label><Input value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} placeholder="Optional notes" /></div>
            <Button onClick={() => payMutation.mutate()} disabled={payMutation.isPending} className="w-full">
              <CheckCircle className="w-4 h-4 mr-1" /> Confirm Payment
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerDetailPage;
