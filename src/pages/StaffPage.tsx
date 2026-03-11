import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Edit, Users, UserCheck, UserX, ImageIcon, Camera, Download, CreditCard, Eye, EyeOff, Phone, Mail, MapPin, Shield, Key, Copy, Trash2, Calendar, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import CameraCapture from '@/components/CameraCapture';

const StaffPage = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraField, setCameraField] = useState<'photo' | 'aadhar_photo' | 'signature_photo'>('photo');
  const [deleteConfirm, setDeleteConfirm] = useState<any>(null);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', address: '', address_line2: '', emergency_contact: '', emergency_phone: '',
    password: '', photo: '', aadhar_photo: '', signature_photo: '', joinDate: new Date().toISOString().split('T')[0], isActive: true,
  });

  const { data: staffList = [], isLoading } = useQuery({
    queryKey: ['staff'],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*, user_roles(role)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return profiles.filter((p: any) => {
        const roles = p.user_roles as any[];
        return roles?.some((r: any) => r.role === 'staff');
      });
    },
  });

  const createStaffMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ email: form.email, password: form.password, name: form.name, role: 'staff' }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to create staff');
      if (result.userId) {
        await supabase.from('profiles').update({
          phone: form.phone, address: form.address, address_line2: form.address_line2,
          emergency_contact: form.emergency_contact, emergency_phone: form.emergency_phone,
          photo: form.photo, aadhar_photo: form.aadhar_photo, signature_photo: form.signature_photo,
          join_date: form.joinDate, is_active: form.isActive,
          staff_id_number: `STAFF-${Date.now().toString(36).toUpperCase().slice(-6)}`,
        }).eq('user_id', result.userId);
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['staff'] }); setDialogOpen(false); toast.success('Staff member added!'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStaffMutation = useMutation({
    mutationFn: async () => {
      if (!editingId) return;
      const member = staffList.find((m: any) => m.id === editingId);
      if (!member) return;
      const { error } = await supabase.from('profiles').update({
        name: form.name, phone: form.phone, address: form.address, address_line2: form.address_line2,
        emergency_contact: form.emergency_contact, emergency_phone: form.emergency_phone,
        photo: form.photo, aadhar_photo: form.aadhar_photo, signature_photo: form.signature_photo,
        join_date: form.joinDate, is_active: form.isActive,
      }).eq('user_id', member.user_id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['staff'] }); setDialogOpen(false); toast.success('Staff updated!'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteStaffMutation = useMutation({
    mutationFn: async (member: any) => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ user_id: member.user_id }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to delete staff');
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['staff'] }); setDeleteConfirm(null); toast.success('Staff member deleted completely!'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openAdd = () => {
    setEditingId(null);
    setForm({ name: '', email: '', phone: '', address: '', address_line2: '', emergency_contact: '', emergency_phone: '', password: '', photo: '', aadhar_photo: '', signature_photo: '', joinDate: new Date().toISOString().split('T')[0], isActive: true });
    setDialogOpen(true);
  };

  const openEdit = (member: any) => {
    setEditingId(member.id);
    setForm({
      name: member.name, email: member.email || '', phone: member.phone || '', address: member.address || '',
      address_line2: member.address_line2 || '', emergency_contact: member.emergency_contact || '', emergency_phone: member.emergency_phone || '',
      password: '', photo: member.photo || '', aadhar_photo: member.aadhar_photo || '', signature_photo: member.signature_photo || '',
      joinDate: member.join_date || '', isActive: member.is_active ?? true,
    });
    setDialogOpen(true);
  };

  const uploadFile = async (file: File, folder: string) => {
    const path = `${folder}/${Date.now()}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('product-images').upload(path, file);
    if (error) { toast.error('Upload failed'); return ''; }
    const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(path);
    return urlData.publicUrl;
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'photo' | 'aadhar_photo' | 'signature_photo') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadFile(file, field === 'photo' ? 'staff' : field === 'aadhar_photo' ? 'aadhar' : 'signatures');
    if (url) setForm(f => ({ ...f, [field]: url }));
  };

  const handleCameraCapture = async (file: File) => {
    const url = await uploadFile(file, cameraField === 'photo' ? 'staff' : cameraField === 'aadhar_photo' ? 'aadhar' : 'signatures');
    if (url) setForm(f => ({ ...f, [cameraField]: url }));
  };

  const openCamera = (field: 'photo' | 'aadhar_photo' | 'signature_photo') => {
    setCameraField(field);
    setCameraOpen(true);
  };

  const handleSave = () => {
    if (!form.name) { toast.error('Name is required'); return; }
    if (editingId) updateStaffMutation.mutate();
    else {
      if (!form.email || !form.password) { toast.error('Email and password required'); return; }
      createStaffMutation.mutate();
    }
  };

  const printIdCard = (member: any) => {
    const w = window.open('', '_blank', 'width=500,height=750');
    if (!w) return;
    const hasPhoto = member.photo && member.photo.trim() !== '';
    const hasId = member.staff_id_number && member.staff_id_number.trim() !== '';
    const hasSig = member.signature_photo && member.signature_photo.trim() !== '';
    w.document.write(`<!DOCTYPE html><html><head><title>ID Card - ${member.name}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Space Grotesk',system-ui,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f0f0f0}
.card{width:380px;border-radius:20px;overflow:hidden;box-shadow:0 25px 80px rgba(0,0,0,0.3);background:#0f172a}
.card-top{background:linear-gradient(135deg,#7c3aed,#2563eb,#0d9488);padding:20px 24px;position:relative}
.card-top::after{content:'';position:absolute;bottom:-20px;left:0;right:0;height:40px;background:#0f172a;border-radius:50% 50% 0 0}
.company{font-size:22px;font-weight:700;letter-spacing:1px;color:#fff}
.subtitle{font-size:10px;color:rgba(255,255,255,0.7);letter-spacing:3px;text-transform:uppercase;margin-top:2px}
.card-body{padding:12px 24px 20px;position:relative;z-index:1}
.photo-row{display:flex;gap:16px;align-items:flex-start;margin-bottom:16px}
.photo{width:100px;height:120px;border-radius:14px;overflow:hidden;border:3px solid #334155;background:#1e293b;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.photo img{width:100%;height:100%;object-fit:cover}
.photo-initial{font-size:40px;font-weight:700;color:#7c3aed}
.name{font-size:20px;font-weight:700;color:#fff;margin-bottom:4px}
.id-badge{display:inline-block;background:linear-gradient(135deg,#7c3aed,#2563eb);color:#fff;font-size:11px;font-family:monospace;padding:3px 10px;border-radius:6px;letter-spacing:1px;margin-bottom:8px}
.role-badge{display:inline-block;font-size:9px;color:#5eead4;background:rgba(94,234,212,0.1);border:1px solid rgba(94,234,212,0.2);padding:2px 12px;border-radius:20px;text-transform:uppercase;letter-spacing:2px;font-weight:600}
.details{margin-top:16px;border-top:1px solid #1e293b;padding-top:14px}
.detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.detail-item{background:#1e293b;border-radius:10px;padding:10px 12px}
.detail-label{font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px}
.detail-value{font-size:12px;color:#e2e8f0;font-weight:500;word-break:break-all}
.full-width{grid-column:1/3}
.footer{background:#1e293b;padding:14px 24px;display:flex;justify-content:space-between;align-items:flex-end;margin-top:8px}
.sig{height:32px;object-fit:contain;filter:invert(1);opacity:0.6}
.footer-text{font-size:8px;color:#475569;text-align:right;line-height:1.4}
@media print{body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}.card{box-shadow:none;margin:0}}
</style></head><body>
<div class="card">
  <div class="card-top">
    <div class="company">📱 MobiStock</div>
    <div class="subtitle">Staff Identity Card</div>
  </div>
  <div class="card-body">
    <div class="photo-row">
      <div class="photo">${hasPhoto ? `<img src="${member.photo}" alt="${member.name}"/>` : `<span class="photo-initial">${member.name.charAt(0)}</span>`}</div>
      <div>
        <div class="name">${member.name}</div>
        ${hasId ? `<div class="id-badge">${member.staff_id_number}</div><br/>` : ''}
        <div class="role-badge">Staff Member</div>
      </div>
    </div>
    <div class="details">
      <div class="detail-grid">
        ${member.email ? `<div class="detail-item"><div class="detail-label">📧 Email</div><div class="detail-value">${member.email}</div></div>` : ''}
        ${member.phone ? `<div class="detail-item"><div class="detail-label">📞 Phone</div><div class="detail-value">${member.phone}</div></div>` : ''}
        ${member.address ? `<div class="detail-item full-width"><div class="detail-label">📍 Address</div><div class="detail-value">${member.address}${member.address_line2 ? ', ' + member.address_line2 : ''}</div></div>` : ''}
        ${member.join_date ? `<div class="detail-item"><div class="detail-label">📅 Joined</div><div class="detail-value">${member.join_date}</div></div>` : ''}
        <div class="detail-item"><div class="detail-label">🔒 Status</div><div class="detail-value" style="color:${member.is_active !== false ? '#5eead4' : '#f87171'}">${member.is_active !== false ? '● Active' : '● Inactive'}</div></div>
        ${member.emergency_contact ? `<div class="detail-item full-width"><div class="detail-label">🆘 Emergency</div><div class="detail-value">${member.emergency_contact}${member.emergency_phone ? ' — ' + member.emergency_phone : ''}</div></div>` : ''}
      </div>
    </div>
  </div>
  <div class="footer">
    ${hasSig ? `<img src="${member.signature_photo}" class="sig" alt="Signature"/>` : '<span></span>'}
    <div class="footer-text">Authorized Signature<br/>KVK POINTS</div>
  </div>
</div>
</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 600);
  };

  // Inline ID Card component - fix photo and N/A display
  const IdCardPreview = ({ member }: { member: any }) => {
    const hasPhoto = member.photo && member.photo.trim() !== '';
    const hasId = member.staff_id_number && member.staff_id_number.trim() !== '';
    const hasSig = member.signature_photo && member.signature_photo.trim() !== '';

    return (
      <div className="rounded-2xl overflow-hidden shadow-xl" style={{ background: '#0f172a' }}>
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 via-blue-600 to-teal-500 px-5 py-4 text-center relative">
          <h3 className="text-lg font-bold text-white tracking-wider font-display">KVK POINTS</h3>
          <p className="text-[10px] text-white/70 tracking-[3px] uppercase">Staff Identity Card</p>
          <div className="absolute -bottom-3 left-0 right-0 h-6 rounded-t-[50%]" style={{ background: '#0f172a' }} />
        </div>
        {/* Body */}
        <div className="px-5 pt-2 pb-4 relative z-10">
          <div className="flex gap-4 mb-4">
            <div className="w-[90px] h-[110px] rounded-xl overflow-hidden border-2 border-white/10 flex-shrink-0 flex items-center justify-center" style={{ background: '#1e293b' }}>
              {hasPhoto ? <img src={member.photo} alt={member.name} className="w-full h-full object-cover" /> : <span className="text-3xl font-bold text-violet-400">{member.name.charAt(0)}</span>}
            </div>
            <div className="pt-1">
              <p className="font-bold text-lg text-white">{member.name}</p>
              {hasId && (
                <p className="text-xs font-mono text-white bg-gradient-to-r from-violet-600 to-blue-600 px-2 py-0.5 rounded inline-block mt-1">{member.staff_id_number}</p>
              )}
              <p className="text-[10px] text-teal-300 border border-teal-500/20 bg-teal-500/10 px-3 py-0.5 rounded-full inline-block mt-2 uppercase tracking-widest font-semibold">Staff Member</p>
            </div>
          </div>
          {/* Detail grid */}
          <div className="grid grid-cols-2 gap-2">
            {member.email && (
              <div className="rounded-lg p-2.5" style={{ background: '#1e293b' }}>
                <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-0.5">📧 Email</p>
                <p className="text-[11px] text-slate-300 break-all">{member.email}</p>
              </div>
            )}
            {member.phone && (
              <div className="rounded-lg p-2.5" style={{ background: '#1e293b' }}>
                <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-0.5">📞 Phone</p>
                <p className="text-[11px] text-slate-300">{member.phone}</p>
              </div>
            )}
            {member.address && (
              <div className="rounded-lg p-2.5 col-span-2" style={{ background: '#1e293b' }}>
                <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-0.5">📍 Address</p>
                <p className="text-[11px] text-slate-300">{member.address}{member.address_line2 ? `, ${member.address_line2}` : ''}</p>
              </div>
            )}
            {member.join_date && (
              <div className="rounded-lg p-2.5" style={{ background: '#1e293b' }}>
                <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-0.5">📅 Joined</p>
                <p className="text-[11px] text-slate-300">{member.join_date}</p>
              </div>
            )}
            <div className="rounded-lg p-2.5" style={{ background: '#1e293b' }}>
              <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-0.5">🔒 Status</p>
              <p className={`text-[11px] font-semibold ${member.is_active !== false ? 'text-teal-400' : 'text-red-400'}`}>{member.is_active !== false ? '● Active' : '● Inactive'}</p>
            </div>
            {member.emergency_contact && (
              <div className="rounded-lg p-2.5 col-span-2" style={{ background: '#1e293b' }}>
                <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-0.5">🆘 Emergency</p>
                <p className="text-[11px] text-slate-300">{member.emergency_contact}{member.emergency_phone ? ` — ${member.emergency_phone}` : ''}</p>
              </div>
            )}
          </div>
        </div>
        {/* Footer */}
        <div className="px-5 py-3 flex justify-between items-end border-t border-white/5">
          {hasSig ? <img src={member.signature_photo} alt="Signature" className="h-8 object-contain invert opacity-60" /> : <span />}
          <p className="text-[8px] text-slate-600 text-right leading-relaxed">Authorized Signature<br/>KVK POINTS</p>
        </div>
      </div>
    );
  };

  if (isLoading) return <div className="flex justify-center py-16"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{staffList.length} staff members</p>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <Button onClick={openAdd}><Plus className="w-4 h-4 mr-1" /> Add Staff</Button>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Staff' : 'Add New Staff'}</DialogTitle>
              <DialogDescription>Fill in the staff member details below</DialogDescription>
            </DialogHeader>
            <div className="space-y-5 pt-2">
              {/* Photo */}
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-muted border-2 border-dashed border-border flex items-center justify-center overflow-hidden">
                  {form.photo ? <img src={form.photo} alt="Staff" className="w-full h-full object-cover" /> : <ImageIcon className="w-5 h-5 text-muted-foreground" />}
                </div>
                <div className="space-y-1">
                  <div className="flex gap-2">
                    <Label htmlFor="staffPhoto" className="cursor-pointer text-sm text-primary font-medium hover:underline">📁 Upload</Label>
                    <input id="staffPhoto" type="file" accept="image/*" className="hidden" onChange={e => handleUpload(e, 'photo')} />
                    <button type="button" onClick={() => openCamera('photo')} className="text-sm text-primary font-medium hover:underline flex items-center gap-1">
                      <Camera className="w-3.5 h-3.5" /> Camera
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">Profile photo</p>
                </div>
              </div>
              {/* Basic Info */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Basic Information</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Full Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                  <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
                  {!editingId && (
                    <>
                      <div className="space-y-1.5"><Label>Email *</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                      <div className="space-y-1.5 relative">
                        <Label>Password *</Label>
                        <div className="relative">
                          <Input type={showPassword ? 'text' : 'password'} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2">
                            {showPassword ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                  <div className="space-y-1.5"><Label>Join Date</Label><Input type="date" value={form.joinDate} onChange={e => setForm(f => ({ ...f, joinDate: e.target.value }))} /></div>
                </div>
              </div>
              {/* Address */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Address Details</h4>
                <div className="space-y-3">
                  <div className="space-y-1.5"><Label>Address Line 1</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Street, House No." /></div>
                  <div className="space-y-1.5"><Label>Address Line 2</Label><Input value={form.address_line2} onChange={e => setForm(f => ({ ...f, address_line2: e.target.value }))} placeholder="City, State, PIN" /></div>
                </div>
              </div>
              {/* Emergency */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Emergency Contact</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Contact Name</Label><Input value={form.emergency_contact} onChange={e => setForm(f => ({ ...f, emergency_contact: e.target.value }))} /></div>
                  <div className="space-y-1.5"><Label>Contact Phone</Label><Input value={form.emergency_phone} onChange={e => setForm(f => ({ ...f, emergency_phone: e.target.value }))} /></div>
                </div>
              </div>
              {/* Documents */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Documents</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Aadhar Card Photo</Label>
                    <div className="w-full h-24 rounded-lg bg-muted border-2 border-dashed border-border flex items-center justify-center overflow-hidden">
                      {form.aadhar_photo ? <img src={form.aadhar_photo} alt="Aadhar" className="w-full h-full object-cover" /> : <CreditCard className="w-6 h-6 text-muted-foreground" />}
                    </div>
                    <div className="flex gap-2">
                      <Label htmlFor="aadhar" className="cursor-pointer text-xs text-primary hover:underline">Upload</Label>
                      <input id="aadhar" type="file" accept="image/*" className="hidden" onChange={e => handleUpload(e, 'aadhar_photo')} />
                      <button type="button" onClick={() => openCamera('aadhar_photo')} className="text-xs text-primary hover:underline flex items-center gap-1"><Camera className="w-3 h-3" /> Camera</button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Signature</Label>
                    <div className="w-full h-24 rounded-lg bg-muted border-2 border-dashed border-border flex items-center justify-center overflow-hidden">
                      {form.signature_photo ? <img src={form.signature_photo} alt="Signature" className="w-full h-full object-cover" /> : <span className="text-xs text-muted-foreground">No signature</span>}
                    </div>
                    <div className="flex gap-2">
                      <Label htmlFor="sig" className="cursor-pointer text-xs text-primary hover:underline">Upload</Label>
                      <input id="sig" type="file" accept="image/*" className="hidden" onChange={e => handleUpload(e, 'signature_photo')} />
                      <button type="button" onClick={() => openCamera('signature_photo')} className="text-xs text-primary hover:underline flex items-center gap-1"><Camera className="w-3 h-3" /> Camera</button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isActive" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="rounded" />
                <Label htmlFor="isActive">Active</Label>
              </div>
              <Button onClick={handleSave} className="w-full" disabled={createStaffMutation.isPending || updateStaffMutation.isPending}>
                {(createStaffMutation.isPending || updateStaffMutation.isPending) ? 'Saving...' : editingId ? 'Update' : 'Add Staff'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Staff Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {staffList.map((member: any) => (
          <div key={member.id} className="space-y-4">
            <IdCardPreview member={member} />
            <div className="stat-card">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-sm flex items-center gap-1.5"><Key className="w-3.5 h-3.5 text-primary" /> Credentials & Details</h4>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(member)} className="p-1.5 rounded-lg hover:bg-muted"><Edit className="w-4 h-4 text-muted-foreground" /></button>
                  <button onClick={() => setDeleteConfirm(member)} className="p-1.5 rounded-lg hover:bg-destructive/10"><Trash2 className="w-4 h-4 text-destructive" /></button>
                </div>
              </div>
              <div className="bg-muted/50 rounded-xl p-3 space-y-2 mb-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Email:</span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-foreground">{member.email}</span>
                    <button onClick={() => { navigator.clipboard.writeText(member.email); toast.success('Copied!'); }} className="p-0.5 hover:bg-muted rounded"><Copy className="w-3 h-3" /></button>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground italic">Password set during creation. Contact admin to reset.</p>
              </div>
              {/* Documents */}
              <div className="grid grid-cols-2 gap-3">
                {member.aadhar_photo && member.aadhar_photo.trim() !== '' && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Aadhar Card</p>
                    <img src={member.aadhar_photo} alt="Aadhar" className="w-full h-20 object-cover rounded-lg border border-border" />
                  </div>
                )}
                {member.signature_photo && member.signature_photo.trim() !== '' && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Signature</p>
                    <img src={member.signature_photo} alt="Signature" className="w-full h-20 object-contain rounded-lg border border-border bg-white p-1" />
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                {member.is_active !== false ? (
                  <span className="inline-flex items-center gap-1 text-xs bg-success/10 text-success px-2 py-0.5 rounded-full"><UserCheck className="w-3 h-3" /> Active</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full"><UserX className="w-3 h-3" /> Inactive</span>
                )}
                <Button variant="outline" size="sm" onClick={() => printIdCard(member)}>
                  <Download className="w-3.5 h-3.5 mr-1" /> Print ID Card
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {staffList.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>No staff members added yet</p>
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-destructive" /> Delete Staff Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>? This will permanently remove their profile, login credentials, and all associated data from the database. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteStaffMutation.mutate(deleteConfirm)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteStaffMutation.isPending ? 'Deleting...' : 'Delete Permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CameraCapture open={cameraOpen} onOpenChange={setCameraOpen} onCapture={handleCameraCapture} facingMode={cameraField === 'photo' ? 'user' : 'environment'} />
    </div>
  );
};

export default StaffPage;
