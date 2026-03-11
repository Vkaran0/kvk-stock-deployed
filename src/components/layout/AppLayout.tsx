import { ReactNode, useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Package, Users, Receipt, BarChart3, LogOut, Menu, X, CalendarDays, UserCog, Moon, Sun, Bell, ClipboardCheck, BookOpen, Contact
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Warehouse } from "lucide-react";

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const { profile, role, signOut } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });

  const isAdmin = role === 'admin';

  // Low stock alerts
  const { data: lowStockItems = [] } = useQuery({
    queryKey: ['low-stock-alerts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('stock_items').select('name, quantity, min_stock');
      if (error) throw error;
      return data.filter(item => item.quantity <= item.min_stock);
    },
    refetchInterval: 60000, // check every minute
  });

  // Show low stock toast on mount
  useEffect(() => {
    if (lowStockItems.length > 0 && location.pathname === '/dashboard') {
      toast.warning(`${lowStockItems.length} item(s) are low on stock!`, {
        description: lowStockItems.slice(0, 3).map(i => `${i.name}: ${i.quantity} left`).join(', '),
        duration: 6000,
      });
    }
  }, [lowStockItems.length, location.pathname]);

  const toggleTheme = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    document.documentElement.classList.toggle('dark', newDark);
    localStorage.setItem('theme', newDark ? 'dark' : 'light');
  };

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Package, label: 'Stock', path: '/stock' },
    ...(isAdmin ? [{ icon: Users, label: 'Staff', path: '/staff' }] : []),
    { icon: Receipt, label: 'Billing', path: '/billing' },
    { icon: Contact, label: 'Customers', path: '/customers' },
    { icon: CalendarDays, label: 'Daily Stock', path: '/daily-stock' },
    { icon: BarChart3, label: 'Analysis', path: '/analysis' },
    { icon: Receipt, label: 'Bills History', path: '/bills' },
    { icon: BookOpen, label: 'Ledger', path: '/ledger' },
    { icon: ClipboardCheck, label: 'Attendance', path: '/attendance' },
    { icon: UserCog, label: 'My Profile', path: '/profile' },
  ];

  return (
    <div className="min-h-screen flex bg-background">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={cn(
        "fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-sidebar flex flex-col transition-transform duration-300 lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sidebar-primary flex items-center justify-center">
              <Warehouse className="w-5 h-5 text-sidebar-primary-foreground" />
            </div>
            <div>
              <h2 className="font-display font-bold text-sidebar-foreground text-lg leading-tight">KVK POINTS</h2>
              <p className="text-xs text-sidebar-foreground/60">Inventory System</p>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden text-sidebar-foreground/60">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="w-4.5 h-4.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-bold text-sidebar-primary">
              {profile?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{profile?.name || 'User'}</p>
              <p className="text-xs text-sidebar-foreground/50 capitalize">{role || 'staff'}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={signOut}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3 lg:px-6">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-foreground">
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-display font-semibold flex-1">
            {navItems.find(n => n.path === location.pathname)?.label || 'Dashboard'}
          </h1>

          {/* Low stock badge */}
          {lowStockItems.length > 0 && (
            <Link to="/dashboard" className="relative p-2 rounded-lg hover:bg-muted transition-colors">
              <Bell className="w-4.5 h-4.5 text-muted-foreground" />
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                {lowStockItems.length}
              </span>
            </Link>
          )}

          {/* Dark mode toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title={isDark ? 'Light mode' : 'Dark mode'}
          >
            {isDark ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
          </button>
        </header>
        <div className="page-container animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AppLayout;
