import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Search, Edit, Trash2, Package, ImageIcon, Camera, Calendar, Tag, Hash, IndianRupee, AlertTriangle, TrendingUp, Settings, Download, RefreshCw, FileText, Eye, Clock, X } from 'lucide-react';
import { exportToCSV } from '@/lib/exportUtils';
import { toast } from 'sonner';
import CameraCapture from '@/components/CameraCapture';
import { format } from 'date-fns';

const StockPage = () => {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState<any>(null);
  const [showFieldManager, setShowFieldManager] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<'text' | 'number' | 'date'>('text');

  // Update stock dialog
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [updateItem, setUpdateItem] = useState<any>(null);
  const [updateForm, setUpdateForm] = useState({ quantity: 0, buy_price: 0, sell_price: 0, notes: '' });
  const [updateInvoiceFiles, setUpdateInvoiceFiles] = useState<string[]>([]);

  // Add stock form - multiple invoices
  const [addInvoiceFiles, setAddInvoiceFiles] = useState<string[]>([]);

  const [form, setForm] = useState({
    name: '', item_code: '', description: '', category: '', buy_price: 0, sell_price: 0, quantity: 0, min_stock: 5, image_url: '', in_date: new Date().toISOString().split('T')[0],
  });
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  const { data: stock = [], isLoading } = useQuery({
    queryKey: ['stock'],
    queryFn: async () => {
      const { data, error } = await supabase.from('stock_items').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: customFields = [] } = useQuery({
    queryKey: ['custom-fields', 'stock'],
    queryFn: async () => {
      const { data, error } = await supabase.from('custom_fields').select('*').eq('entity_type', 'stock').order('sort_order');
      if (error) throw error;
      return data;
    },
  });

  // Fetch invoices for the viewing item
  const { data: itemInvoices = [] } = useQuery({
    queryKey: ['stock-invoices', viewingItem?.id],
    queryFn: async () => {
      if (!viewingItem?.id) return [];
      const { data, error } = await supabase
        .from('stock_invoices')
        .select('*')
        .eq('stock_id', viewingItem.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!viewingItem?.id,
  });

  // Count invoices for each stock item
  const { data: invoiceCounts = {} } = useQuery({
    queryKey: ['stock-invoice-counts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('stock_invoices').select('stock_id');
      if (error) throw error;
      const counts: Record<string, number> = {};
      data?.forEach((inv: any) => {
        counts[inv.stock_id] = (counts[inv.stock_id] || 0) + 1;
      });
      return counts;
    },
  });

  const filtered = stock.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.item_code.toLowerCase().includes(search.toLowerCase()) ||
    (s.category || '').toLowerCase().includes(search.toLowerCase())
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      let itemId = editingId;
      if (editingId) {
        const { error } = await supabase.from('stock_items').update(form).eq('id', editingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('stock_items').insert(form).select('id').single();
        if (error) throw error;
        itemId = data.id;
      }
      // Save invoices
      if (itemId && addInvoiceFiles.length > 0) {
        const invoiceRecords = addInvoiceFiles.map(url => ({
          stock_id: itemId!,
          invoice_url: url,
          quantity_added: form.quantity,
          buy_price: form.buy_price,
          sell_price: form.sell_price,
          notes: editingId ? 'Edit update' : 'Initial stock',
        }));
        const { error: invError } = await supabase.from('stock_invoices').insert(invoiceRecords);
        if (invError) console.error('Invoice save error:', invError);
      }
      if (itemId && Object.keys(customValues).length > 0) {
        for (const [fieldId, value] of Object.entries(customValues)) {
          if (!value) continue;
          const { data: existing } = await supabase.from('custom_field_values')
            .select('id').eq('field_id', fieldId).eq('entity_id', itemId).single();
          if (existing) {
            await supabase.from('custom_field_values').update({ value }).eq('id', existing.id);
          } else {
            await supabase.from('custom_field_values').insert({ field_id: fieldId, entity_id: itemId, value });
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['stock-invoice-counts'] });
      setDialogOpen(false);
      setAddInvoiceFiles([]);
      toast.success(editingId ? 'Stock updated!' : 'Stock added!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Update stock mutation
  const updateStockMutation = useMutation({
    mutationFn: async () => {
      if (!updateItem) throw new Error('No item selected');
      const newQty = updateItem.quantity + updateForm.quantity;
      const updates: any = { quantity: newQty };
      if (updateForm.buy_price > 0) updates.buy_price = updateForm.buy_price;
      if (updateForm.sell_price > 0) updates.sell_price = updateForm.sell_price;
      updates.in_date = new Date().toISOString().split('T')[0];
      const { error } = await supabase.from('stock_items').update(updates).eq('id', updateItem.id);
      if (error) throw error;

      // Save all invoice images to stock_invoices table
      if (updateInvoiceFiles.length > 0) {
        const invoiceRecords = updateInvoiceFiles.map(url => ({
          stock_id: updateItem.id,
          invoice_url: url,
          quantity_added: updateForm.quantity,
          buy_price: updateForm.buy_price > 0 ? updateForm.buy_price : Number(updateItem.buy_price),
          sell_price: updateForm.sell_price > 0 ? updateForm.sell_price : Number(updateItem.sell_price),
          notes: updateForm.notes || '',
        }));
        const { error: invError } = await supabase.from('stock_invoices').insert(invoiceRecords);
        if (invError) throw invError;
      } else {
        // Even without invoice, log the update
        await supabase.from('stock_invoices').insert({
          stock_id: updateItem.id,
          invoice_url: '',
          quantity_added: updateForm.quantity,
          buy_price: updateForm.buy_price > 0 ? updateForm.buy_price : Number(updateItem.buy_price),
          sell_price: updateForm.sell_price > 0 ? updateForm.sell_price : Number(updateItem.sell_price),
          notes: updateForm.notes || 'Stock update (no invoice)',
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['stock-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['stock-invoice-counts'] });
      setUpdateDialogOpen(false);
      setUpdateItem(null);
      setUpdateInvoiceFiles([]);
      toast.success('Stock updated successfully!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('custom_field_values').delete().eq('entity_id', id);
      const { error } = await supabase.from('stock_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['stock-invoice-counts'] });
      toast.success('Item deleted');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addFieldMutation = useMutation({
    mutationFn: async () => {
      if (!newFieldName.trim()) throw new Error('Field name required');
      const { error } = await supabase.from('custom_fields').insert({
        entity_type: 'stock', field_name: newFieldName.trim(), field_type: newFieldType,
        sort_order: customFields.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-fields', 'stock'] });
      setNewFieldName('');
      toast.success('Custom field added!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteFieldMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('custom_fields').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-fields', 'stock'] });
      toast.success('Field removed');
    },
  });

  const openAdd = () => {
    setEditingId(null);
    setForm({ name: '', item_code: '', description: '', category: '', buy_price: 0, sell_price: 0, quantity: 0, min_stock: 5, image_url: '', in_date: new Date().toISOString().split('T')[0] });
    setCustomValues({});
    setAddInvoiceFiles([]);
    setDialogOpen(true);
  };

  const openEdit = async (item: typeof stock[0]) => {
    setEditingId(item.id);
    setForm({
      name: item.name, item_code: item.item_code, description: item.description || '', category: item.category || '',
      buy_price: Number(item.buy_price), sell_price: Number(item.sell_price), quantity: item.quantity, min_stock: item.min_stock,
      image_url: item.image_url || '', in_date: item.in_date || new Date().toISOString().split('T')[0],
    });
    const { data: vals } = await supabase.from('custom_field_values').select('*').eq('entity_id', item.id);
    const cv: Record<string, string> = {};
    vals?.forEach((v: any) => { cv[v.field_id] = v.value; });
    setCustomValues(cv);
    setAddInvoiceFiles([]);
    setDialogOpen(true);
  };

  const openUpdateStock = (item: any) => {
    setUpdateItem(item);
    setUpdateForm({ quantity: 0, buy_price: 0, sell_price: 0, notes: '' });
    setUpdateInvoiceFiles([]);
    setUpdateDialogOpen(true);
  };

  const handleImageUpload = async (file: File) => {
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('product-images').upload(path, file);
    if (error) { toast.error('Upload failed'); return; }
    const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(path);
    setForm(f => ({ ...f, image_url: urlData.publicUrl }));
    toast.success('Image uploaded');
  };

  const handleInvoiceUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'add' | 'update') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `invoices/${Date.now()}_${i}.${ext}`;
      const { error } = await supabase.storage.from('product-images').upload(path, file);
      if (error) { toast.error(`Upload failed: ${file.name}`); continue; }
      const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(path);
      if (target === 'add') {
        setAddInvoiceFiles(prev => [...prev, urlData.publicUrl]);
      } else {
        setUpdateInvoiceFiles(prev => [...prev, urlData.publicUrl]);
      }
    }
    toast.success('Invoice(s) uploaded');
    // Reset input
    e.target.value = '';
  };

  const removeInvoiceFile = (index: number, target: 'add' | 'update') => {
    if (target === 'add') {
      setAddInvoiceFiles(prev => prev.filter((_, i) => i !== index));
    } else {
      setUpdateInvoiceFiles(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await handleImageUpload(file);
  };

  const handleSave = () => {
    if (!form.name || !form.item_code) { toast.error('Name and Item Code required'); return; }
    saveMutation.mutate();
  };

  const InvoicePreviewGrid = ({ files, target }: { files: string[], target: 'add' | 'update' }) => (
    <div className="flex flex-wrap gap-2">
      {files.map((url, i) => (
        <div key={i} className="relative w-16 h-16 rounded-lg border border-border overflow-hidden group">
          <img src={url} alt={`Invoice ${i + 1}`} className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => removeInvoiceFile(i, target)}
            className="absolute top-0 right-0 bg-destructive text-destructive-foreground rounded-bl-lg p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );

  if (isLoading) return <div className="flex justify-center py-16"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by name, code, category..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Button variant="outline" size="sm" onClick={() => {
          exportToCSV(stock.map(s => ({
            Name: s.name, Code: s.item_code, Category: s.category, BuyPrice: s.buy_price, SellPrice: s.sell_price, Qty: s.quantity, MinStock: s.min_stock
          })), 'stock_report');
          toast.success('Stock report exported!');
        }}>
          <Download className="w-4 h-4 mr-1" /> Export
        </Button>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowFieldManager(true)}>
              <Settings className="w-4 h-4 mr-1" /> Custom Fields
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openAdd}><Plus className="w-4 h-4 mr-1" /> Add Stock</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingId ? 'Edit Stock Item' : 'Add New Stock Item'}</DialogTitle>
                  <DialogDescription>Fill in the product details below</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  {/* Product Image */}
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-xl bg-muted border-2 border-dashed border-border flex items-center justify-center overflow-hidden">
                      {form.image_url ? <img src={form.image_url} alt="Product" className="w-full h-full object-cover" /> : <ImageIcon className="w-6 h-6 text-muted-foreground" />}
                    </div>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <div>
                          <Label htmlFor="image" className="cursor-pointer text-sm text-primary font-medium hover:underline">📁 Upload</Label>
                          <input id="image" type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                        </div>
                        <button type="button" onClick={() => setCameraOpen(true)} className="text-sm text-primary font-medium hover:underline flex items-center gap-1">
                          <Camera className="w-3.5 h-3.5" /> Camera
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">Product photo</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label>Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                    <div className="space-y-1.5"><Label>Item Code *</Label><Input value={form.item_code} onChange={e => setForm(f => ({ ...f, item_code: e.target.value }))} /></div>
                    <div className="space-y-1.5"><Label>Category</Label><Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Covers, Chargers" /></div>
                    <div className="space-y-1.5"><Label>In Date</Label><Input type="date" value={form.in_date} onChange={e => setForm(f => ({ ...f, in_date: e.target.value }))} /></div>
                    <div className="space-y-1.5"><Label>Buy Price (₹)</Label><Input type="number" value={form.buy_price} onChange={e => setForm(f => ({ ...f, buy_price: +e.target.value }))} /></div>
                    <div className="space-y-1.5"><Label>Sell Price (₹)</Label><Input type="number" value={form.sell_price} onChange={e => setForm(f => ({ ...f, sell_price: +e.target.value }))} /></div>
                    <div className="space-y-1.5"><Label>Quantity</Label><Input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: +e.target.value }))} /></div>
                    <div className="space-y-1.5"><Label>Min Stock Alert</Label><Input type="number" value={form.min_stock} onChange={e => setForm(f => ({ ...f, min_stock: +e.target.value }))} /></div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Description</Label>
                    <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
                  </div>

                  {/* Multiple Invoice Upload */}
                  <div className="space-y-2 border-t border-border pt-3">
                    <Label className="flex items-center gap-1.5"><FileText className="w-4 h-4 text-muted-foreground" /> Invoices / Purchase Bills</Label>
                    {addInvoiceFiles.length > 0 && <InvoicePreviewGrid files={addInvoiceFiles} target="add" />}
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-lg border-2 border-dashed border-border flex items-center justify-center">
                        <Plus className="w-4 h-4 text-muted-foreground/40" />
                      </div>
                      <div>
                        <Label htmlFor="invoice-add" className="cursor-pointer text-sm text-primary font-medium hover:underline">
                          📄 Upload Invoice(s)
                        </Label>
                        <input id="invoice-add" type="file" accept="image/*,.pdf" className="hidden" multiple onChange={e => handleInvoiceUpload(e, 'add')} />
                        <p className="text-xs text-muted-foreground mt-0.5">Multiple invoices supported</p>
                      </div>
                    </div>
                  </div>

                  {/* Custom Fields */}
                  {customFields.length > 0 && (
                    <div className="space-y-3 border-t border-border pt-3">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase">Custom Fields</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {customFields.map((field: any) => (
                          <div key={field.id} className="space-y-1.5">
                            <Label className="text-xs">{field.field_name}{field.is_required && ' *'}</Label>
                            <Input
                              type={field.field_type === 'number' ? 'number' : field.field_type === 'date' ? 'date' : 'text'}
                              value={customValues[field.id] || ''}
                              onChange={e => setCustomValues(v => ({ ...v, [field.id]: e.target.value }))}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {form.buy_price > 0 && form.sell_price > 0 && (
                    <div className="text-xs p-2 bg-muted/50 rounded-lg flex justify-between">
                      <span>Margin: ₹{(form.sell_price - form.buy_price).toLocaleString()}</span>
                      <span className="text-success font-bold">{((form.sell_price - form.buy_price) / form.buy_price * 100).toFixed(1)}% profit</span>
                    </div>
                  )}
                  <Button onClick={handleSave} className="w-full" disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? 'Saving...' : editingId ? 'Update Item' : 'Add Item'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* Stock Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map(item => (
          <div key={item.id} className="stat-card group cursor-pointer" onClick={() => setViewingItem(item)}>
            <div className="w-full h-32 rounded-lg bg-muted mb-3 overflow-hidden flex items-center justify-center">
              {item.image_url ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" /> : <Package className="w-10 h-10 text-muted-foreground/40" />}
            </div>
            <div className="flex items-start justify-between mb-1">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm truncate">{item.name}</h3>
                <p className="text-xs text-muted-foreground font-mono">{item.item_code}</p>
              </div>
              {isAdmin && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                  <button onClick={() => openUpdateStock(item)} className="p-1 rounded hover:bg-primary/10" title="Update Stock">
                    <RefreshCw className="w-3.5 h-3.5 text-primary" />
                  </button>
                  <button onClick={() => openEdit(item)} className="p-1 rounded hover:bg-muted" title="Edit Item">
                    <Edit className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <button onClick={() => deleteMutation.mutate(item.id)} className="p-1 rounded hover:bg-destructive/10" title="Delete">
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </button>
                </div>
              )}
            </div>
            {item.category && <span className="inline-block text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full mb-2">{item.category}</span>}
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold text-primary">₹{Number(item.sell_price).toLocaleString()}</span>
              <span className={`font-semibold ${item.quantity <= item.min_stock ? 'text-destructive' : 'text-success'}`}>
                Qty: {item.quantity}
              </span>
            </div>
            {isAdmin && ((invoiceCounts as any)[item.id] > 0) && (
              <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                <FileText className="w-3 h-3" /> {(invoiceCounts as any)[item.id]} invoice(s)
              </div>
            )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && !isLoading && (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>No stock items found</p>
        </div>
      )}

      {/* Stock Detail Dialog */}
      <Dialog open={!!viewingItem} onOpenChange={() => setViewingItem(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Product Details</DialogTitle>
            <DialogDescription>Full information about this stock item</DialogDescription>
          </DialogHeader>
          {viewingItem && (
            <div className="space-y-4">
              <div className="w-full h-48 rounded-xl bg-muted overflow-hidden flex items-center justify-center">
                {viewingItem.image_url ? <img src={viewingItem.image_url} alt={viewingItem.name} className="w-full h-full object-cover" /> : <Package className="w-16 h-16 text-muted-foreground/30" />}
              </div>
              <div>
                <h3 className="text-xl font-bold font-display">{viewingItem.name}</h3>
                {viewingItem.category && <span className="inline-block text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full mt-1">{viewingItem.category}</span>}
                {viewingItem.description && <p className="text-sm text-muted-foreground mt-2">{viewingItem.description}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded-xl p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Hash className="w-3 h-3" /> Item Code</div>
                  <p className="font-mono font-semibold text-sm">{viewingItem.item_code}</p>
                </div>
                <div className="bg-muted/50 rounded-xl p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Tag className="w-3 h-3" /> Category</div>
                  <p className="font-semibold text-sm">{viewingItem.category || '—'}</p>
                </div>
                <div className="bg-muted/50 rounded-xl p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><IndianRupee className="w-3 h-3" /> Sell Price</div>
                  <p className="font-bold text-sm text-primary">₹{Number(viewingItem.sell_price).toLocaleString()}</p>
                </div>
                {isAdmin && (
                  <div className="bg-muted/50 rounded-xl p-3 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><IndianRupee className="w-3 h-3" /> Buy Price</div>
                    <p className="font-bold text-sm">₹{Number(viewingItem.buy_price).toLocaleString()}</p>
                  </div>
                )}
                <div className={`rounded-xl p-3 space-y-1 ${viewingItem.quantity <= viewingItem.min_stock ? 'bg-destructive/10' : 'bg-success/10'}`}>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Package className="w-3 h-3" /> Quantity</div>
                  <p className={`font-bold text-sm ${viewingItem.quantity <= viewingItem.min_stock ? 'text-destructive' : 'text-success'}`}>{viewingItem.quantity}</p>
                </div>
                <div className="bg-muted/50 rounded-xl p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><AlertTriangle className="w-3 h-3" /> Min Stock</div>
                  <p className="font-semibold text-sm">{viewingItem.min_stock}</p>
                </div>
                <div className="bg-muted/50 rounded-xl p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Calendar className="w-3 h-3" /> Added</div>
                  <p className="font-semibold text-sm">{viewingItem.in_date || '—'}</p>
                </div>
                {isAdmin && (
                  <div className="bg-success/10 rounded-xl p-3 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><TrendingUp className="w-3 h-3" /> Profit/Unit</div>
                    <p className="font-bold text-sm text-success">₹{(Number(viewingItem.sell_price) - Number(viewingItem.buy_price)).toLocaleString()}</p>
                  </div>
                )}
              </div>

              {/* Invoice History (Admin only) */}
              {isAdmin && itemInvoices.length > 0 && (
                <div className="border-t border-border pt-3">
                  <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-3">
                    <FileText className="w-4 h-4 text-muted-foreground" /> Invoice History ({itemInvoices.length})
                  </h4>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {itemInvoices.map((inv: any) => (
                      <div key={inv.id} className="bg-muted/50 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {inv.created_at ? format(new Date(inv.created_at), 'dd MMM yyyy, hh:mm a') : '—'}
                          </div>
                          {inv.quantity_added > 0 && (
                            <span className="text-xs font-semibold text-success bg-success/10 px-2 py-0.5 rounded-full">
                              +{inv.quantity_added} units
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <span>Buy: ₹{Number(inv.buy_price).toLocaleString()}</span>
                          <span>Sell: ₹{Number(inv.sell_price).toLocaleString()}</span>
                        </div>
                        {inv.notes && <p className="text-xs text-muted-foreground">{inv.notes}</p>}
                        {inv.invoice_url && (
                          <div className="flex items-center gap-2">
                            <div className="w-12 h-12 rounded-lg border border-border overflow-hidden">
                              <img src={inv.invoice_url} alt="Invoice" className="w-full h-full object-cover" />
                            </div>
                            <a href={inv.invoice_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline">
                              <Eye className="w-3 h-3" /> View Full
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isAdmin && (
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => { setViewingItem(null); openUpdateStock(viewingItem); }}>
                    <RefreshCw className="w-4 h-4 mr-1" /> Update Stock
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => { setViewingItem(null); openEdit(viewingItem); }}>
                    <Edit className="w-4 h-4 mr-1" /> Edit
                  </Button>
                  <Button variant="destructive" size="icon" onClick={() => { deleteMutation.mutate(viewingItem.id); setViewingItem(null); }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Update Stock Dialog */}
      <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Update Stock</DialogTitle>
            <DialogDescription>
              {updateItem && (
                <span>Update quantity & prices for <strong>{updateItem.name}</strong> (Current: {updateItem.quantity} units)</span>
              )}
            </DialogDescription>
          </DialogHeader>
          {updateItem && (
            <div className="space-y-4 pt-1">
              <div className="bg-muted/50 rounded-xl p-3 flex items-center gap-3">
                {updateItem.image_url ? (
                  <img src={updateItem.image_url} className="w-12 h-12 rounded-lg object-cover" alt="" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center"><Package className="w-5 h-5 text-muted-foreground" /></div>
                )}
                <div>
                  <p className="font-semibold text-sm">{updateItem.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{updateItem.item_code}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Add Quantity (new stock received)</Label>
                <Input type="number" value={updateForm.quantity} onChange={e => setUpdateForm(f => ({ ...f, quantity: +e.target.value }))} placeholder="0" min={0} />
                <p className="text-xs text-muted-foreground">New total: {updateItem.quantity + updateForm.quantity} units</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>New Buy Price (₹)</Label>
                  <Input type="number" value={updateForm.buy_price || ''} onChange={e => setUpdateForm(f => ({ ...f, buy_price: +e.target.value }))} placeholder={`Current: ₹${Number(updateItem.buy_price)}`} />
                </div>
                <div className="space-y-1.5">
                  <Label>New Sell Price (₹)</Label>
                  <Input type="number" value={updateForm.sell_price || ''} onChange={e => setUpdateForm(f => ({ ...f, sell_price: +e.target.value }))} placeholder={`Current: ₹${Number(updateItem.sell_price)}`} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Input value={updateForm.notes} onChange={e => setUpdateForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. Received from XYZ supplier" />
              </div>

              {/* Multiple Invoice Upload */}
              <div className="space-y-2 border-t border-border pt-3">
                <Label className="flex items-center gap-1.5"><FileText className="w-4 h-4 text-muted-foreground" /> Invoices / Purchase Bills</Label>
                {updateInvoiceFiles.length > 0 && <InvoicePreviewGrid files={updateInvoiceFiles} target="update" />}
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-lg border-2 border-dashed border-border flex items-center justify-center">
                    <Plus className="w-4 h-4 text-muted-foreground/40" />
                  </div>
                  <div>
                    <Label htmlFor="invoice-update" className="cursor-pointer text-sm text-primary font-medium hover:underline">
                      📄 Upload Invoice(s)
                    </Label>
                    <input id="invoice-update" type="file" accept="image/*,.pdf" className="hidden" multiple onChange={e => handleInvoiceUpload(e, 'update')} />
                    <p className="text-xs text-muted-foreground mt-0.5">Multiple invoices supported</p>
                  </div>
                </div>
              </div>

              <Button onClick={() => updateStockMutation.mutate()} className="w-full" disabled={updateStockMutation.isPending || (updateForm.quantity === 0 && updateForm.buy_price === 0 && updateForm.sell_price === 0 && !updateForm.notes && updateInvoiceFiles.length === 0)}>
                <RefreshCw className="w-4 h-4 mr-1" />
                {updateStockMutation.isPending ? 'Updating...' : 'Update Stock'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Custom Fields Manager */}
      <Dialog open={showFieldManager} onOpenChange={setShowFieldManager}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Settings className="w-5 h-5" /> Manage Custom Fields</DialogTitle>
            <DialogDescription>Add or remove custom fields for stock items.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {customFields.length > 0 && (
              <div className="space-y-2">
                {customFields.map((field: any) => (
                  <div key={field.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{field.field_name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{field.field_type}</p>
                    </div>
                    <button onClick={() => deleteFieldMutation.mutate(field.id)} className="p-1 rounded hover:bg-destructive/10">
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="border-t border-border pt-3 space-y-3">
              <h4 className="text-sm font-semibold">Add New Field</h4>
              <Input placeholder="Field Name (e.g. Color, Warranty)" value={newFieldName} onChange={e => setNewFieldName(e.target.value)} />
              <div className="flex gap-2">
                {(['text', 'number', 'date'] as const).map(t => (
                  <button key={t} onClick={() => setNewFieldType(t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${newFieldType === t ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
              <Button onClick={() => addFieldMutation.mutate()} className="w-full" disabled={addFieldMutation.isPending || !newFieldName.trim()}>
                <Plus className="w-4 h-4 mr-1" /> Add Field
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CameraCapture open={cameraOpen} onOpenChange={setCameraOpen} onCapture={handleImageUpload} facingMode="environment" />
    </div>
  );
};

export default StockPage;
