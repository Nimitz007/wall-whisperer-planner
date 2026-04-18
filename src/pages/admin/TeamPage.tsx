import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Loader2, Shield, ShieldOff, UserPlus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

type Profile = { id: string; email: string | null; display_name: string | null; created_at: string };
type RoleRow = { user_id: string; role: string };

const TeamPage = () => {
  const { user: me } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('user_roles').select('user_id, role'),
    ]);
    setProfiles((p ?? []) as any);
    setRoles((r ?? []) as any);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const isAdmin = (uid: string) => roles.some(r => r.user_id === uid && r.role === 'admin');

  const grant = async (uid: string) => {
    const { error } = await supabase.from('user_roles').insert({ user_id: uid, role: 'admin' });
    if (error) return toast.error(error.message);
    toast.success('Admin access granted');
    load();
  };
  const revoke = async (uid: string) => {
    if (uid === me?.id) return toast.error("You can't revoke your own admin access.");
    const { error } = await supabase.from('user_roles').delete().eq('user_id', uid).eq('role', 'admin');
    if (error) return toast.error(error.message);
    toast.success('Admin access revoked');
    load();
  };

  const invite = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    const { error } = await supabase.auth.signUp({
      email, password, options: { data: { display_name: displayName } },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success('Account created. Toggle admin on the row below to grant access.');
    setEmail(''); setPassword(''); setDisplayName('');
    setTimeout(load, 600);
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold">Team</h1>
        <p className="text-sm text-muted-foreground">Manage who has admin access to the CRM.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><UserPlus className="h-4 w-4" /> Add a teammate</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={invite} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <Input placeholder="Display name" value={displayName} onChange={e => setDisplayName(e.target.value)} required />
            <Input placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            <Input placeholder="Temp password (8+)" type="password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required />
            <Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create</Button>
          </form>
          <p className="text-xs text-muted-foreground mt-2">After creating, click "Grant admin" on their row.</p>
        </CardContent>
      </Card>

      <div className="border rounded-md bg-card">
        {loading ? <div className="p-12 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin" /></div> : (
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {profiles.map(p => (
                <TableRow key={p.id}>
                  <TableCell>{p.display_name || '—'}{p.id === me?.id && <span className="text-xs text-muted-foreground"> (you)</span>}</TableCell>
                  <TableCell>{p.email}</TableCell>
                  <TableCell>{isAdmin(p.id) ? <Badge>Admin</Badge> : <Badge variant="outline">No access</Badge>}</TableCell>
                  <TableCell className="text-right">
                    {isAdmin(p.id)
                      ? <Button size="sm" variant="outline" onClick={() => revoke(p.id)} disabled={p.id === me?.id}><ShieldOff className="h-4 w-4 mr-1" /> Revoke</Button>
                      : <Button size="sm" onClick={() => grant(p.id)}><Shield className="h-4 w-4 mr-1" /> Grant admin</Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};

export default TeamPage;
