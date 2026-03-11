import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Plus, Minus, Search, ShoppingCart, Trash2, Receipt, CheckCircle, CreditCard, Banknote, Package, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { useShopSettings } from '@/hooks/useShopSettings';

interface CartItem {
  stockId: string;
  name: string;
  itemCode: string;
  quantity: number;
  buyPrice: number;
  price: number;
  total: number;
  imageUrl: string;
}

const BillingPage = () => {
  const { user, profile, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { settings: shop, updateSettings } = useShopSettings();
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [gstPercent, setGstPercent] = useState(0);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerGst, setCustomerGst] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMode, setPaymentMode] = useState<'cash' | 'online'>('cash');
  const [paidAmount, setPaidAmount] = useState<number | ''>('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [billGenerated, setBillGenerated] = useState<string | null>(null);
  const [generatedBillTotal, setGeneratedBillTotal] = useState(0);
  const [showShopSettings, setShowShopSettings] = useState(false);

  // Local shop edit state
  const [editShop, setEditShop] = useState({ shop_name: '', tagline: '', address: '', phone: '', email: '', gst_number: '' });

  const openShopSettings = () => {
    setEditShop({
      shop_name: shop.shop_name, tagline: shop.tagline, address: shop.address,
      phone: shop.phone, email: shop.email, gst_number: shop.gst_number,
    });
    setShowShopSettings(true);
  };

  const saveShopDetails = () => {
    updateSettings.mutate(editShop);
    setShowShopSettings(false);
  };

  // Custom fields for billing
  const { data: customFields = [] } = useQuery({
    queryKey: ['custom-fields', 'billing'],
    queryFn: async () => {
      const { data, error } = await supabase.from('custom_fields').select('*').eq('entity_type', 'billing').order('sort_order');
      if (error) throw error;
      return data;
    },
  });

  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  const { data: stock = [] } = useQuery({
    queryKey: ['stock'],
    queryFn: async () => {
      const { data, error } = await supabase.from('stock_items').select('*').gt('quantity', 0).order('name');
      if (error) throw error;
      return data;
    },
  });

  const filtered = stock.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.item_code.toLowerCase().includes(search.toLowerCase())
  );

  const addToCart = (item: typeof stock[0]) => {
    setCart(prev => {
      const existing = prev.find(c => c.stockId === item.id);
      if (existing) {
        if (existing.quantity >= item.quantity) return prev;
        return prev.map(c => c.stockId === item.id ? { ...c, quantity: c.quantity + 1, total: (c.quantity + 1) * c.price } : c);
      }
      return [...prev, { stockId: item.id, name: item.name, itemCode: item.item_code, quantity: 1, buyPrice: Number(item.buy_price), price: Number(item.sell_price), total: Number(item.sell_price), imageUrl: item.image_url || '' }];
    });
  };

  const updateCartPrice = (stockId: string, newPrice: number) => {
    setCart(prev => prev.map(c => c.stockId === stockId ? { ...c, price: newPrice, total: c.quantity * newPrice } : c));
  };

  const updateCartQty = (stockId: string, delta: number) => {
    setCart(prev => prev.map(c => {
      if (c.stockId !== stockId) return c;
      const item = stock.find(s => s.id === stockId);
      const newQty = Math.max(1, Math.min(c.quantity + delta, item?.quantity || 1));
      return { ...c, quantity: newQty, total: newQty * c.price };
    }));
  };

  const removeFromCart = (stockId: string) => setCart(prev => prev.filter(c => c.stockId !== stockId));

  const subtotal = useMemo(() => cart.reduce((sum, c) => sum + c.total, 0), [cart]);
  const gstAmount = (subtotal - discount) * gstPercent / 100;
  const total = Math.max(0, subtotal - discount + gstAmount);
  const totalCost = useMemo(() => cart.reduce((sum, c) => sum + c.buyPrice * c.quantity, 0), [cart]);
  const totalProfit = total - totalCost;

  const billMutation = useMutation({
    mutationFn: async () => {
      const billNumber = `INV-${Date.now().toString(36).toUpperCase()}`;

      // Auto-create or find customer
      let customerId: string | null = null;
      if (customerName) {
        // Try to find existing customer by phone or name
        let existingQuery = supabase.from('customers').select('id, total_purchases, total_spent');
        if (customerPhone) {
          existingQuery = existingQuery.eq('phone', customerPhone);
        } else {
          existingQuery = existingQuery.eq('name', customerName);
        }
        const { data: existingCustomers } = await existingQuery.limit(1);
        
        if (existingCustomers && existingCustomers.length > 0) {
          customerId = existingCustomers[0].id;
          // Update customer stats
          await supabase.from('customers').update({
            total_purchases: Number(existingCustomers[0].total_purchases || 0) + 1,
            total_spent: Number(existingCustomers[0].total_spent || 0) + total,
            last_purchase_date: new Date().toISOString(),
            address: customerAddress || undefined,
            gst_number: customerGst || undefined,
            updated_at: new Date().toISOString(),
          }).eq('id', customerId);
        } else {
          // Create new customer
          const { data: newCustomer } = await supabase.from('customers').insert({
            name: customerName,
            phone: customerPhone,
            address: customerAddress,
            gst_number: customerGst,
            primary_staff_id: user?.id || null,
            primary_staff_name: profile?.name || '',
            total_purchases: 1,
            total_spent: total,
            last_purchase_date: new Date().toISOString(),
          }).select('id').single();
          if (newCustomer) customerId = newCustomer.id;
        }
      }

      const { data: billData, error: billError } = await supabase.from('bills').insert({
        bill_number: billNumber, customer_name: customerName, customer_phone: customerPhone,
        customer_address: customerAddress, customer_gst: customerGst, subtotal, discount,
        gst_amount: gstAmount, total, payment_mode: paymentMode,
        staff_id: user?.id || null, staff_name: profile?.name || '', notes,
        customer_id: customerId,
      }).select('id').single();
      if (billError) throw billError;

      const items = cart.map(c => ({
        bill_id: billData.id, stock_id: c.stockId, name: c.name,
        item_code: c.itemCode, quantity: c.quantity, price: c.price, total: c.total,
      }));
      const { error: itemsError } = await supabase.from('bill_items').insert(items);
      if (itemsError) throw itemsError;

      for (const c of cart) {
        const stockItem = stock.find(s => s.id === c.stockId);
        if (stockItem) {
          await supabase.from('stock_items').update({ quantity: Math.max(0, stockItem.quantity - c.quantity) }).eq('id', c.stockId);
        }
      }

      // Create udhari if paid amount is less than total
      const actualPaid = typeof paidAmount === 'number' ? paidAmount : total;
      if (actualPaid < total) {
        const remaining = total - actualPaid;
        const { error: udhariError } = await supabase.from('udhari').insert({
          bill_id: billData.id,
          bill_number: billNumber,
          customer_name: customerName,
          customer_phone: customerPhone,
          total_amount: total,
          paid_amount: actualPaid,
          remaining_amount: remaining,
          staff_id: user?.id || null,
          staff_name: profile?.name || '',
          status: 'pending',
        });
        if (udhariError) throw udhariError;
      }

      return billNumber;
    },
    onSuccess: (billNumber) => {
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setGeneratedBillTotal(total);
      setBillGenerated(billNumber);
      setShowConfirm(false);
      toast.success('Bill generated successfully!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleConfirm = () => {
    if (cart.length === 0) { toast.error('Cart is empty'); return; }
    if (!customerName) { toast.error('Customer name is required'); return; }
    setShowConfirm(true);
  };

  const resetBill = () => {
    setCart([]); setDiscount(0); setGstPercent(0);
    setCustomerName(''); setCustomerPhone(''); setCustomerAddress('');
    setCustomerGst(''); setNotes(''); setPaymentMode('cash');
    setPaidAmount('');
    setBillGenerated(null); setGeneratedBillTotal(0); setCustomValues({});
  };

  if (billGenerated) {
    return (
      <div className="flex flex-col items-center justify-center py-16 animate-scale-in">
        <CheckCircle className="w-16 h-16 text-success mb-4" />
        <h2 className="text-2xl font-display font-bold mb-1">Bill Generated!</h2>
        <p className="text-muted-foreground mb-4">Bill Number: <span className="font-mono font-bold text-foreground">{billGenerated}</span></p>
        <p className="text-lg font-bold mb-6">Total: ₹{generatedBillTotal.toLocaleString()}</p>
        <Button onClick={resetBill}>New Bill</Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <div className="lg:col-span-3 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto pr-1">
          {filtered.map(item => {
            const inCart = cart.find(c => c.stockId === item.id);
            return (
              <button key={item.id} onClick={() => addToCart(item)} className={`stat-card text-left hover:border-primary/40 transition-colors relative ${inCart ? 'border-primary/50 bg-primary/5' : ''}`}>
                <div className="w-full h-20 rounded-lg bg-muted mb-2 overflow-hidden flex items-center justify-center">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-6 h-6 text-muted-foreground/40" />
                  )}
                </div>
                <p className="font-semibold text-sm truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{item.item_code}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-bold text-primary text-sm">₹{Number(item.sell_price)}</span>
                  <span className="text-xs text-muted-foreground">Stock: {item.quantity}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Buy: ₹{Number(item.buy_price)}</p>
                {inCart && (
                  <span className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">{inCart.quantity}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="lg:col-span-2">
        <div className="bg-card rounded-xl border border-border p-4 sticky top-20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" /> Cart ({cart.length})
            </h3>
            {isAdmin && (
              <button onClick={openShopSettings} className="p-1.5 rounded-lg hover:bg-muted" title="Shop Details">
                <Settings className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>

          {cart.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Add items to cart</p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto mb-4">
              {cart.map(item => (
                <div key={item.stockId} className="bg-muted/50 rounded-lg p-2.5 space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-md bg-muted overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" /> : <Package className="w-4 h-4 text-muted-foreground/40" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">Buy: ₹{item.buyPrice}</p>
                    </div>
                    <button onClick={() => removeFromCart(item.stockId)} className="w-6 h-6 rounded hover:bg-destructive/10 flex items-center justify-center"><Trash2 className="w-3 h-3 text-destructive" /></button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateCartQty(item.stockId, -1)} className="w-6 h-6 rounded bg-background flex items-center justify-center"><Minus className="w-3 h-3" /></button>
                      <span className="text-sm font-bold w-6 text-center">{item.quantity}</span>
                      <button onClick={() => updateCartQty(item.stockId, 1)} className="w-6 h-6 rounded bg-background flex items-center justify-center"><Plus className="w-3 h-3" /></button>
                    </div>
                    <span className="text-xs text-muted-foreground">×</span>
                    <Input type="number" value={item.price} onChange={e => updateCartPrice(item.stockId, +e.target.value)} className="w-20 h-7 text-xs text-right" />
                    <p className="text-sm font-bold ml-auto">₹{item.total}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-3 border-t border-border pt-4 mt-4">
            <h4 className="text-sm font-semibold">Customer Details</h4>
            <Input placeholder="Customer Name *" value={customerName} onChange={e => setCustomerName(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Phone" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
              <Input placeholder="GST Number" value={customerGst} onChange={e => setCustomerGst(e.target.value)} />
            </div>
            <Textarea placeholder="Full Address" value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} rows={2} />
            <Textarea placeholder="Notes / Remarks" value={notes} onChange={e => setNotes(e.target.value)} rows={1} />

            {/* Custom fields */}
            {customFields.length > 0 && (
              <div className="space-y-2 border-t border-border/50 pt-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase">Additional Fields</h4>
                {customFields.map((field: any) => (
                  <div key={field.id} className="space-y-1">
                    <Label className="text-xs">{field.field_name}{field.is_required && ' *'}</Label>
                    <Input
                      type={field.field_type === 'number' ? 'number' : field.field_type === 'date' ? 'date' : 'text'}
                      value={customValues[field.id] || ''}
                      onChange={e => setCustomValues(v => ({ ...v, [field.id]: e.target.value }))}
                      placeholder={field.field_name}
                    />
                  </div>
                ))}
              </div>
            )}

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

            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">Discount ₹</Label>
                <Input type="number" value={discount} onChange={e => setDiscount(+e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">GST %</Label>
                <Input type="number" value={gstPercent} onChange={e => setGstPercent(+e.target.value)} />
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-3 mt-3 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>₹{subtotal.toLocaleString()}</span></div>
            {discount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="text-destructive">-₹{discount}</span></div>}
            {gstAmount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">GST ({gstPercent}%)</span><span>+₹{gstAmount.toFixed(2)}</span></div>}
            <div className="flex justify-between text-lg font-bold"><span>Total</span><span className="text-primary">₹{total.toLocaleString()}</span></div>
            
            {/* Paid Amount / Udhari */}
            <div className="flex items-center gap-2 pt-2 border-t border-border/50">
              <Label className="text-xs whitespace-nowrap">Paid ₹</Label>
              <Input 
                type="number" 
                placeholder={total.toString()} 
                value={paidAmount} 
                onChange={e => setPaidAmount(e.target.value === '' ? '' : +e.target.value)} 
                className="h-8"
              />
            </div>
            {typeof paidAmount === 'number' && paidAmount < total && (
              <div className="flex justify-between text-sm font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-1.5 rounded-lg">
                <span>Udhari (Credit)</span>
                <span>₹{(total - paidAmount).toLocaleString()}</span>
              </div>
            )}
            
            <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
              <span>Total Cost: ₹{totalCost.toLocaleString()}</span>
              <span className={totalProfit >= 0 ? 'text-success' : 'text-destructive'}>Profit: ₹{totalProfit.toLocaleString()}</span>
            </div>
          </div>

          <Button onClick={handleConfirm} className="w-full mt-4" disabled={cart.length === 0}>
            <Receipt className="w-4 h-4 mr-1" /> Generate Bill
          </Button>
        </div>
      </div>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Bill</DialogTitle>
            <DialogDescription>Review and confirm the bill details</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p><strong>Customer:</strong> {customerName}</p>
            {customerPhone && <p><strong>Phone:</strong> {customerPhone}</p>}
            {customerAddress && <p><strong>Address:</strong> {customerAddress}</p>}
            {customerGst && <p><strong>GST:</strong> {customerGst}</p>}
            <p><strong>Items:</strong> {cart.length} | <strong>Payment:</strong> {paymentMode.toUpperCase()}</p>
            <p className="text-lg font-bold">Total: ₹{total.toLocaleString()}</p>
            {typeof paidAmount === 'number' && paidAmount < total && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-2 text-sm">
                <p><strong>Paid:</strong> ₹{paidAmount.toLocaleString()}</p>
                <p className="text-amber-600 dark:text-amber-400 font-semibold">Udhari: ₹{(total - paidAmount).toLocaleString()}</p>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowConfirm(false)} className="flex-1">Cancel</Button>
              <Button onClick={() => billMutation.mutate()} className="flex-1" disabled={billMutation.isPending}>
                {billMutation.isPending ? 'Processing...' : 'Confirm & Generate'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Shop Details Settings */}
      <Dialog open={showShopSettings} onOpenChange={setShowShopSettings}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Settings className="w-5 h-5" /> Shop Details</DialogTitle>
            <DialogDescription>These details will appear on printed invoices</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Shop Name</Label><Input value={editShop.shop_name} onChange={e => setEditShop(s => ({ ...s, shop_name: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Tagline</Label><Input value={editShop.tagline} onChange={e => setEditShop(s => ({ ...s, tagline: e.target.value }))} placeholder="e.g. Mobile Accessories & More" /></div>
            <div className="space-y-1.5"><Label>Address</Label><Textarea value={editShop.address} onChange={e => setEditShop(s => ({ ...s, address: e.target.value }))} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Phone</Label><Input value={editShop.phone} onChange={e => setEditShop(s => ({ ...s, phone: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input value={editShop.email} onChange={e => setEditShop(s => ({ ...s, email: e.target.value }))} /></div>
            </div>
            <div className="space-y-1.5"><Label>GST Number</Label><Input value={editShop.gst_number} onChange={e => setEditShop(s => ({ ...s, gst_number: e.target.value }))} /></div>
            <Button onClick={saveShopDetails} className="w-full">Save Details</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BillingPage;
