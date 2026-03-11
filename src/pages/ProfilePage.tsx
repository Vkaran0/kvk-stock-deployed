import { useState, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ImageIcon, Save, KeyRound, User, Camera, MapPin, Clock, CheckCircle2, LogIn, LogOut, Calendar, SwitchCamera, Ban, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { reverseGeocode } from '@/lib/geocoding';

const ProfilePage = () => {
  const { user, profile, role } = useAuth();
  const queryClient = useQueryClient();

  const [name, setName] = useState(profile?.name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [address, setAddress] = useState(profile?.address || '');
  const [photo, setPhoto] = useState(profile?.photo || '');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Attendance state
  const [selfieDialogOpen, setSelfieDialogOpen] = useState(false);
  const [attendanceAction, setAttendanceAction] = useState<'check_in' | 'check_out'>('check_in');
  const [capturingLocation, setCapturingLocation] = useState(false);
  const [locationFetching, setLocationFetching] = useState(false);
  const [locationData, setLocationData] = useState<{ lat: number; lng: number } | null>(null);
  const [locationAddress, setLocationAddress] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const today = new Date().toISOString().split('T')[0];

  const { data: todayAttendance, refetch: refetchAttendance } = useQuery({
    queryKey: ['my-attendance', today],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('attendance').select('*')
        .eq('user_id', user.id).eq('date', today).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: recentAttendance = [] } = useQuery({
    queryKey: ['my-attendance-history'],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('attendance').select('*')
        .eq('user_id', user.id).order('date', { ascending: false }).limit(30);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      if (!profile || !user) throw new Error('Profile not found');
      const { error } = await supabase.from('profiles').update({ name, phone, address, photo }).eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast.success('Profile updated!');
      window.location.reload();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) throw new Error('Passwords do not match');
      if (newPassword.length < 6) throw new Error('Password must be at least 6 characters');
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Password changed successfully!');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = `staff/${Date.now()}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('product-images').upload(path, file);
    if (error) { toast.error('Upload failed'); return; }
    const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(path);
    setPhoto(urlData.publicUrl);
    toast.success('Photo uploaded');
  };

  const startCamera = useCallback(async (facing: string) => {
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 } }, audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); setStreaming(true); }
    } catch { toast.error('Camera not available'); }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setStreaming(false);
  }, []);

  const getLocation = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error('Geolocation not supported')); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
      );
    });
  };

  const openAttendanceDialog = async (action: 'check_in' | 'check_out') => {
    setAttendanceAction(action);
    setLocationData(null);
    setLocationAddress('');
    setLocationFetching(true);
    try {
      const loc = await getLocation();
      setLocationData(loc);
      setLocationFetching(false);
      setSelfieDialogOpen(true);
      reverseGeocode(loc.lat, loc.lng).then(addr => setLocationAddress(addr));
      setTimeout(() => startCamera('user'), 300);
    } catch {
      toast.error('Location permission denied.');
      setLocationFetching(false);
    }
  };

  const handleAttendanceCapture = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !user) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    setCapturingLocation(true);
    stopCamera();

    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
      if (!blob) throw new Error('Failed to capture selfie');

      const fileName = `attendance/${user.id}/${today}_${attendanceAction}_${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('product-images').upload(fileName, blob);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
      const selfieUrl = urlData.publicUrl;
      const location = locationData || { lat: 0, lng: 0 };

      if (attendanceAction === 'check_in') {
        if (isRejected && todayAttendance) {
          await supabase.from('attendance').delete().eq('id', todayAttendance.id);
        }
        const { error } = await supabase.from('attendance').insert({
          user_id: user.id, date: today, check_in_time: new Date().toISOString(),
          check_in_selfie: selfieUrl, check_in_lat: location.lat, check_in_lng: location.lng,
          check_in_address: locationAddress || `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`, status: 'present',
        });
        if (error) throw error;
        toast.success('Check-in successful! ✅');
      } else {
        const { error } = await supabase.from('attendance').update({
          check_out_time: new Date().toISOString(), check_out_selfie: selfieUrl,
          check_out_lat: location.lat, check_out_lng: location.lng,
          check_out_address: locationAddress || `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`,
        }).eq('user_id', user.id).eq('date', today);
        if (error) throw error;
        toast.success('Check-out successful! 👋');
      }

      refetchAttendance();
      queryClient.invalidateQueries({ queryKey: ['my-attendance-history'] });
      queryClient.invalidateQueries({ queryKey: ['my-attendance-today'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-all'] });
      setSelfieDialogOpen(false);
    } catch (e: any) {
      toast.error(e.message || 'Attendance failed');
    } finally {
      setCapturingLocation(false);
    }
  };

  const hasCheckedIn = !!todayAttendance?.check_in_time && todayAttendance?.status !== 'rejected';
  const hasCheckedOut = !!todayAttendance?.check_out_time;
  const isRejected = todayAttendance?.status === 'rejected';

  const formatTime = (t: string | null) => {
    if (!t) return '--:--';
    return new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Attendance Section */}
      <div className="stat-card border-2 border-primary/20">
        <h3 className="font-display font-semibold text-lg flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-primary" /> Today's Attendance
        </h3>

        {isRejected && (
          <div className="flex items-center gap-2 bg-destructive/10 text-destructive rounded-xl px-4 py-3 mb-4 border border-destructive/20">
            <Ban className="w-5 h-5" />
            <div>
              <p className="font-medium text-sm">Attendance Rejected by Admin</p>
              <p className="text-xs opacity-80">Please re-submit your attendance.</p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 mb-4 text-sm">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium">{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className={`rounded-xl p-4 border ${hasCheckedIn ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-muted border-border'}`}>
            <div className="flex items-center gap-2 mb-2">
              <LogIn className={`w-4 h-4 ${hasCheckedIn ? 'text-emerald-500' : 'text-muted-foreground'}`} />
              <span className="text-xs font-medium uppercase tracking-wider">Check In</span>
            </div>
            <p className="text-xl font-bold font-display">{isRejected ? 'Rejected' : formatTime(todayAttendance?.check_in_time ?? null)}</p>
            {todayAttendance?.check_in_selfie && hasCheckedIn && (
              <img src={todayAttendance.check_in_selfie} alt="Check-in" className="w-12 h-12 rounded-lg object-cover mt-2 border border-border" />
            )}
            {todayAttendance?.check_in_address && hasCheckedIn && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 truncate"><MapPin className="w-3 h-3 flex-shrink-0" /> {todayAttendance.check_in_address}</p>
            )}
          </div>
          <div className={`rounded-xl p-4 border ${hasCheckedOut ? 'bg-blue-500/10 border-blue-500/30' : 'bg-muted border-border'}`}>
            <div className="flex items-center gap-2 mb-2">
              <LogOut className={`w-4 h-4 ${hasCheckedOut ? 'text-blue-500' : 'text-muted-foreground'}`} />
              <span className="text-xs font-medium uppercase tracking-wider">Check Out</span>
            </div>
            <p className="text-xl font-bold font-display">{formatTime(todayAttendance?.check_out_time ?? null)}</p>
            {todayAttendance?.check_out_selfie && (
              <img src={todayAttendance.check_out_selfie} alt="Check-out" className="w-12 h-12 rounded-lg object-cover mt-2 border border-border" />
            )}
            {todayAttendance?.check_out_address && hasCheckedOut && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 truncate"><MapPin className="w-3 h-3 flex-shrink-0" /> {todayAttendance.check_out_address}</p>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          {(!hasCheckedIn || isRejected) && (
            <Button onClick={() => openAttendanceDialog('check_in')} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" disabled={locationFetching}>
              {locationFetching ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Fetching Location...</> : <><Camera className="w-4 h-4 mr-2" /> {isRejected ? 'Re-submit Check In' : 'Check In with Selfie'}</>}
            </Button>
          )}
          {hasCheckedIn && !hasCheckedOut && !isRejected && (
            <Button onClick={() => openAttendanceDialog('check_out')} variant="outline" className="flex-1 border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10" disabled={locationFetching}>
              {locationFetching ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Fetching Location...</> : <><Camera className="w-4 h-4 mr-2" /> Check Out with Selfie</>}
            </Button>
          )}
          {hasCheckedIn && hasCheckedOut && !isRejected && (
            <div className="flex items-center gap-2 text-emerald-600 bg-emerald-500/10 rounded-xl px-4 py-3 w-full">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium text-sm">Today's attendance completed!</span>
            </div>
          )}
        </div>
      </div>

      {/* Recent attendance */}
      {recentAttendance.length > 0 && (
        <div className="stat-card">
          <h3 className="font-display font-semibold text-lg flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-primary" /> Recent Attendance
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {recentAttendance.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-2.5 text-sm">
                <div className="flex items-center gap-3">
                  {a.check_in_selfie && <img src={a.check_in_selfie} alt="" className="w-8 h-8 rounded-full object-cover" />}
                  <span className="font-medium">{new Date(a.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', weekday: 'short' })}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="text-emerald-600 font-medium">{formatTime(a.check_in_time)}</span>
                  <span>→</span>
                  <span className="text-blue-600 font-medium">{formatTime(a.check_out_time)}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.status === 'present' ? 'bg-emerald-500/10 text-emerald-600' : a.status === 'rejected' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>
                  {a.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Profile Section */}
      <div className="stat-card">
        <h3 className="font-display font-semibold text-lg flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-primary" /> Profile Details
        </h3>

        <div className="flex items-center gap-4 mb-6">
          <div className="w-20 h-20 rounded-full bg-muted border-2 border-dashed border-border flex items-center justify-center overflow-hidden">
            {photo ? (
              <img src={photo} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <ImageIcon className="w-6 h-6 text-muted-foreground" />
            )}
          </div>
          <div>
            <Label htmlFor="profilePhoto" className="cursor-pointer text-sm text-primary font-medium hover:underline">
              Change Photo
            </Label>
            <input id="profilePhoto" type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            <p className="text-xs text-muted-foreground mt-1">{user?.email}</p>
            <span className="inline-block text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full mt-1 capitalize">{role}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Full Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Address</Label>
            <Input value={address} onChange={e => setAddress(e.target.value)} />
          </div>
        </div>

        <Button onClick={() => updateProfileMutation.mutate()} className="mt-4" disabled={updateProfileMutation.isPending}>
          <Save className="w-4 h-4 mr-1" />
          {updateProfileMutation.isPending ? 'Saving...' : 'Save Profile'}
        </Button>
      </div>

      {/* Change Password */}
      <div className="stat-card">
        <h3 className="font-display font-semibold text-lg flex items-center gap-2 mb-4">
          <KeyRound className="w-5 h-5 text-warning" /> Change Password
        </h3>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>New Password</Label>
            <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min 6 characters" />
          </div>
          <div className="space-y-1.5">
            <Label>Confirm Password</Label>
            <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter password" />
          </div>
        </div>
        <Button onClick={() => changePasswordMutation.mutate()} className="mt-4" variant="outline" disabled={changePasswordMutation.isPending || !newPassword}>
          <KeyRound className="w-4 h-4 mr-1" />
          {changePasswordMutation.isPending ? 'Changing...' : 'Change Password'}
        </Button>
      </div>

      {/* Selfie dialog */}
      <Dialog open={selfieDialogOpen} onOpenChange={(v) => { if (!v) stopCamera(); setSelfieDialogOpen(v); }}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-4 h-4" />
              {attendanceAction === 'check_in' ? 'Check-In Selfie' : 'Check-Out Selfie'}
            </DialogTitle>
            <DialogDescription>Take a live selfie to mark your {attendanceAction === 'check_in' ? 'check-in' : 'check-out'}.</DialogDescription>
          </DialogHeader>
          {locationAddress && (
            <div className="px-4 py-2 flex items-center gap-2 text-xs text-emerald-600 bg-emerald-500/10 mx-4 rounded-lg">
              <MapPin className="w-3 h-3 flex-shrink-0" /> 📍 {locationAddress}
            </div>
          )}
          {!locationAddress && locationData && (
            <div className="px-4 py-2 flex items-center gap-2 text-xs text-muted-foreground bg-muted mx-4 rounded-lg">
              <Loader2 className="w-3 h-3 animate-spin" /> Fetching address...
            </div>
          )}
          <div className="relative bg-black aspect-[4/3] w-full">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }} />
            {capturingLocation && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white gap-3">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p className="text-sm">Submitting attendance...</p>
              </div>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />
          {streaming && (
            <div className="flex gap-2 p-4 pt-2">
              <Button variant="outline" size="icon" onClick={() => { const next = facingMode === 'user' ? 'environment' : 'user'; setFacingMode(next); startCamera(next); }}>
                <SwitchCamera className="w-4 h-4" />
              </Button>
              <Button onClick={handleAttendanceCapture} className="flex-1" disabled={capturingLocation}>
                <Camera className="w-4 h-4 mr-2" />
                {attendanceAction === 'check_in' ? 'Capture & Check In' : 'Capture & Check Out'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProfilePage;
