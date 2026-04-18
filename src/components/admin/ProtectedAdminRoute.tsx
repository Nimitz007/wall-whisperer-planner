import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

const ProtectedAdminRoute = ({ children }: { children: ReactNode }) => {
  const { user, isAdmin, loading } = useAuth();
  const loc = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <Navigate to="/admin/login" state={{ from: loc }} replace />;
  if (!isAdmin) {
    return (
      <div className="min-h-screen grid place-items-center bg-background p-6 text-center">
        <div className="max-w-md space-y-3">
          <h1 className="text-2xl font-semibold">Awaiting access</h1>
          <p className="text-muted-foreground">
            Your account ({user.email}) is signed in but does not have admin access yet. Ask an existing admin to grant
            you access from the Team page.
          </p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
};

export default ProtectedAdminRoute;
