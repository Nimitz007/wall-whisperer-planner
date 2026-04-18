import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LayoutList, Users, LogOut, ExternalLink, Package } from 'lucide-react';

const AdminLayout = () => {
  const { user, signOut } = useAuth();
  const nav = useNavigate();

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
      isActive ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'
    }`;

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-60 border-r bg-card flex flex-col">
        <div className="p-4 border-b">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Simple Engineers</p>
          <p className="text-base font-semibold">Admin CRM</p>
        </div>
        <nav className="p-3 space-y-1 flex-1">
          <NavLink to="/admin" end className={linkCls}>
            <LayoutList className="h-4 w-4" /> Submissions
          </NavLink>
          <NavLink to="/admin/products" className={linkCls}>
            <Package className="h-4 w-4" /> Products
          </NavLink>
          <NavLink to="/admin/team" className={linkCls}>
            <Users className="h-4 w-4" /> Team
          </NavLink>
          <a href="/" target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-foreground hover:bg-muted">
            <ExternalLink className="h-4 w-4" /> Public planner
          </a>
        </nav>
        <div className="p-3 border-t space-y-2">
          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          <Button variant="outline" size="sm" className="w-full" onClick={async () => { await signOut(); nav('/admin/login'); }}>
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
