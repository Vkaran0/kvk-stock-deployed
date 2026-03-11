import { useState, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Calendar, Clock, Users, CheckCircle2, XCircle, MapPin, Camera, TrendingUp, Download, Eye, LogIn, LogOut, SwitchCamera, Loader2, Ban, CalendarOff, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { exportToCSV } from '@/lib/exportUtils';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { reverseGeocode } from '@/lib/geocoding';

const AttendancePage = () => {
  const { isAdmin, user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7));
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');
  const [viewingRecord, setViewingRecord] = useState<any>(null);

  // Holiday management
  const [holidayDialogOpen, setHolidayDialogOpen] = useState(false);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayTitle, setNewHolidayTitle] = useState('');

  // Attendance capture state
  const [selfieDialogOpen, setSelfieDialogOpen] = useState(false);
  const [attendanceAction, setAttendanceAction] = useState<'check_in' | 'check_out'>('check_in');
  const [locationFetching, setLocationFetching] = useState(false);
  const [locationData, setLocationData] = useState<{ lat: number; lng: number } | null>(null);
  const [locationAddress, setLocationAddress] = useState('');
  const [capturingLocation, setCapturingLocation] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const today = new Date().toISOString().split('T')[0];

  // Today's attendance for current user
  const { data: todayAttendance, refetch: refetchToday } = useQuery({
    queryKey: ['my-attendance-today', today],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const hasCheckedIn = !!todayAttendance?.check_in_time && todayAttendance?.status !== 'rejected';
  const hasCheckedOut = !!todayAttendance?.check_out_time;
  const isRejected = todayAttendance?.status === 'rejected';

  // Fetch all attendance
  const { data: attendance = [] } = useQuery({
    queryKey: ['attendance-all', monthFilter],
    queryFn: async () => {
      const startDate = `${monthFilter}-01`;
      const [y, m] = monthFilter.split('-').map(Number);
      const endDate = new Date(y, m, 0).toISOString().split('T')[0];
      let query = supabase.from('attendance').select('*').gte('date', startDate).lte('date', endDate).order('date', { ascending: false });
      if (!isAdmin) query = query.eq('user_id', user?.id);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch holidays
  const { data: holidays = [] } = useQuery({
    queryKey: ['holidays', monthFilter],
    queryFn: async () => {
      const startDate = `${monthFilter}-01`;
      const [y, m] = monthFilter.split('-').map(Number);
      const endDate = new Date(y, m, 0).toISOString().split('T')[0];
      const { data, error } = await supabase.from('holidays').select('*').gte('date', startDate).lte('date', endDate).order('date');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch staff profiles for admin
  const { data: staffProfiles = [] } = useQuery({
    queryKey: ['staff-for-attendance'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*, user_roles(role)').eq('is_active', true);
      if (error) throw error;
      return (data || []).filter((p: any) => (p.user_roles as any[])?.some((r: any) => r.role === 'staff'));
    },
    enabled: isAdmin,
  });

  // Filter attendance
  const filteredAttendance = useMemo(() => {
    let filtered = attendance;
    if (viewMode === 'daily') {
      filtered = filtered.filter((a: any) => a.date === dateFilter);
    }
    if (selectedStaffId !== 'all') {
      filtered = filtered.filter((a: any) => a.user_id === selectedStaffId);
    }
    return filtered;
  }, [attendance, dateFilter, selectedStaffId, viewMode]);

  const holidayDates = useMemo(() => new Set(holidays.map((h: any) => h.date)), [holidays]);

  // Monthly summary
  const monthlyStats = useMemo(() => {
    const staffMap = new Map<string, { name: string; present: number; absent: number; totalDays: number; photo: string }>();
    const [year, month] = monthFilter.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const t = new Date();
    const maxDay = year === t.getFullYear() && month === t.getMonth() + 1 ? t.getDate() : daysInMonth;
    let workingDays = 0;
    for (let d = 1; d <= maxDay; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (new Date(year, month - 1, d).getDay() !== 0 && !holidayDates.has(dateStr)) workingDays++;
    }
    const profiles = isAdmin ? staffProfiles : [{ user_id: user?.id, name: profile?.name || 'Me', photo: profile?.photo || '' }];
    profiles.forEach((p: any) => {
      const sa = attendance.filter((a: any) => a.user_id === p.user_id);
      const presentDays = sa.filter((a: any) => a.status === 'present').length;
      staffMap.set(p.user_id, { name: p.name, present: presentDays, absent: Math.max(0, workingDays - presentDays), totalDays: workingDays, photo: p.photo || '' });
    });
    return { staffMap, workingDays };
  }, [attendance, monthFilter, staffProfiles, isAdmin, user, profile, holidayDates]);

  const chartData = useMemo(() => {
    const dayMap = new Map<string, number>();
    attendance.forEach((a: any) => { dayMap.set(a.date, (dayMap.get(a.date) || 0) + 1); });
    return Array.from(dayMap.entries()).map(([date, count]) => ({ date: new Date(date).getDate().toString(), count })).sort((a, b) => Number(a.date) - Number(b.date));
  }, [attendance]);

  const pieData = useMemo(() => {
    const totalPresent = Array.from(monthlyStats.staffMap.values()).reduce((s, v) => s + v.present, 0);
    const totalAbsent = Array.from(monthlyStats.staffMap.values()).reduce((s, v) => s + v.absent, 0);
    return [{ name: 'Present', value: totalPresent }, { name: 'Absent', value: totalAbsent }];
  }, [monthlyStats]);

  const COLORS = ['hsl(152, 60%, 40%)', 'hsl(0, 72%, 51%)'];

  const formatTime = (t: string | null) => {
    if (!t) return '--:--';
    return new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const getStaffName = (userId: string) => {
    const staff = staffProfiles.find((s: any) => s.user_id === userId);
    return staff?.name || profile?.name || 'Unknown';
  };

  // Admin: Reject attendance
  const handleRejectAttendance = async (recordId: string) => {
    const { error } = await supabase.from('attendance').update({ status: 'rejected' }).eq('id', recordId);
    if (error) { toast.error('Failed to reject: ' + error.message); return; }
    toast.success('Attendance rejected. Staff must re-submit.');
    queryClient.invalidateQueries({ queryKey: ['attendance-all'] });
    queryClient.invalidateQueries({ queryKey: ['my-attendance-today'] });
    setViewingRecord(null);
  };

  // Admin: Holiday management
  const handleAddHoliday = async () => {
    if (!newHolidayDate || !newHolidayTitle) { toast.error('Date aur title dono bharo'); return; }
    const { error } = await supabase.from('holidays').insert({ date: newHolidayDate, title: newHolidayTitle, created_by: user!.id });
    if (error) { toast.error(error.message); return; }
    toast.success('Holiday declared!');
    setNewHolidayDate('');
    setNewHolidayTitle('');
    setHolidayDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: ['holidays'] });
  };

  const handleDeleteHoliday = async (id: string) => {
    const { error } = await supabase.from('holidays').delete().eq('id', id);
    if (error) { toast.error('Failed to delete'); return; }
    toast.success('Holiday removed');
    queryClient.invalidateQueries({ queryKey: ['holidays'] });
  };

  // Camera & Location
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

  const startCamera = useCallback(async (facing: string) => {
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setStreaming(true);
      }
    } catch {
      toast.error('Camera access denied. Please allow camera permission.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setStreaming(false);
  }, []);

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
      
      // Fetch address in parallel while camera opens
      reverseGeocode(loc.lat, loc.lng).then(addr => setLocationAddress(addr));
      setTimeout(() => startCamera('user'), 300);
    } catch (err: any) {
      toast.error('Location permission required. Settings me jaake location allow karo.');
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

      refetchToday();
      queryClient.invalidateQueries({ queryKey: ['attendance-all'] });
      setSelfieDialogOpen(false);
    } catch (e: any) {
      toast.error(e.message || 'Attendance failed');
    } finally {
      setCapturingLocation(false);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'rejected') return 'bg-destructive/10 text-destructive';
    if (status === 'present') return 'bg-emerald-500/10 text-emerald-600';
    return 'bg-destructive/10 text-destructive';
  };

  return (
    <div className="space-y-6">
      {/* Mark Attendance Section */}
      <div className="stat-card border-2 border-primary/20">
        <h3 className="font-display font-semibold text-lg flex items-center gap-2 mb-3">
          <Clock className="w-5 h-5 text-primary" /> Mark Attendance — {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })}
        </h3>

        {isRejected && (
          <div className="flex items-center gap-2 bg-destructive/10 text-destructive rounded-xl px-4 py-3 mb-4 border border-destructive/20">
            <Ban className="w-5 h-5" />
            <div>
              <p className="font-medium text-sm">Attendance Rejected by Admin</p>
              <p className="text-xs opacity-80">Please re-submit your attendance with a new selfie.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className={`rounded-xl p-4 border ${hasCheckedIn ? 'bg-emerald-500/10 border-emerald-500/30' : isRejected ? 'bg-destructive/5 border-destructive/20' : 'bg-muted border-border'}`}>
            <div className="flex items-center gap-2 mb-1">
              <LogIn className={`w-4 h-4 ${hasCheckedIn ? 'text-emerald-500' : isRejected ? 'text-destructive' : 'text-muted-foreground'}`} />
              <span className="text-xs font-medium uppercase tracking-wider">Check In</span>
            </div>
            <p className="text-xl font-bold font-display">{isRejected ? 'Rejected' : formatTime(todayAttendance?.check_in_time ?? null)}</p>
            {todayAttendance?.check_in_address && hasCheckedIn && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 truncate"><MapPin className="w-3 h-3 flex-shrink-0" /> {todayAttendance.check_in_address}</p>
            )}
          </div>
          <div className={`rounded-xl p-4 border ${hasCheckedOut ? 'bg-blue-500/10 border-blue-500/30' : 'bg-muted border-border'}`}>
            <div className="flex items-center gap-2 mb-1">
              <LogOut className={`w-4 h-4 ${hasCheckedOut ? 'text-blue-500' : 'text-muted-foreground'}`} />
              <span className="text-xs font-medium uppercase tracking-wider">Check Out</span>
            </div>
            <p className="text-xl font-bold font-display">{formatTime(todayAttendance?.check_out_time ?? null)}</p>
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

      {/* Admin: Holiday Management */}
      {isAdmin && (
        <div className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-lg flex items-center gap-2">
              <CalendarOff className="w-5 h-5 text-primary" /> Holidays
            </h3>
            <Button size="sm" variant="outline" onClick={() => setHolidayDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-1" /> Declare Holiday
            </Button>
          </div>
          {holidays.length === 0 ? (
            <p className="text-sm text-muted-foreground">No holidays declared this month.</p>
          ) : (
            <div className="space-y-2">
              {holidays.map((h: any) => (
                <div key={h.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <CalendarOff className="w-4 h-4 text-orange-500" />
                    <div>
                      <p className="text-sm font-medium">{h.title}</p>
                      <p className="text-xs text-muted-foreground">{new Date(h.date).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteHoliday(h.id)} className="text-destructive hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex bg-muted rounded-lg p-1">
          <button onClick={() => setViewMode('daily')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'daily' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}>Daily</button>
          <button onClick={() => setViewMode('monthly')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'monthly' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}>Monthly</button>
        </div>
        {viewMode === 'daily' ? (
          <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-auto" />
        ) : (
          <Input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="w-auto" />
        )}
        {isAdmin && (
          <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
            <SelectTrigger className="w-48"><SelectValue placeholder="All Staff" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Staff</SelectItem>
              {staffProfiles.map((s: any) => (<SelectItem key={s.user_id} value={s.user_id}>{s.name}</SelectItem>))}
            </SelectContent>
          </Select>
        )}
        <Button variant="outline" size="sm" onClick={() => {
          exportToCSV(filteredAttendance.map((a: any) => ({
            Date: a.date, Staff: isAdmin ? getStaffName(a.user_id) : 'Me',
            CheckIn: formatTime(a.check_in_time), CheckOut: formatTime(a.check_out_time), Status: a.status,
            Location: a.check_in_address || '',
          })), 'attendance_report');
          toast.success('Exported!');
        }}>
          <Download className="w-4 h-4 mr-1" /> Export
        </Button>
      </div>

      {/* Monthly view */}
      {viewMode === 'monthly' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="stat-card"><div className="flex items-center gap-2 mb-2"><Calendar className="w-4 h-4 text-primary" /><span className="text-xs text-muted-foreground">Working Days</span></div><p className="text-2xl font-bold font-display">{monthlyStats.workingDays}</p></div>
            <div className="stat-card"><div className="flex items-center gap-2 mb-2"><Users className="w-4 h-4 text-primary" /><span className="text-xs text-muted-foreground">Total Staff</span></div><p className="text-2xl font-bold font-display">{monthlyStats.staffMap.size}</p></div>
            <div className="stat-card"><div className="flex items-center gap-2 mb-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /><span className="text-xs text-muted-foreground">Avg Attendance</span></div><p className="text-2xl font-bold font-display text-emerald-600">{monthlyStats.staffMap.size > 0 ? Math.round((Array.from(monthlyStats.staffMap.values()).reduce((s, v) => s + v.present, 0) / (monthlyStats.staffMap.size * monthlyStats.workingDays || 1)) * 100) : 0}%</p></div>
            <div className="stat-card"><div className="flex items-center gap-2 mb-2"><CalendarOff className="w-4 h-4 text-orange-500" /><span className="text-xs text-muted-foreground">Holidays</span></div><p className="text-2xl font-bold font-display">{holidays.length}</p></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="stat-card">
              <h4 className="font-display font-semibold mb-4">Daily Attendance Trend</h4>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="count" stroke="hsl(173, 58%, 39%)" fill="hsl(173, 58%, 39%)" fillOpacity={0.2} name="Present" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="stat-card">
              <h4 className="font-display font-semibold mb-4">Attendance Overview</h4>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {pieData.map((_, i) => <Cell key={`cell-${i}`} fill={COLORS[i]} />)}
                  </Pie>
                  <Legend /><Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {isAdmin && (
            <div className="stat-card">
              <h4 className="font-display font-semibold mb-4">Staff Attendance Summary</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border bg-muted/30"><th className="text-left px-4 py-3 font-medium">Staff</th><th className="text-center px-4 py-3 font-medium">Present</th><th className="text-center px-4 py-3 font-medium">Absent</th><th className="text-center px-4 py-3 font-medium">Rate</th></tr></thead>
                  <tbody>
                    {Array.from(monthlyStats.staffMap.entries()).map(([userId, stats]) => (
                      <tr key={userId} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium flex items-center gap-2">
                          {stats.photo ? <img src={stats.photo} className="w-7 h-7 rounded-full object-cover" alt="" /> : <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{stats.name.charAt(0)}</div>}
                          {stats.name}
                        </td>
                        <td className="text-center px-4 py-3 text-emerald-600 font-semibold">{stats.present}</td>
                        <td className="text-center px-4 py-3 text-destructive font-semibold">{stats.absent}</td>
                        <td className="text-center px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${(stats.present / (stats.totalDays || 1)) * 100 >= 80 ? 'bg-emerald-500/10 text-emerald-600' : (stats.present / (stats.totalDays || 1)) * 100 >= 50 ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'}`}>
                            {Math.round((stats.present / (stats.totalDays || 1)) * 100)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Daily records */}
      {viewMode === 'daily' && (
        <div className="stat-card">
          <h4 className="font-display font-semibold mb-4">
            {isAdmin ? 'Staff Attendance' : 'My Attendance'} — {new Date(dateFilter).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })}
          </h4>
          {holidayDates.has(dateFilter) && (
            <div className="flex items-center gap-2 bg-orange-500/10 text-orange-600 rounded-lg px-4 py-2.5 mb-4 text-sm">
              <CalendarOff className="w-4 h-4" />
              Holiday: {holidays.find((h: any) => h.date === dateFilter)?.title}
            </div>
          )}
          {filteredAttendance.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No attendance records for this date</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAttendance.map((a: any) => (
                <div key={a.id} className="flex items-center gap-4 bg-muted/30 rounded-xl px-4 py-3 hover:bg-muted/50 transition-colors">
                  <div className="flex-shrink-0">
                    {a.check_in_selfie ? <img src={a.check_in_selfie} alt="" className="w-12 h-12 rounded-xl object-cover border border-border" /> : <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center"><Camera className="w-5 h-5 text-muted-foreground" /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    {isAdmin && <p className="font-semibold text-sm">{getStaffName(a.user_id)}</p>}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-emerald-500" /> In: {formatTime(a.check_in_time)}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-blue-500" /> Out: {formatTime(a.check_out_time)}</span>
                    </div>
                    {a.check_in_address && (
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 truncate"><MapPin className="w-3 h-3 flex-shrink-0" /> {a.check_in_address}</p>
                    )}
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${getStatusBadge(a.status)}`}>{a.status}</span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => setViewingRecord(a)}><Eye className="w-4 h-4" /></Button>
                    {isAdmin && a.status === 'present' && (
                      <Button variant="ghost" size="icon" onClick={() => handleRejectAttendance(a.id)} className="text-destructive hover:text-destructive" title="Reject Attendance">
                        <Ban className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!viewingRecord} onOpenChange={() => setViewingRecord(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Attendance Detail</DialogTitle>
            <DialogDescription>{viewingRecord && new Date(viewingRecord.date).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</DialogDescription>
          </DialogHeader>
          {viewingRecord && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                {isAdmin && <p className="font-semibold">{getStaffName(viewingRecord.user_id)}</p>}
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${getStatusBadge(viewingRecord.status)}`}>{viewingRecord.status}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Check In</p>
                  <p className="text-lg font-bold text-emerald-600">{formatTime(viewingRecord.check_in_time)}</p>
                  {viewingRecord.check_in_selfie && <img src={viewingRecord.check_in_selfie} alt="" className="w-full rounded-xl border border-border" />}
                  {viewingRecord.check_in_address && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><MapPin className="w-3 h-3" /> {viewingRecord.check_in_address}</p>
                  )}
                  {viewingRecord.check_in_lat && Number(viewingRecord.check_in_lat) !== 0 && (
                    <a href={`https://www.google.com/maps?q=${viewingRecord.check_in_lat},${viewingRecord.check_in_lng}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline"><MapPin className="w-3 h-3" /> View on Map</a>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Check Out</p>
                  <p className="text-lg font-bold text-blue-600">{formatTime(viewingRecord.check_out_time)}</p>
                  {viewingRecord.check_out_selfie && <img src={viewingRecord.check_out_selfie} alt="" className="w-full rounded-xl border border-border" />}
                  {viewingRecord.check_out_address && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><MapPin className="w-3 h-3" /> {viewingRecord.check_out_address}</p>
                  )}
                  {viewingRecord.check_out_lat && Number(viewingRecord.check_out_lat) !== 0 && (
                    <a href={`https://www.google.com/maps?q=${viewingRecord.check_out_lat},${viewingRecord.check_out_lng}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline"><MapPin className="w-3 h-3" /> View on Map</a>
                  )}
                </div>
              </div>
              {isAdmin && viewingRecord.status === 'present' && (
                <Button variant="destructive" onClick={() => handleRejectAttendance(viewingRecord.id)} className="w-full">
                  <Ban className="w-4 h-4 mr-2" /> Reject This Attendance
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Holiday dialog */}
      <Dialog open={holidayDialogOpen} onOpenChange={setHolidayDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CalendarOff className="w-4 h-4" /> Declare Holiday</DialogTitle>
            <DialogDescription>Staff won't be marked absent on this day.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Date</label>
              <Input type="date" value={newHolidayDate} onChange={e => setNewHolidayDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Holiday Name</label>
              <Input value={newHolidayTitle} onChange={e => setNewHolidayTitle(e.target.value)} placeholder="e.g. Diwali, Republic Day" />
            </div>
            <Button onClick={handleAddHoliday} className="w-full">
              <Plus className="w-4 h-4 mr-1" /> Add Holiday
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Selfie capture dialog */}
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

export default AttendancePage;
